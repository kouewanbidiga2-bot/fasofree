import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrderStatus, OrderType } from './entities/order.entity';
import { OrdersService } from './orders.service';
import { UserRole } from '../users/entities/user-role.enum';

describe('Suivi par numéro', () => {
  const reference = '1A2B3C4D5E6F7A8B9C0D';
  const formatted = 'KW-1A2B-3C4D-5E6F-7A8B-9C0D';
  const order = { id: 'fixture-order', clientId: 'fixture-client' };
  let service: OrdersService;
  let findOne: jest.Mock;
  let getOrderTracking: jest.Mock;

  beforeEach(() => {
    findOne = jest.fn().mockResolvedValue(order);
    getOrderTracking = jest.fn();
    service = Object.assign(Object.create(OrdersService.prototype), {
      orderRepository: { findOne },
      getOrderTracking,
    });
  });

  it('refuse une référence mal formée avant de lire la base', async () => {
    await expect(service.getActiveTrackingByReference('KW-123')).rejects.toBeInstanceOf(BadRequestException);
    expect(findOne).not.toHaveBeenCalled();
  });

  it('retourne les points et le statut sans les adresses ni les identifiants privés', async () => {
    const updatedAt = Date.now();
    getOrderTracking.mockResolvedValue({
      status: OrderStatus.IN_DELIVERY,
      pickupLocation: { latitude: 12.38641, longitude: -1.52128, address: 'Adresse de test' },
      dropoffLocation: { latitude: 12.34355, longitude: -1.50379, contactPhone: 'test' },
      driverLocation: { latitude: 12.34199, longitude: -1.50422, updatedAt },
      driverId: 'fixture-driver',
      eta: { totalMinutes: 3 },
    });
    await expect(service.getActiveTrackingByReference(formatted.toLowerCase())).resolves.toEqual({
      trackingReference: reference,
      status: OrderStatus.IN_DELIVERY,
      pickupLocation: { latitude: 12.386, longitude: -1.521 },
      dropoffLocation: { latitude: 12.344, longitude: -1.504 },
      driverLocation: { latitude: 12.342, longitude: -1.5042, updatedAt },
      eta: { totalMinutes: 3 },
    });
    const { where } = findOne.mock.calls[0][0];
    expect(where.trackingReference).toBe(reference);
    expect(where.orderType).toBe(OrderType.P2P_DELIVERY);
    expect(where.status.value).toContain(OrderStatus.DELIVERED_PENDING_CONFIRMATION);
    expect(where.status.value).not.toContain(OrderStatus.DELIVERED);
  });

  it('retire le suivi si la réception est confirmée pendant la recherche', async () => {
    getOrderTracking.mockResolvedValue({ status: OrderStatus.DELIVERED });
    await expect(service.getActiveTrackingByReference(formatted)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('écarte les positions par défaut et les derniers points GPS trop anciens', async () => {
    getOrderTracking.mockResolvedValue({
      status: OrderStatus.PROCESSING,
      pickupLocation: { latitude: 12.3714, longitude: -1.5197 },
      driverLocation: { latitude: 12.35, longitude: -1.50, updatedAt: Date.now() - 360_000 },
    });
    await expect(service.getActiveTrackingByReference(reference)).resolves.toMatchObject({
      pickupLocation: null, driverLocation: null, eta: null,
    });
  });
});

describe('Publication GPS d’une course', () => {
  const orderId = 'fixture-order';
  const driverId = 'fixture-driver';
  const latitude = 12.365;
  const longitude = -1.524;

  function createService(status?: OrderStatus) {
    const findOne = jest.fn().mockResolvedValue(status ? { id: orderId, driverId, status } : null);
    const updateDriverLocation = jest.fn().mockResolvedValue(undefined);
    const saveOrderTracePoint = jest.fn().mockResolvedValue(undefined);
    const service: OrdersService = Object.assign(Object.create(OrdersService.prototype), {
      orderRepository: { findOne },
      geoDispatchService: { updateDriverLocation, saveOrderTracePoint },
    });
    return { service, findOne, updateDriverLocation, saveOrderTracePoint };
  }

  it('rattache la position à la course attribuée pendant la livraison', async () => {
    const { service, findOne, saveOrderTracePoint } = createService(OrderStatus.IN_DELIVERY);
    await expect(service.updateDriverLocation(orderId, driverId, latitude, longitude)).resolves.toEqual({ success: true });
    expect(findOne).toHaveBeenCalledWith({ where: { id: orderId, driverId } });
    expect(saveOrderTracePoint).toHaveBeenCalledWith(orderId, latitude, longitude, undefined, driverId);
  });

  it.each([undefined, OrderStatus.COMPLETED])('ne publie rien pour une course inaccessible ou close (%s)', async (status) => {
    const { service, updateDriverLocation, saveOrderTracePoint } = createService(status);
    await expect(service.updateDriverLocation(orderId, driverId, latitude, longitude)).rejects.toMatchObject({ status: 403 });
    expect(updateDriverLocation).not.toHaveBeenCalled();
    expect(saveOrderTracePoint).not.toHaveBeenCalled();
  });

  it('ignore le GPS de présence et la trace d’un autre livreur en suivi P2P', async () => {
    const position = { latitude, longitude, timestamp: new Date().toISOString() };
    const service: OrdersService = Object.assign(Object.create(OrdersService.prototype), {
      findOneForUser: jest.fn().mockResolvedValue({ id: orderId, driverId, orderType: OrderType.P2P_DELIVERY, status: OrderStatus.IN_DELIVERY }),
      geoDispatchService: {
        getDriverLocation: jest.fn(),
        getOrderTrace: jest.fn().mockResolvedValue([
          { ...position, driverId },
          { ...position, latitude: 12.398, driverId: 'other-fixture' },
        ]),
      },
      computeEta: jest.fn().mockReturnValue({ totalMinutes: 5 }),
      getOrderAgencyBadge: jest.fn().mockResolvedValue(null),
    });
    const result = await service.getOrderTracking(orderId, driverId, UserRole.DRIVER);
    expect(result.driverLocation).toMatchObject({ latitude, longitude, driverId });
  });
});

describe('Suivi par lien signé', () => {
  it.each([
    [OrderStatus.IN_DELIVERY, true, 1000],
    [OrderStatus.IN_DELIVERY, false, 360000],
    [OrderStatus.DELIVERED, false, 1000],
  ])('limite la position partagée selon le statut %s et sa fraîcheur', async (status, visible, age) => {
    const position = { latitude: 12.34199, longitude: -1.50422, updatedAt: Date.now() - age };
    const service: OrdersService = Object.assign(Object.create(OrdersService.prototype), {
      resolvePublicTrackingOrderId: () => 'fixture-order',
      orderRepository: { findOne: jest.fn().mockResolvedValue({ id: 'fixture-order', clientId: 'fixture-client' }) },
      getOrderTracking: jest.fn().mockResolvedValue({
        orderId: 'fixture-order',
        status,
        pickupLocation: { latitude: 12.38641, longitude: -1.52128, address: 'Départ', contactPhone: 'privé' },
        dropoffLocation: { latitude: 12.34355, longitude: -1.50379, address: 'Arrivée', contactName: 'privé' },
        driverId: 'fixture-driver',
        driverLocation: position,
        trace: [position],
        eta: { totalMinutes: 3 },
      }),
    });

    const result = await service.getPublicTracking('fixture-token');
    expect(result.driverLocation).toEqual(visible ? position : null);
    expect(result).not.toHaveProperty('trace');
    expect(result).not.toHaveProperty('driverId');
    expect(result.pickupLocation).toEqual({ latitude: 12.38641, longitude: -1.52128, address: 'Départ' });
    expect(result.dropoffLocation).toEqual({ latitude: 12.34355, longitude: -1.50379, address: 'Arrivée' });
  });
});
