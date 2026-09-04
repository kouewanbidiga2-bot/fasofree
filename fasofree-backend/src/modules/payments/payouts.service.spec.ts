import { DataSource } from 'typeorm';
import { PayoutsService } from './payouts.service';
import { PayoutStatus } from './entities/merchant-payout.entity';
import { OrderStatus } from '../orders/entities/order.entity';

const dupError = Object.assign(
  new Error('duplicate key value violates unique constraint "UQ_merchant_payouts_orderId"'),
  { code: '23505' },
);

describe('PayoutsService — un escrow ne peut jamais produire deux paiements', () => {
  const orderRepo: any = { findOne: jest.fn() };
  const businessRepo: any = { findOne: jest.fn() };
  const payoutRepo: any = {
    findOne: jest.fn(),
    create: (o: any) => o,
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const dataSource = {} as DataSource;
  const configService: any = { get: jest.fn().mockReturnValue('true') };

  const makeService = () => {
    const service = new PayoutsService(
      payoutRepo,
      orderRepo,
      businessRepo,
      dataSource,
      configService,
    );
    let transfers = 0;
    (service as any).executeMobileMoneyTransfer = jest
      .fn()
      .mockImplementation(async () => {
        transfers += 1;
        return { transactionRef: `TX-${transfers}` };
      });
    return { service, count: () => transfers };
  };

  const order = {
    id: 'o1',
    status: OrderStatus.COMPLETED,
    businessId: 'b1',
    merchantPayoutAmount: 1000,
  };

  beforeEach(() => {
    jest.resetAllMocks();
    orderRepo.findOne.mockResolvedValue(order);
    businessRepo.findOne.mockResolvedValue({
      id: 'b1',
      mobileMoneyNumber: '+22670000000',
    });
    payoutRepo.create = (o: any) => o;
  });

  it('double appel de création => UN seul payout, UN seul virement', async () => {
    const { service, count } = makeService();
    payoutRepo.findOne.mockResolvedValue(null);
    payoutRepo.save.mockResolvedValue({
      id: 'p1',
      status: PayoutStatus.PROCESSING,
    });

    await service.processAutomaticPayout('o1');

    const winner = { id: 'p1', status: PayoutStatus.SUCCESS, providerTransactionRef: 'TX-1' };
    payoutRepo.findOne.mockResolvedValue(winner);
    const second = await service.processAutomaticPayout('o1');

    expect(count()).toBe(1);
    expect(second).toBe(winner);
  });

  it('course concurrente (2 inserts) : l’index UNIQUE rejette le 2e, aucun 2e virement', async () => {
    const { service, count } = makeService();
    // Les deux instances lisent "aucun payout" (findOne -> null) : TOCTOU.
    let winner: any = null;
    payoutRepo.findOne.mockImplementation(async ({ where }: any) =>
      winner ? winner : null,
    );
    payoutRepo.save.mockImplementation(async (p: any) => {
      if (!p.id) {
        // tentative de CREATE
        if (winner) throw dupError; // le 2e insert viole l'index UNIQUE
        winner = { ...p, id: 'p1' };
        return winner;
      }
      return p; // UPDATE (exécution / mise à jour du payout)
    });

    const [a, b] = await Promise.all([
      service.processAutomaticPayout('o1'),
      service.processAutomaticPayout('o1'),
    ]);

    // Le perdant renvoie le payout du gagnant SANS ré-exécuter le virement.
    expect(a.id).toBe('p1');
    expect(b.id).toBe('p1');
    expect(count()).toBeLessThanOrEqual(1);
  });

  it('retry concurrent d’un FAILED : un seul gagnant exécute le virement', async () => {
    const { service, count } = makeService();
    let current: any = {
      id: 'p1',
      orderId: 'o1',
      status: PayoutStatus.FAILED,
    };
    // Guard par orderId : renvoie toujours l'état courant du payout FAILED.
    payoutRepo.findOne.mockImplementation(async ({ where }: any) => current);
    payoutRepo.createQueryBuilder.mockReturnValue({
      update: () => payoutRepo.createQueryBuilder(),
      set: () => payoutRepo.createQueryBuilder(),
      where: () => payoutRepo.createQueryBuilder(),
      andWhere: () => payoutRepo.createQueryBuilder(),
      execute: jest.fn().mockImplementation(async () => {
        // 1er appel = gagnant (affecte 1 ligne), 2e = perdant (0 ligne).
        if (current.status === PayoutStatus.PROCESSING) {
          return { affected: 0 };
        }
        current = { ...current, status: PayoutStatus.PROCESSING };
        return { affected: 1 };
      }),
    });
    payoutRepo.save.mockImplementation(async (p: any) => p);

    const winnerCall = await service.processAutomaticPayout('o1', {
      retryFailed: true,
    });
    const loserCall = await service.processAutomaticPayout('o1', {
      retryFailed: true,
    });

    expect(count()).toBeLessThanOrEqual(1);
    expect(winnerCall.status).toBe(PayoutStatus.SUCCESS);
    expect(loserCall.id).toBe('p1');
  });

  it('état PROCESSING (inconnu/potentiellement émis) : JAMAIS ré-exécuté', async () => {
    const { service, count } = makeService();
    const processing: any = { id: 'p1', status: PayoutStatus.PROCESSING };
    payoutRepo.findOne.mockResolvedValue(processing);

    const result = await service.processAutomaticPayout('o1', {
      retryFailed: true, // même avec retry demandé, un PROCESSING n'est pas ré-exécuté
    });

    expect(count()).toBe(0);
    expect(result).toBe(processing);
  });
});
