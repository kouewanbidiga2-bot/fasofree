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
import { DataSource } from 'typeorm';
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
import {
  DISPUTE_OPENED,
  DISPUTE_RESOLVED,
  DisputeOpenedEvent,
} from './events/dispute.events';
import { WalletService } from '../wallets/wallet.service';
import { UserRole as WalletUserRole } from '../wallets/entities/wallet.entity';
import { TransactionReason } from '../wallets/entities/wallet-transaction.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class DisputesService {
  private readonly logger = new Logger(DisputesService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly events: EventEmitter2,
    private readonly walletService: WalletService,
    private readonly notificationsService: NotificationsService,
    private readonly usersService: UsersService,
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

  async list(status?: DisputeStatus): Promise<Dispute[]> {
    return this.dataSource.getRepository(Dispute).find({
      where: status ? { status } : {},
      order: { createdAt: 'DESC' },
    });
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

        // 📱 Notifier le client
        const client = await this.usersService.findById(order.clientId);
        if (client?.fcmToken) {
          await this.notificationsService.sendToDevice(client.fcmToken, {
            title: 'Remboursement effectué 💰',
            body: `Votre compte a été crédité de ${refundAmount.toLocaleString()} FCFA suite à votre réclamation.`,
            data: {
              orderId: order.id,
              disputeId: dispute.id,
              type: 'REFUND_CREDITED',
            },
          });
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

      this.logger.log(
        `[Dispute Reject] Litige #${id} rejeté par admin ${adminId} - Commande #${order.id} marquée COMPLETED`,
      );

      return saved;
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
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
