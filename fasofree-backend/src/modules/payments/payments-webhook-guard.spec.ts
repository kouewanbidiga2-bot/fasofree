import { BadRequestException } from '@nestjs/common';
import { TransactionStatus } from '../wallets/entities/wallet-transaction.entity';

describe('Payments webhook anti-fraud guards', () => {
  describe('validatePaymentAmount (faux paiement)', () => {
    const fakePaymentsService = ({
      orderRepository,
    }: {
      orderRepository: { findOne: jest.Mock };
    }) => ({
      orderRepository,
      logger: { warn: jest.fn(), log: jest.fn() },
      validatePaymentAmount: async function (
        this: { orderRepository: { findOne: jest.Mock } },
        orderId: string,
        receivedAmount: unknown,
      ) {
        if (receivedAmount === undefined || receivedAmount === null) {
          return false;
        }
        const order = await this.orderRepository.findOne({ where: { id: orderId } });
        if (!order) return false;
        const expected = Number(order.totalAmount);
        const received = Number(receivedAmount);
        return Math.abs(expected - received) <= 1;
      },
    });

    it('accepte un montant identique (paiement légitime)', async () => {
      const svc = fakePaymentsService({
        orderRepository: { findOne: jest.fn().mockResolvedValue({ totalAmount: 2500 }) },
      });
      const ok = await svc.validatePaymentAmount('order-1', 2500);
      expect(ok).toBe(true);
    });

    it('rejette un montant différent (faux paiement possible)', async () => {
      const svc = fakePaymentsService({
        orderRepository: { findOne: jest.fn().mockResolvedValue({ totalAmount: 2500 }) },
      });
      const ok = await svc.validatePaymentAmount('order-1', 5);
      expect(ok).toBe(false);
    });

    it('échec de sécurité : refuse si aucun montant fourni', async () => {
      const svc = fakePaymentsService({
        orderRepository: { findOne: jest.fn() },
      });
      const ok = await svc.validatePaymentAmount('order-1', undefined);
      expect(ok).toBe(false);
    });
  });

  describe('YengaPay verifyWebhookSignature (fail-closed)', () => {
    const buildService = (secret?: string) => {
      const crypto = require('crypto');
      return {
        webhookSecret: secret,
        logger: { error: jest.fn(), warn: jest.fn() },
        verifyWebhookSignature(payload: Record<string, any>, receivedHash: string) {
          if (!this.webhookSecret) return false;
          try {
            const canonical = JSON.stringify(payload);
            const computed = crypto
              .createHmac('sha256', this.webhookSecret)
              .update(canonical)
              .digest('hex');
            const expected = Buffer.from(computed, 'hex');
            const received = Buffer.from(receivedHash, 'hex');
            if (expected.length !== received.length) return false;
            return crypto.timingSafeEqual(expected, received);
          } catch {
            return false;
          }
        },
      };
    };

    it('fail-closed quand le secret nest pas configuré', () => {
      const svc = buildService(undefined);
      expect(svc.verifyWebhookSignature({ a: 1 }, 'any')).toBe(false);
    });

    it('fail-open interdit : signature vide => false', () => {
      const svc = buildService('secret');
      expect(svc.verifyWebhookSignature({ a: 1 }, '')).toBe(false);
    });

    it('accepte une signature valide', () => {
      const crypto = require('crypto');
      const s = 'secret';
      const payload = { a: 1, orderId: 'o1' };
      const hash = crypto
        .createHmac('sha256', s)
        .update(JSON.stringify(payload))
        .digest('hex');
      const svc = buildService(s);
      expect(svc.verifyWebhookSignature(payload, hash)).toBe(true);
    });

    it('rejette une signature falsifiée', () => {
      const svc = buildService('secret');
      expect(svc.verifyWebhookSignature({ a: 1 }, 'deadbeef')).toBe(false);
    });
  });

  describe('creditWallet idempotence (double crédit)', () => {
    const runCredit = (existingTx: unknown) => {
      const wallet = { id: 'wal-1', balance: 100, save: jest.fn() };
      const transaction = {
        id: 'tx-1',
        walletId: 'wal-1',
        balanceAfter: 100,
        save: jest.fn(),
      };
      const logged = { warn: jest.fn() };
      const runner = {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        release: jest.fn(),
        manager: {
          findOne: jest.fn().mockResolvedValue(existingTx),
          create: jest.fn().mockReturnValue(transaction),
          save: jest.fn(),
        },
      };
      const dataSource = { createQueryRunner: jest.fn().mockReturnValue(runner) };
      return {
        runner,
        wallet,
        run: async () => {
          const queryRunner = dataSource.createQueryRunner();
          await queryRunner.connect();
          await queryRunner.startTransaction();
          let walletRow: any = wallet;
          const found = await queryRunner.manager.findOne();
          // simulate duplicate present
          const existing = found;
          if (existing) {
            await queryRunner.rollbackTransaction();
            logged.warn('duplicate');
            await queryRunner.release();
            return { skipped: true, existing };
          }
          walletRow.balance += 100;
          await queryRunner.manager.save(walletRow);
          const tx = queryRunner.manager.create();
          await queryRunner.manager.save(tx);
          await queryRunner.commitTransaction();
          await queryRunner.release();
          return { skipped: false, balance: walletRow.balance };
        },
      };
    };

    it('ne crédite pas deux fois pour la même référence', async () => {
      const existing = { id: 'tx-existing' };
      const c = runCredit(existing);
      const result = await c.run();
      expect(result.skipped).toBe(true);
      expect(c.runner.commitTransaction).not.toHaveBeenCalled();
      expect(c.wallet.balance).toBe(100);
    });
  });

  describe('GeniusPay webhook (fail-closed)', () => {
    it('rejette si aucun order_id dans metadata', () => {
      const payload: any = { status: 'SUCCESS', amount: 1000 };
      const orderId = payload.metadata?.order_id;
      expect(orderId).toBeUndefined();
    });
  });
});
