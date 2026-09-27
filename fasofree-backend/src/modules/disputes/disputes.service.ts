import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource, In, Repository } from 'typeorm';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import {
  MerchantPayout,
  PayoutStatus,
} from '../payments/entities/merchant-payout.entity';
import {
  Transaction,
  TransactionStatus,
} from '../payments/entities/transaction.entity';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { ReviewDisputeDto } from './dto/review-dispute.dto';
import {
  Dispute,
  DisputeResolution,
  DisputeStatus,
} from './entities/dispute.entity';
import { DisputeMessage } from './entities/dispute-message.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/entities/user-role.enum';
import { Business } from '../businesses/entities/business.entity';
import { BusinessesService } from '../businesses/businesses.service';
import {
  DISPUTE_OPENED,
  DISPUTE_RESOLVED,
  DisputeOpenedEvent,
  DisputeResolvedEvent,
} from './events/dispute.events';
import { WalletService } from '../wallets/wallet.service';
import { UserRole as WalletUserRole } from '../wallets/entities/wallet.entity';
import { TransactionReason } from '../wallets/entities/wallet-transaction.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';

const STAFF_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.SUPPORT,
];

// Valeur de rôle en base (minuscules), typée `string` pour comparer sans
// lever @typescript-eslint/no-unsafe-enum-comparison sur des paramètres
// typés `string` (ex. JwtPayload.role).
const BUSINESS_ADMIN_ROLE: string = UserRole.BUSINESS_ADMIN;

@Injectable()
export class DisputesService {
  private readonly logger = new Logger(DisputesService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly events: EventEmitter2,
    private readonly walletService: WalletService,
    private readonly notificationsService: NotificationsService,
    private readonly usersService: UsersService,
    private readonly businessesService: BusinessesService,
    private readonly messageRepo: Repository<DisputeMessage>,
  ) {}

  async open(
    orderId: string,
    clientId: string,
    dto: CreateDisputeDto,
  ): Promise<Dispute> {
    const user = await this.usersService.findById(clientId);
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Mot de passe incorrect');
    }

    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    let event: DisputeOpenedEvent | undefined;
    try {
      const order = await runner.manager.findOne(Order, {
        where: { id: orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) throw new NotFoundException('Commande introuvable');
      if (order.clientId !== clientId)
        throw new ForbiddenException('Cette commande ne vous appartient pas');
      if (
        ![
          OrderStatus.DELIVERED,
          OrderStatus.DELIVERED_PENDING_CONFIRMATION,
        ].includes(order.status)
      ) {
        throw new BadRequestException(
          `Un litige ne peut être ouvert au statut ${order.status}`,
        );
      }
      const existing = await runner.manager.findOne(Dispute, {
        where: { orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (existing)
        throw new ConflictException(
          'Un litige existe déjà pour cette commande',
        );

      const dispute = await runner.manager.save(
        Dispute,
        runner.manager.create(Dispute, {
          orderId,
          clientId,
          reason: dto.reason.trim(),
          attachments: dto.attachments ?? [],
          status: DisputeStatus.OPEN,
          assignedAdminId: null,
          supportAgentId: null,
          supportNote: null,
          adminNote: null,
          resolution: null,
          refundAmount: null,
          resolvedAt: null,
        }),
      );
      order.status = OrderStatus.DISPUTED;
      await runner.manager.save(order);

      const payout = await runner.manager.findOne(MerchantPayout, {
        where: { orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (
        payout &&
        [PayoutStatus.PENDING, PayoutStatus.PROCESSING].includes(payout.status)
      ) {
        payout.status = PayoutStatus.BLOCKED;
        payout.failureReason = 'Bloqué automatiquement : litige ouvert';
        await runner.manager.save(payout);
      }
      event = {
        disputeId: dispute.id,
        orderId,
        clientId,
        businessId: order.businessId,
      };
      await runner.commitTransaction();
      return dispute;
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
      if (event) this.events.emit(DISPUTE_OPENED, event);
    }
  }

  /**
   * 📋 Liste des litiges (staff), enrichis de la commande, du client et du commerce.
   * Utilisée par tout l'administration (super admin / admin / support).
   */
  async list(status?: DisputeStatus): Promise<Dispute[]> {
    const disputes = await this.dataSource.getRepository(Dispute).find({
      where: status ? { status } : {},
      order: { createdAt: 'DESC' },
    });
    return this.enrich(disputes);
  }

  /**
   * 🏪 Litiges des commerces gérés par un gérant (multi-agences).
   * Filtrage côté serveur par commande : le gérant ne voit QUE les litiges
   * de ses propres commerces, jamais les autres.
   */
  async listForBusiness(merchantId: string): Promise<Dispute[]> {
    const businesses = await this.businessesService.findAllByOwner(merchantId);
    if (!businesses.length) return [];
    const businessIds = businesses.map((b) => b.id);

    // Une seule requête JOIN disputes → orders filtrée par businessId, bornée
    // à 200 litiges (les litiges actifs d'un commerce sont peu nombreux).
    const disputes = await this.dataSource
      .getRepository(Dispute)
      .createQueryBuilder('d')
      .innerJoin(Order, 'o', 'o.id = d.orderId')
      .where('o.businessId IN (:...businessIds)', { businessIds })
      .orderBy('d.createdAt', 'DESC')
      .take(200)
      .getMany();

    return this.enrich(disputes);
  }

  async getForClient(id: string, clientId: string): Promise<Dispute> {
    const dispute = await this.dataSource
      .getRepository(Dispute)
      .findOne({ where: { id } });
    if (!dispute) throw new NotFoundException('Litige introuvable');
    if (dispute.clientId !== clientId)
      throw new ForbiddenException('Ce litige ne vous appartient pas');
    return dispute;
  }

  async listForClient(clientId: string): Promise<Dispute[]> {
    return this.dataSource.getRepository(Dispute).find({
      where: { clientId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * 🔍 Détail d'un litige pour le staff ou le gérant du commerce concerné.
   */
  async getForStaff(
    id: string,
    role: string,
    userId: string,
  ): Promise<Dispute> {
    const dispute = await this.dataSource
      .getRepository(Dispute)
      .findOne({ where: { id } });
    if (!dispute) throw new NotFoundException('Litige introuvable');
    const allowed = await this.canAccess(dispute, role, userId);
    if (!allowed)
      throw new ForbiddenException("Vous n'avez pas accès à ce litige");
    return (await this.enrich([dispute]))[0];
  }

  /**
   * 🎫 Commandes livrées du client éligibles à une nouvelle réclamation
   * (statut livré/confirmé, sans litige déjà ouvert).
   */
  async listEligibleOrders(clientId: string): Promise<
    Array<{
      id: string;
      status: OrderStatus;
      totalAmount: number;
      createdAt: Date;
      businessName: string | null;
    }>
  > {
    const orders = await this.dataSource.getRepository(Order).find({
      where: {
        clientId,
        status: In([
          OrderStatus.DELIVERED,
          OrderStatus.DELIVERED_PENDING_CONFIRMATION,
        ]),
      },
      order: { createdAt: 'DESC' },
      take: 30,
    });
    if (!orders.length) return [];

    const existing = await this.dataSource.getRepository(Dispute).find({
      where: { orderId: In(orders.map((o) => o.id)) },
      select: { orderId: true },
    });
    const disputedIds = new Set(existing.map((d) => d.orderId));
    const eligible = orders.filter((o) => !disputedIds.has(o.id));

    const businessIds = [
      ...new Set(
        eligible
          .map((o) => o.businessId)
          .filter((id): id is string => id !== null),
      ),
    ];
    const businesses = businessIds.length
      ? await this.dataSource
          .getRepository(Business)
          .find({ where: { id: In(businessIds) } })
      : [];
    const businessNameById = new Map(businesses.map((b) => [b.id, b.name]));

    return eligible.map((o) => ({
      id: o.id,
      status: o.status,
      totalAmount: Number(o.totalAmount),
      createdAt: o.createdAt,
      businessName: o.businessId
        ? (businessNameById.get(o.businessId) ?? null)
        : null,
    }));
  }

  /**
   * 🔐 Accès à un litige :
   * - toute l'administration (super admin / admin / support),
   * - le client propriétaire,
   * - le gérant du commerce lié à la commande (pour régler à l'amiable).
   */
  async canAccessDispute(
    disputeId: string,
    role: string,
    userId: string,
  ): Promise<boolean> {
    const dispute = await this.dataSource
      .getRepository(Dispute)
      .findOne({ where: { id: disputeId } });
    if (!dispute) return false;
    return this.canAccess(dispute, role, userId);
  }

  /**
   * 🔐 Charge un litige pour un participant (client / staff / gérant) et
   * vérifie son accès. 404 si introuvable, 403 si non autorisé.
   * Utilisé par le gateway WS (joinDispute / sendDisputeMessage).
   */
  async getForParticipant(
    disputeId: string,
    role: string,
    userId: string,
  ): Promise<Dispute> {
    const dispute = await this.dataSource
      .getRepository(Dispute)
      .findOne({ where: { id: disputeId } });
    if (!dispute) throw new NotFoundException('Litige introuvable');
    if (!(await this.canAccess(dispute, role, userId)))
      throw new ForbiddenException("Vous n'avez pas accès à ce litige");
    return dispute;
  }

  private async canAccess(
    dispute: Dispute,
    role: string,
    userId: string,
  ): Promise<boolean> {
    if (STAFF_ROLES.includes(role as UserRole)) return true;
    if (dispute.clientId === userId) return true;
    // Les rôles en base sont en minuscules (user-role.enum.ts) ; on normalise
    // pour comparer sans unsafe-enum-comparison (cf. pattern chat.service).
    const normalizedRole = role.toLowerCase();
    if (normalizedRole === BUSINESS_ADMIN_ROLE) {
      const order = await this.dataSource
        .getRepository(Order)
        .findOne({ where: { id: dispute.orderId } });
      if (!order?.businessId) return false;
      try {
        await this.businessesService.assertManagedBy(
          order.businessId,
          userId,
          normalizedRole as UserRole,
        );
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  /**
   * 💬 Historique du chat support d'un litige (accès contrôlé).
   */
  async listMessages(
    disputeId: string,
    role: string,
    userId: string,
  ): Promise<DisputeMessage[]> {
    const dispute = await this.dataSource
      .getRepository(Dispute)
      .findOne({ where: { id: disputeId } });
    if (!dispute) throw new NotFoundException('Litige introuvable');
    if (!(await this.canAccess(dispute, role, userId)))
      throw new ForbiddenException("Vous n'avez pas accès à ce litige");
    return this.messageRepo.find({
      where: { disputeId },
      order: { createdAt: 'ASC' },
      // Garde-fou anti-croissance : plafonne l'historique servi à une fois
      // (pagination par curseur à prévoir si un litige dépasse 200 messages).
      take: 200,
    });
  }

  /**
   * ✉️ Envoyer un message dans le chat support d'un litige.
   * L'expéditeur est identifié côté serveur (jamais fourni par le client).
   */
  async addMessage(
    disputeId: string,
    role: string,
    userId: string,
    message: string,
  ): Promise<DisputeMessage> {
    const dispute = await this.dataSource
      .getRepository(Dispute)
      .findOne({ where: { id: disputeId } });
    if (!dispute) throw new NotFoundException('Litige introuvable');
    if (!(await this.canAccess(dispute, role, userId)))
      throw new ForbiddenException("Vous n'avez pas accès à ce litige");

    // 🚫 Litige terminal : plus aucun message (cohérent avec le refus WS
    // /support ; propre à la persistance REST qui contournerait le garde).
    if (
      dispute.status === DisputeStatus.APPROVED ||
      dispute.status === DisputeStatus.REJECTED ||
      dispute.status === DisputeStatus.CLOSED
    ) {
      throw new ConflictException(
        'Ce litige est clôturé, aucun nouveau message ne peut être envoyé',
      );
    }

    const clean = message
      .trim()
      .replace(/<[^>]*>/g, '')
      .slice(0, 2000);
    if (!clean) throw new BadRequestException('Message vide');

    const sender = await this.usersService.findById(userId);
    const saved = await this.messageRepo.save(
      this.messageRepo.create({
        disputeId,
        senderId: userId,
        senderRole: role,
        senderName: sender?.fullName?.trim() || null,
        message: clean,
      }),
    );
    return saved;
  }

  /**
   * Enrichit une liste de litiges avec la commande, le client et le commerce
   * associés (jointures en mémoire, volumes faibles).
   */
  private async enrich(disputes: Dispute[]): Promise<Dispute[]> {
    if (!disputes.length) return disputes;
    const orderIds = [...new Set(disputes.map((d) => d.orderId))];
    const clientIds = [...new Set(disputes.map((d) => d.clientId))];

    const [orders, clients] = await Promise.all([
      this.dataSource
        .getRepository(Order)
        .find({ where: { id: In(orderIds) } }),
      this.dataSource
        .getRepository(User)
        .find({ where: { id: In(clientIds) } }),
    ]);
    const orderById = new Map(orders.map((o) => [o.id, o]));
    const clientById = new Map(clients.map((u) => [u.id, u]));

    const businessIds = [
      ...new Set(
        orders
          .map((o) => o.businessId)
          .filter((id): id is string => id !== null),
      ),
    ];
    const businesses = businessIds.length
      ? await this.dataSource
          .getRepository(Business)
          .find({ where: { id: In(businessIds) } })
      : [];
    const businessById = new Map(businesses.map((b) => [b.id, b]));

    return disputes.map((d) => {
      const order = orderById.get(d.orderId);
      const client = clientById.get(d.clientId);
      const business = order ? businessById.get(order.businessId) : undefined;
      return Object.assign(d, {
        order: order
          ? {
              id: order.id,
              status: order.status,
              totalAmount: Number(order.totalAmount),
              businessId: order.businessId,
            }
          : null,
        client: client
          ? {
              id: client.id,
              fullName: client.fullName,
              phone: client.phone,
              email: client.email,
            }
          : null,
        business: business
          ? { id: business.id, name: business.name, phone: business.phone }
          : null,
      });
    });
  }

  /**
   * 🔒 Action Support Agent: Prendre en charge un litige
   */
  async assignToSupport(
    id: string,
    supportAgentId: string,
    note?: string,
  ): Promise<Dispute> {
    const dispute = await this.dataSource.getRepository(Dispute).findOne({
      where: { id },
    });
    if (!dispute) throw new NotFoundException('Litige introuvable');
    if (dispute.status !== DisputeStatus.OPEN) {
      throw new ConflictException('Ce litige est déjà en cours de traitement');
    }

    dispute.status = DisputeStatus.UNDER_INVESTIGATION;
    dispute.supportAgentId = supportAgentId;
    dispute.supportNote = note?.trim() ?? null;

    const saved = await this.dataSource.getRepository(Dispute).save(dispute);
    this.logger.log(
      `[Dispute Support] Litige #${id} assigné à l'agent ${supportAgentId}`,
    );
    return saved;
  }

  /**
   * 🔒 Action Support Agent: Soumettre recommandation pour validation Admin
   */
  async submitRecommendation(
    id: string,
    supportAgentId: string,
    resolution: DisputeResolution,
    refundAmount?: number,
    note?: string,
  ): Promise<Dispute> {
    const dispute = await this.dataSource.getRepository(Dispute).findOne({
      where: { id },
    });
    if (!dispute) throw new NotFoundException('Litige introuvable');
    if (dispute.status !== DisputeStatus.UNDER_INVESTIGATION) {
      throw new ConflictException(
        "Ce litige n'est pas en cours d'investigation",
      );
    }

    dispute.status = DisputeStatus.PENDING_ADMIN_APPROVAL;
    dispute.supportAgentId = supportAgentId;
    dispute.resolution = resolution;
    dispute.refundAmount = refundAmount ?? null;
    dispute.supportNote = note?.trim() ?? null;

    const saved = await this.dataSource.getRepository(Dispute).save(dispute);
    this.logger.log(
      `[Dispute Support] Recommandation soumise pour litige #${id} - En attente validation Admin`,
    );
    return saved;
  }

  /**
   * 🔒 Action Admin: Approuver et exécuter le remboursement
   * SEUL LES ADMINS/SUPER ADMINS PEUVENT APPELER CETTE MÉTHODE
   */
  async approveRefund(
    id: string,
    adminId: string,
    note?: string,
  ): Promise<Dispute> {
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    let resolvedEvent: DisputeResolvedEvent | undefined;

    try {
      const dispute = await runner.manager.findOne(Dispute, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!dispute) throw new NotFoundException('Litige introuvable');
      if (dispute.status !== DisputeStatus.PENDING_ADMIN_APPROVAL) {
        throw new ConflictException(
          "Ce litige n'est pas en attente d'approbation",
        );
      }
      if (dispute.resolution !== DisputeResolution.REFUND) {
        throw new BadRequestException(
          "Ce litige n'a pas de recommandation de remboursement",
        );
      }

      const order = await runner.manager.findOne(Order, {
        where: { id: dispute.orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) throw new NotFoundException('Commande associée introuvable');

      const transaction = await runner.manager.findOne(Transaction, {
        where: { orderId: order.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!transaction || transaction.status !== TransactionStatus.SUCCESS) {
        throw new BadRequestException(
          "Aucun paiement remboursable n'est associé à cette commande",
        );
      }

      const refundAmount = dispute.refundAmount || Number(order.totalAmount);

      // 🔄 Mettre à jour le statut de la commande
      order.status = OrderStatus.REFUNDED;
      await runner.manager.save(order);

      transaction.status = TransactionStatus.REFUND_PENDING;
      await runner.manager.save(transaction);

      dispute.status = DisputeStatus.APPROVED;
      dispute.assignedAdminId = adminId;
      dispute.adminNote = note?.trim() ?? null;
      dispute.resolvedAt = new Date();
      const saved = await runner.manager.save(dispute);

      await runner.commitTransaction();

      // Événement émis UNIQUEMENT si le commit a réussi (sinon une
      // notification « litige traité » serait persistant pour un litige non
      // résolu).
      resolvedEvent = {
        disputeId: dispute.id,
        orderId: order.id,
        clientId: order.clientId,
        businessId: order.businessId ?? null,
        resolution: DisputeResolution.REFUND,
      };

      // 💳 Créditer le wallet du client (hors transaction pour éviter deadlock)
      try {
        const { wallet } = await this.walletService.creditWallet(
          order.clientId,
          WalletUserRole.CUSTOMER,
          refundAmount,
          TransactionReason.REFUND,
          order.id,
          `Remboursement litige #${dispute.id.slice(-8)} - commande #${order.id.slice(-8)}`,
        );

        this.logger.log(
          `[Dispute Refund] Wallet du client ${order.clientId} crédité de ${refundAmount} FCFA. Nouveau solde: ${wallet.balance}`,
        );

        // 📱 Notifier le client (dispatcher multi-canal : push + fallback email/SMS/WhatsApp)
        const client = await this.usersService.findById(order.clientId);
        if (client) {
          await this.notificationsService.sendNotification(
            client,
            'Remboursement effectué 💰',
            `Votre compte a été crédité de ${refundAmount.toLocaleString()} FCFA suite à votre réclamation.`,
            {
              orderId: order.id,
              disputeId: dispute.id,
              type: 'REFUND_CREDITED',
            },
          );
        }
      } catch (walletError) {
        this.logger.error(
          `[Dispute Refund Error] Erreur lors du crédit du wallet: ${walletError.message}`,
        );
        // Ne pas échouer toute la transaction si le wallet échoue
        // Le remboursement sera traité manuellement
      }

      return saved;
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
      if (resolvedEvent) this.events.emit(DISPUTE_RESOLVED, resolvedEvent);
    }
  }

  /**
   * 💸 Remboursement décidé par le gérant du commerce (seul).
   * - Uniquement sur les commandes de SES commerces (assertManagedBy).
   * - Uniquement si le litige est OPEN ou UNDER_INVESTIGATION : aucune décision
   *   support/admin déjà engagée (PENDING_ADMIN_APPROVAL → conflit).
   * - Montant borné au total de la commande (pas de sur-remboursement).
   * - Versement marchand déjà exécuté (payout SUCCESS) → escalade au circuit
   *   admin (PENDING_ADMIN_APPROVAL) : pas de double paiement.
   * - Commande → REFUNDED, wallet client crédité, traçabilité conservée
   *   (merchantRefundedBy / merchantRefundedAt / merchantNote).
   *
   * Économie : le client est crédité du total de la commande sans débit du
   * wallet marchand — le coût est porté par la trésorerie plateforme (même
   * choix que approveRefund). Décision produit assumée, documentée ici.
   */
  async merchantRefund(
    id: string,
    merchantId: string,
    role: string,
    note?: string,
  ): Promise<Dispute> {
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    let resolvedEvent: DisputeResolvedEvent | undefined;

    try {
      // Lecture sans verrou pour récupérer l'orderId, puis verrouillage
      // ORDER → DISPUTE → TRANSACTION (aligné sur open(), évite le deadlock
      // 40P01 entre open() et merchantRefund).
      const disputeRef = await runner.manager.findOne(Dispute, {
        where: { id },
      });
      if (!disputeRef) throw new NotFoundException('Litige introuvable');

      const order = await runner.manager.findOne(Order, {
        where: { id: disputeRef.orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) throw new NotFoundException('Commande associée introuvable');
      if (!order.businessId) {
        throw new ForbiddenException(
          "Cette commande n'est pas liée à un commerce",
        );
      }

      const dispute = await runner.manager.findOne(Dispute, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!dispute) throw new NotFoundException('Litige introuvable');

      // 🔐 Le gérant ne peut rembourser que les commandes de ses commerces.
      const normalizedRole = role.toLowerCase();
      await this.businessesService.assertManagedBy(
        order.businessId,
        merchantId,
        normalizedRole as UserRole,
      );

      if (
        dispute.status !== DisputeStatus.OPEN &&
        dispute.status !== DisputeStatus.UNDER_INVESTIGATION
      ) {
        throw new ConflictException(
          'Ce litige a déjà reçu une décision (support ou admin)',
        );
      }

      const transaction = await runner.manager.findOne(Transaction, {
        where: { orderId: order.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!transaction || transaction.status !== TransactionStatus.SUCCESS) {
        throw new BadRequestException(
          "Aucun paiement remboursable n'est associé à cette commande",
        );
      }

      // 🔒 Montant borné au total de la commande (pas de sur-remboursement).
      const refundAmount = Number(order.totalAmount);
      if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
        throw new BadRequestException(
          'Le montant de la commande est invalide pour un remboursement',
        );
      }

      // 🚫 Un payout en attente ou en échec est re-bloqué : empêche qu'un
      // retry post-remboursement verse le marchand alors que le client est
      // déjà remboursé.
      const payout = await runner.manager.findOne(MerchantPayout, {
        where: { orderId: order.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (
        payout &&
        [
          PayoutStatus.PENDING,
          PayoutStatus.PROCESSING,
          PayoutStatus.FAILED,
        ].includes(payout.status)
      ) {
        payout.status = PayoutStatus.BLOCKED;
        payout.failureReason =
          'Bloqué : remboursement décidé par le gérant du commerce';
        await runner.manager.save(payout);
      }

      // 💰 Versement marchand déjà exécuté : un remboursement auto-servi ferait
      // doubler le paiement (le gérant garde le virement ET le client est
      // crédité). La demande remonte au circuit admin pour arbitrage.
      if (payout?.status === PayoutStatus.SUCCESS) {
        dispute.status = DisputeStatus.PENDING_ADMIN_APPROVAL;
        dispute.resolution = DisputeResolution.REFUND;
        dispute.refundAmount = refundAmount;
        dispute.merchantNote =
          note?.trim() ||
          'Remboursement demandé par le gérant du commerce (versement marchand déjà exécuté)';
        const escalated = await runner.manager.save(dispute);
        await runner.commitTransaction();
        this.logger.log(
          `[Dispute Merchant Refund] Litige #${id} réorienté vers le circuit admin (commerce déjà payé)`,
        );
        return escalated;
      }

      order.status = OrderStatus.REFUNDED;
      await runner.manager.save(order);

      transaction.status = TransactionStatus.REFUND_PENDING;
      await runner.manager.save(transaction);

      dispute.status = DisputeStatus.APPROVED;
      dispute.resolution = DisputeResolution.REFUND;
      dispute.refundAmount = refundAmount;
      // La note du gérant va dans merchantNote (son canal), jamais dans
      // adminNote (audit de l'administration).
      dispute.merchantNote =
        note?.trim() || 'Remboursé par le gérant du commerce';
      dispute.merchantRefundedBy = merchantId;
      dispute.merchantRefundedAt = new Date();
      dispute.resolvedAt = new Date();
      const saved = await runner.manager.save(dispute);

      await runner.commitTransaction();

      // Événement émis UNIQUEMENT après commit réussi.
      resolvedEvent = {
        disputeId: dispute.id,
        orderId: order.id,
        clientId: order.clientId,
        businessId: order.businessId ?? null,
        resolution: DisputeResolution.REFUND,
      };

      // 💳 Créditer le wallet du client (hors transaction pour éviter deadlock)
      try {
        const { wallet } = await this.walletService.creditWallet(
          order.clientId,
          WalletUserRole.CUSTOMER,
          refundAmount,
          TransactionReason.REFUND,
          order.id,
          `Remboursement marchand litige #${dispute.id.slice(-8)} - commande #${order.id.slice(-8)}`,
        );
        this.logger.log(
          `[Dispute Merchant Refund] Wallet du client ${order.clientId} crédité de ${refundAmount} FCFA. Nouveau solde: ${wallet.balance}`,
        );

        // 📱 Notifier le client (dispatcher multi-canal : push + fallback)
        const client = await this.usersService.findById(order.clientId);
        if (client) {
          await this.notificationsService.sendNotification(
            client,
            'Remboursement effectué 💰',
            `Le commerce a remboursé votre commande : ${refundAmount.toLocaleString()} FCFA crédités sur votre compte.`,
            {
              orderId: order.id,
              disputeId: dispute.id,
              type: 'REFUND_CREDITED',
            },
          );
        }
      } catch (walletError) {
        this.logger.error(
          `[Dispute Merchant Refund Error] Erreur lors du crédit du wallet: ${walletError.message} (dispute #${dispute.id}, order #${order.id}, refundAmount ${refundAmount})`,
        );
        // Ne pas échouer toute la transaction si le wallet échoue
        // Le remboursement sera traité manuellement
      }

      return saved;
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
      if (resolvedEvent) this.events.emit(DISPUTE_RESOLVED, resolvedEvent);
    }
  }

  /**
   * 🔒 Action Admin: Rejeter définitivement un litige
   */
  async rejectDispute(
    id: string,
    adminId: string,
    note?: string,
  ): Promise<Dispute> {
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    let resolvedEvent: DisputeResolvedEvent | undefined;

    try {
      const dispute = await runner.manager.findOne(Dispute, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!dispute) throw new NotFoundException('Litige introuvable');
      if (
        dispute.status === DisputeStatus.APPROVED ||
        dispute.status === DisputeStatus.REJECTED
      ) {
        throw new ConflictException(
          'Ce litige a déjà reçu une décision finale',
        );
      }

      const order = await runner.manager.findOne(Order, {
        where: { id: dispute.orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) throw new NotFoundException('Commande associée introuvable');

      dispute.status = DisputeStatus.REJECTED;
      dispute.resolution = DisputeResolution.REJECT;
      dispute.assignedAdminId = adminId;
      dispute.adminNote = note?.trim() ?? null;
      dispute.resolvedAt = new Date();
      const saved = await runner.manager.save(dispute);

      order.status = OrderStatus.COMPLETED;
      await runner.manager.save(order);

      await runner.commitTransaction();

      // Événement émis UNIQUEMENT après commit réussi.
      resolvedEvent = {
        disputeId: dispute.id,
        orderId: order.id,
        clientId: order.clientId,
        businessId: order.businessId ?? null,
        resolution: DisputeResolution.REJECT,
      };

      this.logger.log(
        `[Dispute Reject] Litige #${id} rejeté par admin ${adminId} - Commande #${order.id} marquée COMPLETED`,
      );

      return saved;
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
      if (resolvedEvent) this.events.emit(DISPUTE_RESOLVED, resolvedEvent);
    }
  }

  /**
   * 🔒 Ancienne méthode review (deprecated - utiliser approveRefund/rejectDispute)
   * Gardée pour compatibilité, mais remplace le remboursement auto par PENDING_ADMIN_APPROVAL
   */
  async review(
    id: string,
    adminId: string,
    dto: ReviewDisputeDto,
  ): Promise<Dispute> {
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();

    try {
      const dispute = await runner.manager.findOne(Dispute, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!dispute) throw new NotFoundException('Litige introuvable');

      if (
        ![
          DisputeStatus.OPEN,
          DisputeStatus.UNDER_INVESTIGATION,
          DisputeStatus.PENDING_ADMIN_APPROVAL,
        ].includes(dispute.status)
      ) {
        throw new ConflictException('Ce litige a déjà reçu une décision');
      }

      const order = await runner.manager.findOne(Order, {
        where: { id: dispute.orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) throw new NotFoundException('Commande associée introuvable');

      const refundAmount = dto.refundAmount || Number(order.totalAmount);
      dispute.refundAmount = refundAmount;
      dispute.assignedAdminId = adminId;
      dispute.adminNote = dto.note?.trim() ?? null;
      dispute.resolution = dto.resolution;
      dispute.resolvedAt = new Date();

      let saved: Dispute;

      if (dto.resolution === DisputeResolution.REFUND) {
        // 🚨 IMPORTANT: Marquer PENDING_ADMIN_APPROVAL au lieu de rembourser directement
        dispute.status = DisputeStatus.PENDING_ADMIN_APPROVAL;
        saved = await runner.manager.save(dispute);
        await runner.commitTransaction();

        this.logger.log(
          `[Dispute Review] Litige #${id} marqué PENDING_ADMIN_APPROVAL - En attente validation Admin pour remboursement de ${refundAmount} FCFA`,
        );
      } else {
        dispute.status = DisputeStatus.REJECTED;
        order.status = OrderStatus.COMPLETED;
        await runner.manager.save(order);
        saved = await runner.manager.save(dispute);
        await runner.commitTransaction();

        this.logger.log(
          `[Dispute Review] Litige #${id} rejeté - Commande #${order.id} marquée COMPLETED`,
        );
      }

      return saved;
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }
}
