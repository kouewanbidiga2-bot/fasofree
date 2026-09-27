import { EventEmitter2 } from '@nestjs/event-emitter';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { DisputesService } from './disputes.service';
import { Dispute, DisputeStatus } from './entities/dispute.entity';
import { DisputeMessage } from './entities/dispute-message.entity';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/entities/user-role.enum';
import { Business } from '../businesses/entities/business.entity';

const makeUser = (id: string, fullName: string): User =>
  ({ id, fullName, phone: '+22600000000', email: `${id}@test.fr` }) as User;

const makeOrder = (
  id: string,
  clientId: string,
  businessId: string | null,
): Order =>
  ({
    id,
    clientId,
    businessId,
    status: OrderStatus.DISPUTED,
    totalAmount: 5000,
  }) as Order;

const makeDispute = (id: string, orderId: string, clientId: string): Dispute =>
  ({ id, orderId, clientId, status: DisputeStatus.OPEN }) as Dispute;

const makeBusiness = (id: string): Business =>
  ({ id, name: `Boutique ${id}`, phone: '+22612345678' }) as Business;

type Fixture = {
  users?: User[];
  orders?: Order[];
  disputes?: Dispute[];
  businesses?: Business[];
  messages?: DisputeMessage[];
};

/**
 * DataSource factice : getRepository renvoie des repos in-memory simples
 * par nom d'entité (lecture seule — suffisant pour canAccess / messages).
 */
const makeService = (fixture: Fixture) => {
  const data = {
    disputes: fixture.disputes ?? [],
    orders: fixture.orders ?? [],
    users: fixture.users ?? [],
    businesses: fixture.businesses ?? [],
    messages: fixture.messages ?? [],
  };

  const matchesWhere = (
    item: any,
    where?: Record<string, unknown>,
  ): boolean => {
    if (!where) return true;
    return Object.entries(where).every(([k, v]) => {
      if (Array.isArray(v)) return v.includes(item[k]);
      // FindOperator (In, …) : on accepte comme filtre pass-through
      if (v && typeof v === 'object') return true;
      return item[k] === v;
    });
  };

  const repoFor = (entityName: string) => ({
    find: jest.fn(async ({ where }: { where?: Record<string, unknown> } = {}) =>
      data[entityName].filter((item: any) => matchesWhere(item, where)),
    ),
    findOne: jest.fn(
      async ({ where }: { where?: Record<string, unknown> } = {}) =>
        data[entityName].find((item: any) => matchesWhere(item, where)) ?? null,
    ),
  });

  const dataSource = {
    getRepository: jest.fn((entity: any) => {
      switch (entity.name) {
        case 'Dispute':
          return repoFor('disputes');
        case 'Order':
          return repoFor('orders');
        case 'User':
          return repoFor('users');
        case 'Business':
          return repoFor('businesses');
        default:
          return repoFor('messages');
      }
    }),
  } as never;

  const messageRepo = {
    find: jest.fn(async ({ where }: { where?: Record<string, unknown> } = {}) =>
      data.messages.filter((m) => matchesWhere(m, where)),
    ),
    create: jest.fn().mockImplementation((value) => value),
    save: jest.fn().mockImplementation((msg) => ({ ...msg, id: 'msg-1' })),
  };

  const service = new DisputesService(
    dataSource,
    { emit: jest.fn() } as unknown as EventEmitter2,
    {} as never,
    {} as never,
    { findById: jest.fn() } as never,
    {
      assertManagedBy: jest.fn().mockResolvedValue(undefined),
    } as never,
    messageRepo as never,
  );

  return { service, messageRepo, data };
};

describe('DisputesService — chat support & accès', () => {
  const client = makeUser('client-1', 'Client Un');
  const merchant = makeUser('merchant-1', 'Hassane Traoré');
  const business = makeBusiness('biz-1');
  const order = makeOrder('order-1', client.id, business.id);
  const dispute = makeDispute('d-1', order.id, client.id);

  it('le staff (SUPPORT/ADMIN) et le client propriétaire accèdent, un tiers non', async () => {
    const { service } = makeService({
      users: [client, merchant],
      orders: [order],
      disputes: [dispute],
      businesses: [business],
    });

    await expect(
      service.canAccessDispute(dispute.id, UserRole.SUPPORT, 'support-1'),
    ).resolves.toBe(true);
    await expect(
      service.canAccessDispute(dispute.id, UserRole.ADMIN, 'admin-1'),
    ).resolves.toBe(true);
    await expect(
      service.canAccessDispute(dispute.id, UserRole.SUPER_ADMIN, 'sup-1'),
    ).resolves.toBe(true);
    await expect(
      service.canAccessDispute(dispute.id, UserRole.CLIENT, 'client-1'),
    ).resolves.toBe(true);
    await expect(
      service.canAccessDispute(dispute.id, UserRole.CLIENT, 'intrus'),
    ).resolves.toBe(false);
  });

  it('le gérant du commerce de la commande accède au litige', async () => {
    const { service } = makeService({
      users: [client, merchant],
      orders: [order],
      disputes: [dispute],
      businesses: [business],
    });

    await expect(
      service.canAccessDispute(
        dispute.id,
        UserRole.BUSINESS_ADMIN,
        merchant.id,
      ),
    ).resolves.toBe(true);
  });

  it('un gérant d’un autre commerce est refusé', async () => {
    const otherBusiness = makeBusiness('biz-other');
    const { service } = makeService({
      users: [client, merchant],
      orders: [order],
      disputes: [dispute],
      businesses: [business, otherBusiness],
    });
    // assertManagedBy échoue pour un commerce qu'il ne gère pas
    (service as any).businessesService.assertManagedBy = jest
      .fn()
      .mockRejectedValue(new ForbiddenException('Non géré'));

    await expect(
      service.canAccessDispute(
        dispute.id,
        UserRole.BUSINESS_ADMIN,
        merchant.id,
      ),
    ).resolves.toBe(false);
  });

  it('addMessage persiste un message nettoyé et résout le nom de l’expéditeur', async () => {
    const { service, messageRepo } = makeService({
      users: [client],
      orders: [order],
      disputes: [dispute],
      businesses: [business],
    });
    (service as any).usersService.findById = jest
      .fn()
      .mockResolvedValue(client);

    const saved = await service.addMessage(
      dispute.id,
      UserRole.CLIENT,
      client.id,
      '   <script>alert(1)</script>Bonjour le support !   ',
    );

    expect(saved.senderId).toBe(client.id);
    expect(saved.senderRole).toBe(UserRole.CLIENT);
    expect(saved.senderName).toBe('Client Un');
    // Nettoyage des balises (contenu conservé, comme le chat de commande)
    expect(saved.message).toBe('alert(1)Bonjour le support !');
    expect(messageRepo.save).toHaveBeenCalled();
  });

  it('addMessage refuse un non-participant', async () => {
    const { service } = makeService({
      users: [client],
      orders: [order],
      disputes: [dispute],
      businesses: [business],
    });
    await expect(
      service.addMessage(dispute.id, UserRole.CLIENT, 'intrus', 'Bonjour'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('listMessages 404 sur un litige inconnu', async () => {
    const { service } = makeService({
      users: [client],
      orders: [order],
      disputes: [dispute],
      businesses: [business],
    });
    await expect(
      service.listMessages('inconnu', UserRole.SUPPORT, 'support-1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('listEligibleOrders retourne uniquement les commandes livrées sans litige', async () => {
    const deliveredOrder = makeOrder('order-2', client.id, business.id);
    deliveredOrder.status = OrderStatus.DELIVERED;
    const disputedOrder = makeOrder('order-3', client.id, business.id);
    disputedOrder.status = OrderStatus.DELIVERED;
    const otherDispute = makeDispute('d-2', disputedOrder.id, client.id);

    const { service } = makeService({
      users: [client],
      orders: [deliveredOrder, disputedOrder],
      disputes: [dispute, otherDispute],
      businesses: [business],
    });

    const eligible = await service.listEligibleOrders(client.id);
    expect(eligible).toHaveLength(1);
    expect(eligible[0].id).toBe(deliveredOrder.id);
    expect(eligible[0].businessName).toBe('Boutique biz-1');
  });

  it('addMessage refuse un message sur un litige terminal (APPROVED/REJECTED/CLOSED)', async () => {
    const { service } = makeService({
      users: [client],
      orders: [order],
      disputes: [
        { ...dispute, id: 'd-appr', status: DisputeStatus.APPROVED },
        { ...dispute, id: 'd-rej', status: DisputeStatus.REJECTED },
        { ...dispute, id: 'd-clo', status: DisputeStatus.CLOSED },
      ],
      businesses: [business],
    });

    for (const id of ['d-appr', 'd-rej', 'd-clo']) {
      await expect(
        service.addMessage(id, UserRole.CLIENT, client.id, 'Bonjour'),
      ).rejects.toMatchObject({ status: 409 });
    }
  });
});
