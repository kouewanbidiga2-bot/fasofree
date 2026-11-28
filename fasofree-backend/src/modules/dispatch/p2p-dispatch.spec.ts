import { DataSource } from 'typeorm';
import { GeoDispatchService } from '../orders/dispatch.service';
import { FulfillmentType, Order, OrderStatus, OrderType } from '../orders/entities/order.entity';
import { DispatchGateway } from './dispatch.gateway';
import { activeP2pOffer, isCompatibleDeliveryZone, P2P_GPS_MAX_AGE_MS } from './delivery-rules';
import { P2pDispatchService } from './p2p-dispatch.service';

const pickup = { latitude: 12.37163, longitude: -1.51938 };
const dropoff = { latitude: 12.38927, longitude: -1.50732 };

function fixture() {
  const order: Order = Object.assign(new Order(), {
    id: 'fixture', orderType: OrderType.P2P_DELIVERY, status: OrderStatus.PAID,
    fulfillmentType: FulfillmentType.DELIVERY, paymentTransactionRef: 'fixture-payment',
    driverId: null, deliveryProviderId: null, pickupLocation: pickup, dropoffLocation: dropoff,
    nextP2pDispatchAt: new Date(), p2pDispatchWave: 0,
  });
  const query = {
    where: jest.fn().mockReturnThis(),
    setLock: jest.fn().mockReturnThis(),
    setOnLocked: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(order),
  };
  const orders = {
    createQueryBuilder: jest.fn().mockReturnValue(query),
    find: jest.fn().mockResolvedValue([]),
    update: jest.fn(async (_id, patch) => { Object.assign(order, patch); }),
  };
  const users = { find: jest.fn().mockResolvedValue([{ id: 'proche' }, { id: 'suivant' }]) };
  const manager = {
    getRepository: (model: unknown) => model === Order ? orders : users,
    findOne: jest.fn().mockResolvedValue(order),
  };
  const geo = {
    findNearbyActiveDrivers: jest.fn().mockResolvedValue([
      { driverId: 'hors-ligne', distanceKm: 0.1 },
      { driverId: 'proche', distanceKm: 0.6 },
      { driverId: 'suivant', distanceKm: 3 },
    ]),
  };
  const gateway = { notifyCandidateDrivers: jest.fn() };
  const service = new P2pDispatchService(
    { transaction: (fn) => fn(manager) } as unknown as DataSource,
    geo as unknown as GeoDispatchService,
    gateway as unknown as DispatchGateway,
  );
  return { order, users, geo, gateway, service };
}

describe('Offres progressives de livraison', () => {
  it('part du ramassage, attend le délai puis propose au prochain cercle disponible', async () => {
    const { order, geo, service } = fixture();
    const first = await service['advance'](order.id);
    expect(first?.driverIds).toEqual(['proche']);
    expect(geo.findNearbyActiveDrivers).toHaveBeenCalledWith(pickup.latitude, pickup.longitude, 10, 100, P2P_GPS_MAX_AGE_MS);
    expect(await service['advance'](order.id)).toBeNull();
    expect(activeP2pOffer(order, 'proche', first?.expiresAt.getTime())).toBeUndefined();
    if (order.dispatchCandidates?.[0]) order.dispatchCandidates[0].offerExpiresAt = new Date(0).toISOString();
    order.nextP2pDispatchAt = new Date(0);
    const next = await service['advance'](order.id);
    expect(next?.driverIds).toEqual(['suivant']);
    expect(order.p2pDispatchWave).toBe(3);
  });

  it('saute les cercles vides et ne publie rien après attribution', async () => {
    const { order, users, service, gateway } = fixture();
    users.find.mockResolvedValue([{ id: 'suivant' }]);
    const offer = await service['advance'](order.id);
    expect(offer?.driverIds).toEqual(['suivant']);
    expect(order.p2pDispatchWave).toBe(3);
    order.driverId = 'suivant';
    order.status = OrderStatus.DRIVER_ASSIGNED;
    await service['deliverOffer'](order.id, offer!.driverIds, offer!.expiresAt);
    expect(gateway.notifyCandidateDrivers).not.toHaveBeenCalled();
    expect(await service['advance'](order.id)).toBeNull();
  });

  it('compare le départ et l’arrivée avec chaque autre mission et refuse les points inconnus', () => {
    const candidate = { orderType: OrderType.P2P_DELIVERY, pickupLocation: pickup, dropoffLocation: dropoff } as Order;
    expect(isCompatibleDeliveryZone(candidate, [candidate])).toBe(true);
    const farDropoff = { ...candidate, dropoffLocation: { ...dropoff, latitude: 12.45 } } as Order;
    expect(isCompatibleDeliveryZone(candidate, [candidate, farDropoff])).toBe(false);
    expect(isCompatibleDeliveryZone(candidate, [{ ...candidate, pickupLocation: undefined }])).toBe(false);
  });
});
