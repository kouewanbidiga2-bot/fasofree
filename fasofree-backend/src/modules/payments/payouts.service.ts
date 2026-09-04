import {
  Injectable,
  Logger,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  MerchantPayout,
  PayoutStatus,
  PayoutProvider,
} from './entities/merchant-payout.entity';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { Business } from '../businesses/entities/business.entity';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PayoutsService {
  private readonly logger = new Logger(PayoutsService.name);

  constructor(
    @InjectRepository(MerchantPayout)
    private readonly payoutRepository: Repository<MerchantPayout>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 🚀 Déclenche le Payout Automatique dès qu'une commande est LIVRÉE
   *
   * Garanties d'intégrité (voir audit de double paiement) :
   * ──────────────
   * • ONE payout par commande : un index UNIQUE existe sur
   *   `merchant_payouts.orderId` (entité + migration). Deux instances / retries
   *   concurrents NE PEUVENT PAS insérer deux paieouts pour la même commande.
   * • Tout payout déjà présent est renvoyé SANS ré-exécuter le virement
   *   (sauf retry explicite d'un état FAILED). Un état PROCESSING (= état
   *   inconnu : le provider a pu accepter le virement avant un crash) n'est
   *   JAMAIS ré-exécuté, pour empêcher un double paiement.
   */
  async processAutomaticPayout(
    orderId: string,
    opts: { retryFailed?: boolean } = {},
  ): Promise<MerchantPayout> {
    this.logger.log(
      `[Payout Pipeline] Initialisation du reversement pour la commande #${orderId}...`,
    );

    // 1️⃣ Vérification de l'existence de la commande
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException(`Commande #${orderId} introuvable.`);
    }

    // 2️⃣ Sécurité : Vérifier le statut de la commande
    if (
      order.status !== OrderStatus.DELIVERED &&
      order.status !== OrderStatus.COMPLETED
    ) {
      throw new Error(
        `Impossible de verser le payout : La commande #${orderId} n'est pas encore livrée.`,
      );
    }

    // 3️⃣ Garde-fou d'Idempotence : un payout existe déjà ?
    const existingPayout = await this.payoutRepository.findOne({
      where: { orderId },
    });
    if (existingPayout) {
      // État terminal SUCCESS : rien à refaire.
      if (existingPayout.status === PayoutStatus.SUCCESS) {
        this.logger.log(
          `[Idempotency] Payout déjà SUCCESS pour #${orderId} — aucun nouveau virement.`,
        );
        return existingPayout;
      }
      // État inconnu / potentiellement émis : PROCESSING.
      // On NE ré-exécute PAS pour ne pas créer un double paiement.
      if (existingPayout.status === PayoutStatus.PROCESSING) {
        this.logger.warn(
          `[Idempotency] Payout #${existingPayout.id} en PROCESSING pour #${orderId} — ` +
            `état inconnu (le provider a pu accepter) : aucun nouveau virement. À réconcilier.`,
        );
        return existingPayout;
      }
      // État FAILED / PENDING : échec certain → retry autorisé seulement si demandé.
      if (!opts.retryFailed) {
        this.logger.warn(
          `[Idempotency] Payout #${existingPayout.id} en ${existingPayout.status} pour #${orderId} — ` +
            `retry non demandé, aucun nouveau virement.`,
        );
        return existingPayout;
      }
      // Retry explicite d'un FAILED : réclamation ATOMIQUE de l'état FAILED/PENDING.
      // Seul le gagnant exécute le virement ; les autres instances abandonnent,
      // ce qui empêche deux virements concurrents pour le même payout.
      return this.claimAndExecute(existingPayout);
    }

    // 4️⃣ Récupération des informations du marchand
    const business = await this.businessRepository.findOne({
      where: { id: order.businessId },
    });

    // Priorité: mobileMoneyNumber (dédié paiements) > phone (contact)
    const merchantPhoneNumber = business?.mobileMoneyNumber || business?.phone;
    if (!merchantPhoneNumber) {
      throw new NotFoundException(
        `Numéro de paiement introuvable pour le commerce ${order.businessId}. Le marchand doit configurer son numéro Mobile Money.`,
      );
    }

    const preferredProvider =
      (business?.mobileMoneyProvider as unknown as PayoutProvider) ||
      PayoutProvider.ORANGE_MONEY;

    // 5️⃣ Création de l'enregistrement Payout (Statut PROCESSING)
    const payout = this.payoutRepository.create({
      orderId: order.id,
      businessId: order.businessId,
      amount: Number(order.merchantPayoutAmount),
      status: PayoutStatus.PROCESSING,
      provider: preferredProvider,
      recipientPhoneNumber: merchantPhoneNumber,
    });

    let savedPayout: MerchantPayout;
    try {
      savedPayout = await this.payoutRepository.save(payout);
    } catch (error) {
      // Course : une autre instance / un retry a déjà créé le payout entre
      // notre lecture (findOne=null) et notre insert. L'index UNIQUE sur
      // orderId a rejeté notre insert → on renvoie le payout existant sans
      // jamais envoyer un second virement.
      const winner = await this.payoutRepository.findOne({
        where: { orderId },
      });
      if (winner) {
        this.logger.warn(
          `[Race] Payout #${winner.id} déjà créé par une autre instance pour #${orderId} — ` +
            `virement NON ré-exécuté.`,
        );
        return winner;
      }
      throw error;
    }

    // 6️⃣ Exécution de l'appel API à l'agrégateur
    return this.executePayout(savedPayout);
  }

  /**
   * Réclamation ATOMIQUE (retry d'un FAILED/PENDING) avant exécution.
   *
   * Utilise un UPDATE conditionnel : seulement la première instance qui passe
   * l'état de FAILED/PENDING → PROCESSING exécute le virement. Les autres voient
   * `affected = 0` (état déjà changé, ou déjà SUCCESS) et NE ré-exécutent PAS.
   *
   * Garantie anti-double-virement même avec plusieurs instances du cron d'escrow
   * ou des retries concurrents.
   */
  private async claimAndExecute(
    existing: MerchantPayout,
  ): Promise<MerchantPayout> {
    const result = await this.payoutRepository
      .createQueryBuilder()
      .update(MerchantPayout)
      .set({ status: PayoutStatus.PROCESSING })
      .where('id = :id', { id: existing.id })
      .andWhere('status IN (:...retryable)', {
        retryable: [PayoutStatus.FAILED, PayoutStatus.PENDING],
      })
      .execute();

    if (result.affected === 0) {
      // Une autre instance a déjà réclamé le retry ou le payout est passé à
      // SUCCESS entre-temps → on ne ré-exécute PAS le virement.
      const current = await this.payoutRepository.findOne({
        where: { id: existing.id },
      });
      this.logger.warn(
        `[Retry Race] Payout #${existing.id} pour #${existing.orderId} déjà réclamé ` +
          `(statut actuel: ${current?.status}) — virement NON ré-exécuté.`,
      );
      return current ?? existing;
    }

    this.logger.log(
      `[Retry] Réclamation acquise pour le payout #${existing.id} — exécution du virement.`,
    );
    return this.executePayout(existing);
  }

  /**
   * Exécute (ou ré-exécute) un virement sur un enregistrement Payout et persiste
   * l'issue (SUCCESS / FAILED) en base.
   */
  private async executePayout(
    payout: MerchantPayout,
  ): Promise<MerchantPayout> {
    payout.status = PayoutStatus.PROCESSING;
    payout.failureReason = undefined;
    await this.payoutRepository.save(payout);

    try {
      const gatewayResponse = await this.executeMobileMoneyTransfer({
        phoneNumber: payout.recipientPhoneNumber,
        amount: payout.amount,
        provider: payout.provider,
        reference: `PAYOUT-${payout.id}`,
      });

      payout.status = PayoutStatus.SUCCESS;
      payout.providerTransactionRef = gatewayResponse.transactionRef;
      await this.payoutRepository.save(payout);

      this.logger.log(
        `[Payout Success] ✅ ${payout.amount} FCFA versés au marchand (${payout.businessId}) pour la commande #${payout.orderId}. Ref: ${gatewayResponse.transactionRef}`,
      );
    } catch (error) {
      payout.status = PayoutStatus.FAILED;
      payout.failureReason = error.message;
      await this.payoutRepository.save(payout);

      this.logger.error(
        `[Payout Failed] ❌ Échec du virement de ${payout.amount} FCFA pour la commande #${payout.orderId}: ${error.message}`,
      );
    }

    return payout;
  }

  /**
   * 📲 Adapter pour les SDKs Mobile Money (Orange Money, Wave, Moov Money)
   */
  private async executeMobileMoneyTransfer(payload: {
    phoneNumber: string;
    amount: number;
    provider: PayoutProvider;
    reference: string;
  }): Promise<{ success: boolean; transactionRef: string }> {
    if (
      this.configService.get<string>('PAYOUTS_SIMULATION_ENABLED') !== 'true'
    ) {
      throw new Error('Aucun prestataire de reversement n’est configuré');
    }
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          transactionRef: `MM-TX-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        });
      }, 500);
    });
  }
}
