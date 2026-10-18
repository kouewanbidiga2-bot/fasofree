import { GeniusPayController } from './geniuspay.controller';
import { PaymentsService } from './payments.service';
import { PaydunyaService } from './providers/paydunya.service';
import {
  TransactionReason,
  TransactionType,
} from '../wallets/entities/wallet-transaction.entity';
import { UserRole as WalletUserRole } from '../wallets/entities/wallet.entity';

/**
 * 🧪 Lot 4 — financement des portefeuilles.
 *
 * Avant ce correctif, une RECHARGE (top-up) encaissée par GeniusPay n'était
 * jamais créditée : le webhook exigeait `metadata.order_id`, absent pour une
 * recharge, et levait une exception. Ces tests verrouillent le nouveau chemin.
 */
const buildPaymentsService = () => {
  const walletService = {
    creditWallet: jest.fn().mockResolvedValue({ wallet: {}, transaction: {} }),
    hasLedgerEntry: jest.fn().mockResolvedValue(false),
    debitWalletAllowNegative: jest
      .fn()
      .mockResolvedValue({ wallet: {}, transaction: {} }),
  };
  const paydunyaService = {
    isConfigured: jest.fn().mockReturnValue(false),
    createCheckoutInvoice: jest.fn(),
    confirmInvoiceStatus: jest.fn(),
    verifyIpnSignature: jest.fn(),
    executePayout: jest.fn(),
  };

  const svc = new PaymentsService(
    {} as any, // transactionRepository
    {} as any, // orderRepository
    {} as any, // configService
    {} as any, // ordersService
    {} as any, // geniusPayService
    paydunyaService as any,
    walletService as any,
  );

  return { svc, walletService, paydunyaService };
};

describe('PaymentsService — crédit d’une recharge (top-up) via webhook', () => {
  it('crédite le portefeuille MARCHAND d’un business_admin', async () => {
    const { svc, walletService } = buildPaymentsService();

    const ok = await svc.creditTopupFromGateway(
      {
        status: 'completed',
        amount: 5000,
        reference: 'GP-123',
        metadata: {
          type: 'topup',
          userId: 'u1',
          reference: 'TOPUP-1',
          walletRole: 'business_admin',
        },
      },
      {},
    );

    expect(ok).toBe(true);
    expect(walletService.creditWallet).toHaveBeenCalledTimes(1);
    expect(walletService.creditWallet).toHaveBeenCalledWith(
      'u1',
      WalletUserRole.MERCHANT,
      5000,
      TransactionReason.TOPUP,
      'TOPUP-1',
      expect.stringContaining('GeniusPay'),
      TransactionType.DEPOSIT,
      undefined,
    );
  });

  it('mappe une AGENCE vers le portefeuille MARCHAND et transmet l’agence', async () => {
    const { svc, walletService } = buildPaymentsService();

    await svc.creditTopupFromGateway(
      {
        status: 'completed',
        amount: 10000,
        metadata: {
          type: 'topup',
          userId: 'agence-1',
          reference: 'TOPUP-2',
          walletRole: 'agency',
          branchId: 'branch-9',
        },
      },
      {},
    );

    expect(walletService.creditWallet).toHaveBeenCalledWith(
      'agence-1',
      WalletUserRole.MERCHANT,
      10000,
      TransactionReason.TOPUP,
      'TOPUP-2',
      expect.any(String),
      TransactionType.DEPOSIT,
      'branch-9',
    );
  });

  it('ne crédite JAMAIS si le statut agrégateur n’est pas « completed »', async () => {
    const { svc, walletService } = buildPaymentsService();

    const ok = await svc.creditTopupFromGateway(
      {
        status: 'pending',
        amount: 5000,
        metadata: { type: 'topup', userId: 'u1', reference: 'TOPUP-3' },
      },
      {},
    );

    expect(ok).toBe(false);
    expect(walletService.creditWallet).not.toHaveBeenCalled();
  });

  it('ne crédite pas un montant nul ou invalide', async () => {
    const { svc, walletService } = buildPaymentsService();

    const ok = await svc.creditTopupFromGateway(
      {
        status: 'completed',
        amount: 0,
        metadata: { type: 'topup', userId: 'u1', reference: 'TOPUP-4' },
      },
      {},
    );

    expect(ok).toBe(false);
    expect(walletService.creditWallet).not.toHaveBeenCalled();
  });

  it('refuse un metadata sans userId (crédit impossible à attribuer)', async () => {
    const { svc, walletService } = buildPaymentsService();

    const ok = await svc.creditTopupFromGateway(
      {
        status: 'completed',
        amount: 5000,
        metadata: { type: 'topup', reference: 'TOPUP-5' },
      },
      {},
    );

    expect(ok).toBe(false);
    expect(walletService.creditWallet).not.toHaveBeenCalled();
  });
});

describe('PaymentsService — remboursement d’une recharge', () => {
  it('ne reprend pas deux fois le même montant (idempotence)', async () => {
    const { svc, walletService } = buildPaymentsService();
    walletService.hasLedgerEntry.mockResolvedValue(true);

    const ok = await svc.reverseTopupFromGateway(
      {
        metadata: {
          type: 'topup',
          userId: 'u1',
          reference: 'TOPUP-1',
          walletRole: 'merchant',
        },
        amount: 5000,
      },
      {},
    );

    expect(ok).toBe(false);
    expect(walletService.debitWalletAllowNegative).not.toHaveBeenCalled();
  });

  it('débite en autorisant le négatif, avec une référence dédiée', async () => {
    const { svc, walletService } = buildPaymentsService();

    const ok = await svc.reverseTopupFromGateway(
      {
        metadata: {
          type: 'topup',
          userId: 'u1',
          reference: 'TOPUP-1',
          walletRole: 'merchant',
        },
        amount: 5000,
      },
      {},
    );

    expect(ok).toBe(true);
    expect(walletService.debitWalletAllowNegative).toHaveBeenCalledWith(
      'u1',
      WalletUserRole.MERCHANT,
      5000,
      TransactionReason.REFUND,
      'TOPUP-REFUND-TOPUP-1',
      expect.any(String),
      undefined,
    );
  });

  it('n’échoue jamais si le débit est impossible (webhook tolérant)', async () => {
    const { svc, walletService } = buildPaymentsService();
    walletService.debitWalletAllowNegative.mockRejectedValue(
      new Error('portefeuille introuvable'),
    );

    const ok = await svc.reverseTopupFromGateway(
      {
        metadata: { type: 'topup', userId: 'u1', reference: 'TOPUP-1' },
        amount: 5000,
      },
      {},
    );

    expect(ok).toBe(false);
  });
});

describe('GeniusPayController — routage du webhook de recharge', () => {
  const buildController = () => {
    const paymentsService = {
      creditTopupFromGateway: jest.fn().mockResolvedValue(true),
      reverseTopupFromGateway: jest.fn().mockResolvedValue(true),
    };
    const ordersService = {
      markOrderAsRefunded: jest.fn(),
      markAsPaymentFailed: jest.fn(),
    };
    const transactionRepository = { findOne: jest.fn(), update: jest.fn() };

    const controller = new GeniusPayController(
      {} as any, // geniusPayService
      paymentsService as any,
      {} as any, // configService
      ordersService as any,
      {} as any, // orderRepository
      transactionRepository as any,
    );

    return {
      controller,
      paymentsService,
      ordersService,
      transactionRepository,
    };
  };

  it('route un payment.success de recharge vers le crédit, sans exiger order_id', async () => {
    const { controller, paymentsService } = buildController();

    await (controller as any).handlePaymentSuccess({
      data: {
        status: 'completed',
        amount: 5000,
        metadata: { type: 'topup', userId: 'u1', reference: 'TOPUP-1' },
      },
    });

    expect(paymentsService.creditTopupFromGateway).toHaveBeenCalledTimes(1);
  });

  it('route un remboursement de recharge vers la reprise du montant', async () => {
    const { controller, paymentsService, ordersService } = buildController();

    await (controller as any).handlePaymentRefunded({
      data: {
        metadata: { type: 'topup', userId: 'u1', reference: 'TOPUP-1' },
        amount: 5000,
      },
    });

    expect(paymentsService.reverseTopupFromGateway).toHaveBeenCalledTimes(1);
    expect(ordersService.markOrderAsRefunded).not.toHaveBeenCalled();
  });

  it('payment.refunded SANS order_id ne rembourse AUCUNE commande', async () => {
    const { controller, ordersService, transactionRepository } =
      buildController();

    await (controller as any).handlePaymentRefunded({
      data: { reference: 'GP-X' },
    });

    expect(transactionRepository.findOne).not.toHaveBeenCalled();
    expect(ordersService.markOrderAsRefunded).not.toHaveBeenCalled();
  });
});
