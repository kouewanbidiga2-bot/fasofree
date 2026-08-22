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
   */
  async processAutomaticPayout(orderId: string): Promise<MerchantPayout> {
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

    // 3️⃣ Garde-fou d'Idempotence : Vérifier si un payout n'a pas DÉJÀ été créé
    const existingPayout = await this.payoutRepository.findOne({
      where: { orderId },
    });
    if (existingPayout) {
      this.logger.warn(
        `[Idempotency Guard] Un payout existe déjà pour la commande #${orderId} (Statut: ${existingPayout.status})`,
      );
      return existingPayout;
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

    // Priorite: mobileMoneyProvider configure > defaut ORANGE_MONEY
    const preferredProvider = (business?.mobileMoneyProvider as unknown as PayoutProvider) || PayoutProvider.ORANGE_MONEY;

    // 5️⃣ Création de l'enregistrement Payout (Statut PENDING)
    const payout = this.payoutRepository.create({
      orderId: order.id,
      businessId: order.businessId,
      amount: Number(order.merchantPayoutAmount),
      status: PayoutStatus.PROCESSING,
      provider: preferredProvider,
      recipientPhoneNumber: merchantPhoneNumber,
    });

    const savedPayout = await this.payoutRepository.save(payout);

    // 6️⃣ Exécution de l'appel API à l'agrégateur (Orange Money / Wave / Bizao)
    try {
      const gatewayResponse = await this.executeMobileMoneyTransfer({
        phoneNumber: merchantPhoneNumber,
        amount: savedPayout.amount,
        provider: preferredProvider,
        reference: `PAYOUT-${savedPayout.id}`,
      });

      // ✅ Succès du transfert
      savedPayout.status = PayoutStatus.SUCCESS;
      savedPayout.providerTransactionRef = gatewayResponse.transactionRef;
      await this.payoutRepository.save(savedPayout);

      this.logger.log(
        `[Payout Success] ✅ ${savedPayout.amount} FCFA versés au marchand (${order.businessId}) pour la commande #${orderId}. Ref: ${gatewayResponse.transactionRef}`,
      );
    } catch (error) {
      // ❌ Échec de la transaction (Ex: Solde insuffisant sur le compte marchandise, Réseau indisponible)
      savedPayout.status = PayoutStatus.FAILED;
      savedPayout.failureReason = error.message;
      await this.payoutRepository.save(savedPayout);

      this.logger.error(
        `[Payout Failed] ❌ Échec du virement de ${savedPayout.amount} FCFA pour la commande #${orderId}: ${error.message}`,
      );
    }

    return savedPayout;
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
