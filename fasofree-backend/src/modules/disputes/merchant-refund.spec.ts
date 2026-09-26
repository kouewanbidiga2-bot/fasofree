import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DisputesService } from './disputes.service';
import {
  Dispute,
  DisputeResolution,
  DisputeStatus,
} from './entities/dispute.entity';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/entities/user-role.enum';
import { Business } from '../businesses/entities/business.entity';
import {
  Transaction,
  TransactionStatus,
} from '../payments/entities/transaction.entity';
import {
  MerchantPayout,
  PayoutStatus,
} from '../payments/entities/merchant-payout.entity';
import { DISPUTE_RESOLVED } from './events/dispute.events';

const makeUser = (id: string, fullName: string): User =>
  ({ id, fullName, phone: '+22600000000', email: `${id}@test.fr` }) as User;

const makeOrder = (
  id: string,
  clientId: string,
  businessId: string,
  totalAmount = 5000,
): Order =>
  ({
    id,
    clientId,
    businessId,
    status: OrderStatus.DISPUTED,
    totalAmount,
  }) as Order;

const makeDispute = (
  id: string,
  orderId: string,
  clientId: string,
  status = DisputeStatus.OPEN,
): Dispute =>
  ({
    id,
    orderId,
    clientId,
    status,
    resolution: null,
    refundAmount: null,
    adminNote: null,
    merchantNote: null,
    merchantRefundedBy: null,
    merchantRefundedAt: null,
    resolvedAt: null,
  }) as Dispute;

const makeBusiness = (id: string, ownerId: string): Business =>
  ({ id, ownerId, name: `Boutique ${id}`, phone: '+22612345678' }) as Business;

const makeTransaction = (
  orderId: string,
  status: TransactionStatus,
): Transaction => ({ orderId, status, amount: 5000 }) as Transaction;

const makePayout = (orderId: string, status: PayoutStatus): MerchantPayout =>
  ({ orderId, status, failureReason: null }) as unknown as MerchantPayout;

type Store = {
  disputes: Dispute[];
  orders: Order[];
  users: User[];
  businesses: Business[];
  transactions: Transaction[];
  payouts?: MerchantPayout[];
};

const matchesWhere = (item: any, where?: Record<string, unknown>): boolean => {
  if (!where) return true;
  return Object.entries(where).every(([k, v]) => {
    if (Array.isArray(v)) return v.includes(item[k]);
    // FindOperator (In, …) : accepté comme filtre pass-through
    if (v && typeof v === 'object') return true;
    return item[k] === v;
  });
};

/**
 * DataSource factice :
 * - getRepository : lectures in-memory + queryBuilder chaîné pour
 *   listForBusiness (filtre par businessId des commandes),
 * - createQueryRunner : manager transactionnel (findOne/save) qui mute les
 *   mêmes objets en mémoire. LIMITE : le save ne simule pas de rollback — les
 *   assertions sur l'état d'un objet couvert par un garde ne prouvent que
 *   l'absence de mutation AVANT le garde, pas la restauration transactionnelle.
 */
const makeService = (store: Store) => {
  let capturedBusinessIds: string[] = [];

  const chainFor = () => ({
    innerJoin: () => chainFor(),
    where: (cond: string, params?: { businessIds?: string[] }) => {
      void cond;
      capturedBusinessIds = params?.businessIds ?? [];
      return chainFor();
    },
    orderBy: () => chainFor(),
    take: () => chainFor(),
    getMany: async () =>
      store.disputes.filter((d) => {
        const order = store.orders.find((o) => o.id === d.orderId);
        return order ? capturedBusinessIds.includes(order.businessId) : false;
      }),
  });

  const repoFor = (name: string) => ({
    find: jest.fn(async ({ where }: { where?: Record<string, unknown> } = {}) =>
      (store as any)[name].filter((item: any) => matchesWhere(item, where)),
    ),
    findOne: jest.fn(
      async ({ where }: { where?: Record<string, unknown> } = {}) =>
        (store as any)[name].find((item: any) => matchesWhere(item, where)) ??
        null,
    ),
    createQueryBuilder: jest.fn(() => chainFor()),
  });

  const tableOf = (entityName: string): string => {
    switch (entityName) {
      case 'MerchantPayout':
        return 'payouts';
      default:
        return `${entityName.toLowerCase()}s`;
    }
  };

  const dataSource = {
    getRepository: jest.fn((entity: any) => {
      const table = tableOf(entity.name);
      return repoFor((store as any)[table] ? table : 'transactions');
    }),
    createQueryRunner: jest.fn(() => {
      const manager = {
        findOne: jest.fn(
          async (
            entity: any,
            { where }: { where?: Record<string, unknown> } = {},
          ) => {
            const table = tableOf(entity.name);
            const rows: any[] = (store as any)[table] ?? [];
            if (entity.name === 'Transaction') {
              return rows.find((t) => t.orderId === where?.orderId) ?? null;
            }
            if (entity.name === 'MerchantPayout') {
              return rows.find((p) => p.orderId === where?.orderId) ?? null;
            }
            return rows.find((x) => x.id === where?.id) ?? null;
          },
        ),
        save: jest.fn(async (row: any) => row),
      };
      return {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
        manager,
      };
    }),
  } as never;

  const walletService = {
    creditWallet: jest
      .fn()
      .mockResolvedValue({ wallet: { balance: 7000 }, transaction: {} }),
  };
  const notificationsService = {
    sendNotification: jest.fn().mockResolvedValue(undefined),
  };
  const usersService = {
    findById: jest.fn(
      async (id: string) => store.users.find((u) => u.id === id) ?? null,
    ),
  };
  const businessesService = {
    findAllByOwner: jest.fn(async (ownerId: string) =>
      store.businesses.filter((b) => b.ownerId === ownerId),
    ),
    assertManagedBy: jest.fn().mockResolvedValue(undefined),
  };
  const messageRepo = { find: jest.fn(), create: jest.fn(), save: jest.fn() };
  const events = { emit: jest.fn() };

  const service = new DisputesService(
    dataSource,
    events as unknown as EventEmitter2,
    walletService as never,
    notificationsService as never,
    usersService as never,
    businessesService as never,
    messageRepo as never,
  );

  return {
    service,
    walletService,
    businessesService,
    events,
    dataSource,
    data: store,
  };
};

describe('DisputesService — litiges gérant (Phase 2)', () => {
  // Fixture fraîche par test : merchantRefund mute les objets partagés.
  const build = () => {
    const merchant = makeUser('merchant-1', 'Hassane Traoré');
    const client = makeUser('client-1', 'Client Un');
    const business = makeBusiness('biz-1', merchant.id);
    const order = makeOrder('order-1', client.id, business.id);
    const dispute = makeDispute('dispute-1', order.id, client.id);
    const makeStore = (): Store => ({
      disputes: [dispute],
      orders: [order],
      users: [merchant, client],
      businesses: [business],
      transactions: [makeTransaction(order.id, TransactionStatus.SUCCESS)],
      payouts: [],
    });
    return { merchant, client, business, order, dispute, makeStore };
  };

  describe('listForBusiness', () => {
    it('ne renvoie que les litiges des commerces du gérant (multi-agences réel)', async () => {
      const { merchant } = build();
      const otherMerchant = makeUser('merchant-2', 'Autre Marchand');
      // 2 commerces possédés par le gérant + 1 commerce tiers.
      const ownedB1 = makeBusiness('biz-1', merchant.id);
      const ownedB2 = makeBusiness('biz-4', merchant.id);
      const otherBusiness = makeBusiness('biz-2', otherMerchant.id);
      const order1 = makeOrder('order-1', 'client-1', ownedB1.id);
      const order2 = makeOrder('order-4', 'client-4', ownedB2.id);
      const otherOrder = makeOrder('order-2', 'client-2', otherBusiness.id);
      const d1 = makeDispute('dispute-1', order1.id, 'client-1');
      const d2 = makeDispute('dispute-4', order2.id, 'client-4');
      const dOther = makeDispute('dispute-2', otherOrder.id, 'client-2');

      const { service } = makeService({
        disputes: [dOther, d1, d2],
        orders: [order1, order2, otherOrder],
        users: [merchant, otherMerchant],
        businesses: [ownedB1, ownedB2, otherBusiness],
        transactions: [],
      });

      const list = (await service.listForBusiness(merchant.id)).map(
        (d) => d.id,
      );
      expect(list.sort()).toEqual(['dispute-1', 'dispute-4']);
      expect(list).not.toContain('dispute-2');
    });

    it('renvoie [] quand le gérant ne possède aucun commerce', async () => {
      const { merchant } = build();
      const { service } = makeService({
        disputes: [],
        orders: [],
        users: [merchant],
        businesses: [],
        transactions: [],
      });
      await expect(service.listForBusiness(merchant.id)).resolves.toEqual([]);
    });
  });

  describe('merchantRefund', () => {
    it('rembourse au montant de la commande, bloque le payout, crédite le wallet et émet la résolution', async () => {
      const { dispute, order, client, merchant, makeStore } = build();
      const store = makeStore();
      store.payouts = [makePayout(order.id, PayoutStatus.FAILED)];
      const { service, walletService, businessesService, events } =
        makeService(store);

      const saved = await service.merchantRefund(
        dispute.id,
        merchant.id,
        UserRole.BUSINESS_ADMIN,
        'Remboursement immédiat décidé par le marchand',
      );

      expect(saved.status).toBe(DisputeStatus.APPROVED);
      expect(saved.resolution).toBe(DisputeResolution.REFUND);
      expect(saved.refundAmount).toBe(5000);
      // La note du gérant va dans merchantNote, jamais dans adminNote.
      expect(saved.merchantNote).toBe(
        'Remboursement immédiat décidé par le marchand',
      );
      expect(saved.adminNote).toBeNull();
      expect(saved.merchantRefundedBy).toBe(merchant.id);
      expect(saved.merchantRefundedAt).toBeInstanceOf(Date);
      expect(saved.resolvedAt).toBeInstanceOf(Date);

      expect(order.status).toBe(OrderStatus.REFUNDED);
      expect(store.transactions[0].status).toBe(
        TransactionStatus.REFUND_PENDING,
      );
      // Un payout en échec est re-bloqué (empêche retry post-remboursement).
      expect(store.payouts[0].status).toBe(PayoutStatus.BLOCKED);
      expect(store.payouts[0].failureReason).toBe(
        'Bloqué : remboursement décidé par le gérant du commerce',
      );

      expect(businessesService.assertManagedBy).toHaveBeenCalledWith(
        'biz-1',
        merchant.id,
        'business_admin',
      );
      expect(walletService.creditWallet).toHaveBeenCalledWith(
        client.id,
        'CUSTOMER',
        5000,
        'REFUND',
        order.id,
        expect.any(String),
      );
      expect(events.emit).toHaveBeenCalledWith(
        DISPUTE_RESOLVED,
        expect.objectContaining({
          disputeId: dispute.id,
          resolution: DisputeResolution.REFUND,
        }),
      );
    });

    it('sans note, écrit la note par défaut dans merchantNote', async () => {
      const { dispute, merchant, makeStore } = build();
      const { service } = makeService(makeStore());

      const saved = await service.merchantRefund(
        dispute.id,
        merchant.id,
        UserRole.BUSINESS_ADMIN,
      );
      expect(saved.merchantNote).toBe('Remboursé par le gérant du commerce');
      expect(saved.adminNote).toBeNull();
    });

    it('accepte un litige UNDER_INVESTIGATION (sans décision admin)', async () => {
      const { dispute, merchant, makeStore } = build();
      const store = makeStore();
      store.disputes[0].status = DisputeStatus.UNDER_INVESTIGATION;
      const { service } = makeService(store);

      await expect(
        service.merchantRefund(
          dispute.id,
          merchant.id,
          UserRole.BUSINESS_ADMIN,
        ),
      ).resolves.toMatchObject({ status: DisputeStatus.APPROVED });
    });

    it('refuse si le litige est déjà en attente de décision admin', async () => {
      const { dispute, order, merchant, makeStore } = build();
      const store = makeStore();
      dispute.status = DisputeStatus.PENDING_ADMIN_APPROVAL;
      const { service, walletService, events } = makeService(store);

      await expect(
        service.merchantRefund(
          dispute.id,
          merchant.id,
          UserRole.BUSINESS_ADMIN,
        ),
      ).rejects.toThrow(ConflictException);
      expect(order.status).toBe(OrderStatus.DISPUTED);
      expect(store.transactions[0].status).toBe(TransactionStatus.SUCCESS);
      expect(walletService.creditWallet).not.toHaveBeenCalled();
      expect(events.emit).not.toHaveBeenCalled();
    });

    it('refuse si le paiement de la commande nest pas remboursable (PENDING ou absent)', async () => {
      const { dispute, order, merchant, makeStore } = build();

      const pendingStore = makeStore();
      pendingStore.transactions[0].status = TransactionStatus.PENDING;
      const {
        service: s1,
        walletService: w1,
        events: e1,
      } = makeService(pendingStore);
      await expect(
        s1.merchantRefund(dispute.id, merchant.id, UserRole.BUSINESS_ADMIN),
      ).rejects.toThrow(BadRequestException);
      expect(w1.creditWallet).not.toHaveBeenCalled();
      expect(e1.emit).not.toHaveBeenCalled();

      const missingStore = makeStore();
      missingStore.transactions = [];
      const {
        service: s2,
        walletService: w2,
        events: e2,
      } = makeService(missingStore);
      await expect(
        s2.merchantRefund(dispute.id, merchant.id, UserRole.BUSINESS_ADMIN),
      ).rejects.toThrow(BadRequestException);
      expect(w2.creditWallet).not.toHaveBeenCalled();
      expect(e2.emit).not.toHaveBeenCalled();

      expect(order.status).toBe(OrderStatus.DISPUTED);
    });

    it('refuse si le gérant ne gère pas le commerce de la commande', async () => {
      const { dispute, merchant, makeStore } = build();
      const { service, businessesService, walletService, events } =
        makeService(makeStore());
      businessesService.assertManagedBy = jest
        .fn()
        .mockRejectedValue(new ForbiddenException('Commerce non géré'));

      await expect(
        service.merchantRefund(
          dispute.id,
          merchant.id,
          UserRole.BUSINESS_ADMIN,
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(walletService.creditWallet).not.toHaveBeenCalled();
      expect(events.emit).not.toHaveBeenCalled();
    });

    it("refuse si la commande n'est liée à aucun commerce", async () => {
      const { dispute, merchant, makeStore } = build();
      const store = makeStore();
      store.orders[0] = {
        ...store.orders[0],
        businessId: null,
      } as unknown as Order;
      const { service, walletService } = makeService(store);

      await expect(
        service.merchantRefund(
          dispute.id,
          merchant.id,
          UserRole.BUSINESS_ADMIN,
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(walletService.creditWallet).not.toHaveBeenCalled();
    });

    it('404 sur un litige inconnu ou une commande introuvable', async () => {
      const { merchant, makeStore } = build();
      const store = makeStore();
      const { service } = makeService(store);

      await expect(
        service.merchantRefund('inconnu', merchant.id, UserRole.BUSINESS_ADMIN),
      ).rejects.toThrow(NotFoundException);

      // Litige orphelin : la commande n'existe plus → 404 « commande associée ».
      store.orders = [];
      await expect(
        service.merchantRefund(
          'dispute-1',
          merchant.id,
          UserRole.BUSINESS_ADMIN,
        ),
      ).rejects.toThrow('Commande associée introuvable');
    });

    it('refuse un montant de commande invalide (0 ou NaN)', async () => {
      const { dispute, order, merchant, makeStore } = build();
      const store = makeStore();
      store.orders[0] = {
        ...store.orders[0],
        totalAmount: 0,
      };
      const { service, walletService, events } = makeService(store);

      await expect(
        service.merchantRefund(
          dispute.id,
          merchant.id,
          UserRole.BUSINESS_ADMIN,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(order.status).toBe(OrderStatus.DISPUTED);
      expect(walletService.creditWallet).not.toHaveBeenCalled();
      expect(events.emit).not.toHaveBeenCalled();
    });

    it('payout déjà SUCCESS → escalade au circuit admin sans rembourser', async () => {
      const { dispute, order, merchant, makeStore } = build();
      const store = makeStore();
      store.payouts = [makePayout(order.id, PayoutStatus.SUCCESS)];
      const { service, walletService, events } = makeService(store);

      const saved = await service.merchantRefund(
        dispute.id,
        merchant.id,
        UserRole.BUSINESS_ADMIN,
      );

      // Pas de remboursement auto : la demande remonte à l'admin.
      expect(saved.status).toBe(DisputeStatus.PENDING_ADMIN_APPROVAL);
      expect(saved.resolution).toBe(DisputeResolution.REFUND);
      expect(saved.refundAmount).toBe(5000);
      expect(saved.merchantNote).toContain('versement marchand déjà exécuté');
      expect(order.status).toBe(OrderStatus.DISPUTED);
      expect(store.transactions[0].status).toBe(TransactionStatus.SUCCESS);
      expect(walletService.creditWallet).not.toHaveBeenCalled();
      expect(events.emit).not.toHaveBeenCalled();
    });

    it('un échec du crédit wallet ne fait pas échouer le remboursement (résilience)', async () => {
      const { dispute, merchant, makeStore } = build();
      const { service, walletService, events } = makeService(makeStore());
      walletService.creditWallet = jest
        .fn()
        .mockRejectedValue(new Error('wallet KO'));

      const saved = await service.merchantRefund(
        dispute.id,
        merchant.id,
        UserRole.BUSINESS_ADMIN,
      );
      expect(saved.status).toBe(DisputeStatus.APPROVED);
      expect(events.emit).toHaveBeenCalledWith(
        DISPUTE_RESOLVED,
        expect.objectContaining({ disputeId: dispute.id }),
      );
    });
  });
});
