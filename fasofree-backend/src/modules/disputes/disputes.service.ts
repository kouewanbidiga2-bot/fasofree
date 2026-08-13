import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
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

@Injectable()
export class DisputesService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly events: EventEmitter2,
  ) {}

  async open(
    orderId: string,
    clientId: string,
    dto: CreateDisputeDto,
  ): Promise<Dispute> {
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
          adminNote: null,
          resolution: null,
          resolvedAt: null,
        }),
      );
      order.status = OrderStatus.DISPUTED;
      await runner.manager.save(order);

      const payout = await runner.manager.findOne(MerchantPayout, {
        where: { orderId },
        lock: { mode: 'pessimistic_write' },
      });
      // Un virement déjà confirmé ne peut pas être annulé localement : il sera traité
      // par le remboursement explicite lors de la décision de l'administrateur.
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

  async review(
    id: string,
    adminId: string,
    dto: ReviewDisputeDto,
  ): Promise<Dispute> {
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    let event:
      (DisputeOpenedEvent & { resolution: DisputeResolution }) | undefined;
    try {
      const dispute = await runner.manager.findOne(Dispute, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!dispute) throw new NotFoundException('Litige introuvable');
      if (
        ![DisputeStatus.OPEN, DisputeStatus.UNDER_REVIEW].includes(
          dispute.status,
        )
      ) {
        throw new ConflictException('Ce litige a déjà reçu une décision');
      }
      const order = await runner.manager.findOne(Order, {
        where: { id: dispute.orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) throw new NotFoundException('Commande associée introuvable');
      dispute.assignedAdminId = adminId;
      dispute.adminNote = dto.note?.trim() ?? null;
      dispute.resolution = dto.resolution;
      dispute.resolvedAt = new Date();
      if (dto.resolution === DisputeResolution.REFUND) {
        const transaction = await runner.manager.findOne(Transaction, {
          where: { orderId: order.id },
          lock: { mode: 'pessimistic_write' },
        });
        if (!transaction || transaction.status !== TransactionStatus.SUCCESS) {
          throw new BadRequestException(
            'Aucun paiement remboursable n’est associé à cette commande',
          );
        }
        // La passerelle est appelée par le worker de remboursement; cette transition bloque
        // toute relivraison ou nouveau payout avant sa confirmation par webhook.
        transaction.status = TransactionStatus.REFUND_PENDING;
        await runner.manager.save(transaction);
        dispute.status = DisputeStatus.RESOLVED_REFUND;
      } else {
        dispute.status = DisputeStatus.RESOLVED_REJECTED;
        order.status = OrderStatus.COMPLETED;
      }
      await runner.manager.save(order);
      const saved = await runner.manager.save(dispute);
      event = {
        disputeId: saved.id,
        orderId: saved.orderId,
        clientId: saved.clientId,
        businessId: order.businessId,
        resolution: dto.resolution,
      };
      await runner.commitTransaction();
      return saved;
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
      if (event) this.events.emit(DISPUTE_RESOLVED, event);
    }
  }
}
