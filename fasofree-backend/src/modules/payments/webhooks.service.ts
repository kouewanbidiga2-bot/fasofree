import {
  Injectable,
  Logger,
  UnauthorizedException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as crypto from 'crypto';
import Redis from 'ioredis';

import { Order, OrderStatus } from '../orders/entities/order.entity';
import {
  FinancialLedger,
  LedgerEntryType,
} from './entities/financial-ledger.entity';
import { PayoutsService } from './payouts.service';

export interface MobileMoneyWebhookPayload {
  transactionRef: string;
  orderId: string;
  status: 'SUCCESS' | 'FAILED';
  amount: number;
  signature: string;
  timestamp: number;
}

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(FinancialLedger)
    private readonly ledgerRepository: Repository<FinancialLedger>,
    @Inject('REDIS_CLIENT') private readonly redis: Redis, // 👈 Token standard
    private readonly configService: ConfigService,
    private readonly payoutsService: PayoutsService,
    private readonly dataSource: DataSource,
  ) {}

  public verifyHmacSignature(
    payload: MobileMoneyWebhookPayload,
    receivedSignature: string,
  ): boolean {
    const secret = this.configService.get<string>('PAYMENT_WEBHOOK_SECRET');
    if (!secret) return false;
    const canonicalString = `${payload.transactionRef}:${payload.orderId}:${payload.amount}:${payload.timestamp}`;

    const computedSignature = crypto
      .createHmac('sha256', secret)
      .update(canonicalString)
      .digest('hex');

    const expected = Buffer.from(computedSignature);
    const received = Buffer.from(receivedSignature);
    return (
      expected.length === received.length &&
      crypto.timingSafeEqual(expected, received)
    );
  }

  async processPaymentWebhook(
    payload: MobileMoneyWebhookPayload,
  ): Promise<{ processed: boolean }> {
    const lockKey = `lock:webhook:${payload.transactionRef}`;

    // 👈 Ordre des paramètres ioredis corrigé: key, value, 'EX', seconds, 'NX'
    const acquiredLock = await this.redis.set(
      lockKey,
      'LOCKED',
      'EX',
      10,
      'NX',
    );
    if (!acquiredLock) {
      this.logger.warn(
        `[Race Condition Prevented] Webhook déjà en cours de traitement pour Ref: ${payload.transactionRef}`,
      );
      throw new ConflictException(
        'Traitement de la transaction déjà en cours.',
      );
    }

    try {
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        const order = await queryRunner.manager.findOne(Order, {
          where: { id: payload.orderId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!order) {
          throw new UnauthorizedException(
            `Commande #${payload.orderId} introuvable.`,
          );
        }

        if (order.status !== OrderStatus.PENDING) {
          this.logger.log(
            `[Idempotent Skip] Commande #${order.id} déjà au statut ${order.status}`,
          );
          await queryRunner.rollbackTransaction();
          return { processed: true };
        }

        if (payload.status === 'SUCCESS') {
          order.status = OrderStatus.PAID;
          order.paymentTransactionRef = payload.transactionRef;
          await queryRunner.manager.save(order);

          const clientCredit = queryRunner.manager.create(FinancialLedger, {
            transactionRef: payload.transactionRef,
            accountOwnerId: order.clientId,
            amount: payload.amount,
            entryType: LedgerEntryType.CREDIT,
            description: `Paiement reçu pour commande #${order.id}`,
          });

          const platformFeeEntry = queryRunner.manager.create(FinancialLedger, {
            transactionRef: payload.transactionRef,
            accountOwnerId: 'PLATFORM_FASOFREE',
            amount: order.platformCommission,
            entryType: LedgerEntryType.CREDIT,
            description: `Commission FasoFree (0.85%) sur commande #${order.id}`,
          });

          await queryRunner.manager.save([clientCredit, platformFeeEntry]);
          await queryRunner.commitTransaction();
          this.logger.log(
            `[Payment Settled] Commande #${order.id} marquée PAID avec succès.`,
          );
        } else {
          order.status = OrderStatus.CANCELLED;
          await queryRunner.manager.save(order);
          await queryRunner.commitTransaction();
        }
      } catch (err) {
        await queryRunner.rollbackTransaction();
        throw err;
      } finally {
        await queryRunner.release();
      }
    } finally {
      await this.redis.del(lockKey);
    }

    return { processed: true };
  }
}
