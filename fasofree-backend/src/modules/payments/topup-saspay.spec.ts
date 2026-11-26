/**
 * Copyright (c) 2026 BIDIGA Imrane - Koliwa. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { PaymentsService } from './payments.service';
import { TopupStatus } from './entities/topup-request.entity';
import { TransactionReason, TransactionType } from '../wallets/entities/wallet-transaction.entity';

type Repo = Record<string, jest.Mock>;

const makeRepo = (overrides: Partial<Repo> = {}): Repo => ({
  findOne: jest.fn(),
  save: jest.fn(async (x: any) => ({ id: 'topup-1', ...x })),
  create: jest.fn((x: any) => x),
  update: jest.fn(async () => ({ affected: 1 })),
  ...overrides,
});

const build = (opts: { topup?: any; affected?: number; creditError?: Error; sasPay?: Partial<Record<string, jest.Mock>> } = {}) => {
  const topupRepo = makeRepo({
    findOne: jest.fn(async () => opts.topup ?? null),
    update: jest.fn(async () => ({ affected: opts.affected ?? 1 })),
  });
  const walletService = {
    creditWallet: jest.fn(async () => {
      if (opts.creditError) throw opts.creditError;
      return {};
    }),
  };
  const sasPayService = {
    defaultCountry: 'BF',
    createPayment: jest.fn(async () => ({ id: 'sp-1', status: 'PENDING', checkoutUrl: 'https://pay.saspay.me/x', message: '' })),
    ...(opts.sasPay ?? {}),
  };
  const configService = { get: jest.fn(() => 'https://fasofree.site') };
  const svc = new PaymentsService(
    makeRepo() as any,
    makeRepo() as any,
    topupRepo as any,
    configService as any,
    {} as any,
    sasPayService as any,
    walletService as any,
  );
  return { svc, topupRepo, walletService, sasPayService };
};

const pendingTopup = {
  id: 'topup-1',
  reference: 'TOPUP-abc',
  providerPaymentId: 'sp-1',
  userId: 'user-1',
  walletRole: 'MERCHANT',
  branchId: null,
  amount: 5000,
  status: TopupStatus.PENDING,
};

describe('Recharge SasPay — settleTopupFromSasPay', () => {
  it('crédite une fois le montant enregistré (pas celui du webhook)', async () => {
    const { svc, walletService, topupRepo } = build({ topup: pendingTopup });

    const handled = await svc.settleTopupFromSasPay('sp-1', 'SUCCESS');

    expect(handled).toBe(true);
    expect(topupRepo.update).toHaveBeenCalledWith(
      { id: 'topup-1', status: TopupStatus.PENDING },
      { status: TopupStatus.CREDITED },
    );
    expect(walletService.creditWallet).toHaveBeenCalledWith(
      'user-1',
      'MERCHANT',
      5000,
      TransactionReason.TOPUP,
      'TOPUP-abc',
      expect.any(String),
      TransactionType.DEPOSIT,
      undefined,
    );
  });

  it("ne crédite pas un webhook rejoué (passage conditionnel déjà consommé)", async () => {
    const { svc, walletService } = build({ topup: pendingTopup, affected: 0 });

    const handled = await svc.settleTopupFromSasPay('sp-1', 'SUCCESS');

    expect(handled).toBe(true);
    expect(walletService.creditWallet).not.toHaveBeenCalled();
  });

  it('remet la recharge en PENDING si le crédit wallet échoue (un nouveau webhook réessaiera)', async () => {
    const { svc, topupRepo } = build({ topup: pendingTopup, creditError: new Error('wallet KO') });

    await expect(svc.settleTopupFromSasPay('sp-1', 'SUCCESS')).rejects.toThrow('wallet KO');
    expect(topupRepo.update).toHaveBeenLastCalledWith('topup-1', { status: TopupStatus.PENDING });
  });

  it('marque la recharge FAILED sur échec, sans créditer', async () => {
    const { svc, walletService, topupRepo } = build({ topup: pendingTopup });

    await svc.settleTopupFromSasPay('sp-1', 'FAILED');

    expect(topupRepo.update).toHaveBeenCalledWith(
      { id: 'topup-1', status: TopupStatus.PENDING },
      { status: TopupStatus.FAILED },
    );
    expect(walletService.creditWallet).not.toHaveBeenCalled();
  });

  it("retourne false si le paiement n'est pas une recharge (il appartient à une commande)", async () => {
    const { svc, walletService } = build({ topup: null });

    const handled = await svc.settleTopupFromSasPay('inconnu', 'SUCCESS');

    expect(handled).toBe(false);
    expect(walletService.creditWallet).not.toHaveBeenCalled();
  });
});

describe('Recharge SasPay — createTopup', () => {
  it('persiste la demande PENDING puis enregistre l’id du paiement SasPay', async () => {
    const { svc, topupRepo, sasPayService } = build();

    const result = await svc.createTopup({
      userId: 'user-1',
      role: 'MERCHANT',
      amount: 5000,
      paymentMethod: 'orange_money',
      customerName: 'Awa',
      customerEmail: 'awa@example.com',
    });

    expect(result.checkoutUrl).toBe('https://pay.saspay.me/x');
    expect(result.reference).toMatch(/^TOPUP-/);
    expect(sasPayService.createPayment).toHaveBeenCalledWith(
      expect.objectContaining({ network: 'orange_bf', country: 'BF', amount: 5000 }),
    );
    expect(topupRepo.update).toHaveBeenCalledWith('topup-1', { providerPaymentId: 'sp-1' });
  });

  it('marque la demande FAILED si SasPay est injoignable', async () => {
    const { svc, topupRepo } = build({
      sasPay: {
        createPayment: jest.fn(async () => {
          throw new Error('timeout');
        }),
      },
    });

    await expect(
      svc.createTopup({ userId: 'user-1', role: 'MERCHANT', amount: 5000, paymentMethod: 'moov_money' }),
    ).rejects.toThrow('Impossible de contacter la passerelle');
    expect(topupRepo.update).toHaveBeenCalledWith('topup-1', { status: TopupStatus.FAILED });
  });

  it('refuse un moyen de paiement non disponible au Burkina Faso', async () => {
    const { svc, sasPayService } = build();

    await expect(
      svc.createTopup({ userId: 'user-1', role: 'MERCHANT', amount: 5000, paymentMethod: 'wave' }),
    ).rejects.toThrow('indisponible au Burkina Faso');
    expect(sasPayService.createPayment).not.toHaveBeenCalled();
  });
});
