import { WalletService } from './wallet.service';
import {
  TransactionReason,
  TransactionType,
} from './entities/wallet-transaction.entity';
import { UserRole } from './entities/wallet.entity';

/**
 * 🧪 Lot 4 (chantier B) — crédit MANUEL d'un portefeuille par le Super Admin.
 *
 * Réutilise la logique ACID de `creditWallet` : ces tests verrouillent le motif
 * (`TOPUP`), le type d'écriture (`CREDIT`) et l'idempotence par référence.
 */
const buildService = (): WalletService =>
  new WalletService(
    {} as any, // walletRepository
    {} as any, // transactionRepository
    {} as any, // orderRepository
    {} as any, // businessRepository
    {} as any, // payoutRequestRepository
    {} as any, // dataSource
    {} as any, // configService
  );

describe('WalletService.adminCreditWallet (crédit manuel Super Admin)', () => {
  it('crédite via creditWallet avec le motif TOPUP et la référence fournie', async () => {
    const svc = buildService();
    const spy = jest.spyOn(svc, 'creditWallet').mockResolvedValue({
      wallet: { id: 'w1' } as any,
      transaction: { id: 't1' } as any,
    });

    const result = await svc.adminCreditWallet({
      userId: 'biz-1',
      userRole: UserRole.MERCHANT,
      amount: 15000,
      reason: 'Virement reçu',
      reference: 'RECU-1',
      actorId: 'admin-1',
    });

    expect(spy).toHaveBeenCalledWith(
      'biz-1',
      UserRole.MERCHANT,
      15000,
      TransactionReason.TOPUP,
      'RECU-1',
      expect.stringContaining('Virement reçu'),
      TransactionType.CREDIT,
      undefined,
    );
    expect(result.wallet.id).toBe('w1');
  });

  it('génère une référence ADMIN-CREDIT quand aucune n’est fournie', async () => {
    const svc = buildService();
    const spy = jest.spyOn(svc, 'creditWallet').mockResolvedValue({
      wallet: {} as any,
      transaction: {} as any,
    });

    await svc.adminCreditWallet({
      userId: 'biz-1',
      userRole: UserRole.MERCHANT,
      amount: 5000,
    });

    const reference = spy.mock.calls[0][4] as string;
    expect(reference).toMatch(/^ADMIN-CREDIT-/);
  });

  it('transmet l’agence (branchId) pour créditer un portefeuille de branche', async () => {
    const svc = buildService();
    const spy = jest.spyOn(svc, 'creditWallet').mockResolvedValue({
      wallet: {} as any,
      transaction: {} as any,
    });

    await svc.adminCreditWallet({
      userId: 'agence-1',
      userRole: UserRole.MERCHANT,
      amount: 1000,
      branchId: 'branch-7',
    });

    expect(spy).toHaveBeenCalledWith(
      'agence-1',
      UserRole.MERCHANT,
      1000,
      TransactionReason.TOPUP,
      expect.any(String),
      expect.any(String),
      TransactionType.CREDIT,
      'branch-7',
    );
  });
});
