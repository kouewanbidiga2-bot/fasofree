import { EventEmitter2 } from '@nestjs/event-emitter';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import {
  MerchantPayout,
  PayoutStatus,
} from '../payments/entities/merchant-payout.entity';
import { Dispute } from './entities/dispute.entity';
import { DISPUTE_OPENED } from './events/dispute.events';
import { DisputesService } from './disputes.service';

jest.mock('bcrypt', () => ({
  compare: jest.fn().mockResolvedValue(true),
}));

describe('DisputesService', () => {
  it('persists the reason, freezes the order and blocks an in-flight payout', async () => {
    const order = {
      id: 'order-1',
      clientId: 'client-1',
      businessId: 'business-1',
      status: OrderStatus.DELIVERED,
    } as Order;
    const payout = {
      orderId: order.id,
      status: PayoutStatus.PROCESSING,
    } as MerchantPayout;
    const dispute = { id: 'dispute-1' } as Dispute;
    const save = jest.fn().mockResolvedValue(dispute);
    const manager = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(order)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(payout),
      create: jest.fn().mockImplementation((_entity, value) => value),
      save,
    };
    const runner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager,
    };
    const dataSource = { createQueryRunner: jest.fn().mockReturnValue(runner) };
    const emit = jest.fn();
    const events = { emit } as unknown as EventEmitter2;
    const usersService = {
      findById: jest.fn().mockResolvedValue({
        id: 'client-1',
        passwordHash: '$2b$10$fakehash',
      }),
    } as never;
    const service = new DisputesService(
      dataSource as never,
      events,
      {} as never,
      {} as never,
      usersService,
    );

    await service.open(order.id, order.clientId, {
      reason: 'Le colis n’a pas été remis au client.',
      password: 'Test@12345',
    });

    expect(order.status).toBe(OrderStatus.DISPUTED);
    expect(payout.status).toBe(PayoutStatus.BLOCKED);
    expect(manager.create).toHaveBeenCalledWith(
      Dispute,
      expect.objectContaining({
        reason: 'Le colis n’a pas été remis au client.',
      }),
    );
    expect(emit).toHaveBeenCalledWith(
      DISPUTE_OPENED,
      expect.objectContaining({ orderId: order.id }),
    );
  });
});
