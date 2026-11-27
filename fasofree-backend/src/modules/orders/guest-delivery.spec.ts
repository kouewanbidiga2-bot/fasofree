import { ConflictException, GoneException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { GuestDeliveryDto } from './dto/guest-delivery.dto';
import { Order, OrderStatus } from './entities/order.entity';
import { OrdersService } from './orders.service';

const location = {
  address: 'Gounghin',
  latitude: 12.36231,
  longitude: -1.55512,
  contactName: 'Contact test',
  contactPhone: '+22666101010',
};
const guest = {
  checkoutKey: 'a'.repeat(64),
  email: 'payer@example.com',
  name: 'Client test',
  phone: '+22666101011',
  pickupLocation: location,
  dropoffLocation: { ...location, address: 'Karpala', contactPhone: '+22666101012' },
  packageDetails: { description: 'Colis', estimatedValue: 3500, dimensions: { width: 20 } },
};
const orderId = 'fixture-order';

describe('Commande de colis invitée', () => {
  const pending = { id: orderId, status: OrderStatus.AWAITING_PAYMENT, trackingReference: 'fixture-reference' };
  let service: OrdersService;
  let lookup: jest.Mock;
  let checkout: jest.Mock;
  let transactionLookup: jest.Mock;
  let persist: jest.Mock;
  let sms: jest.Mock;

  beforeEach(() => {
    lookup = jest.fn().mockResolvedValue(null);
    checkout = jest.fn().mockResolvedValue({ id: 'test-session', checkoutUrl: 'https://example.com/checkout' });
    transactionLookup = jest.fn().mockResolvedValue(null);
    sms = jest.fn().mockResolvedValue(true);
    persist = jest.fn(async (entity, value) => entity === Order ? { ...value, id: orderId } : { ...value, id: 'fixture-transaction' });
    service = Object.assign(Object.create(OrdersService.prototype), {
      orderRepository: { findOne: lookup, create: (value: object) => value, update: jest.fn() },
      transactionRepository: { findOne: transactionLookup, update: jest.fn() },
      dataSource: { transaction: callback => callback({ save: persist, create: (_entity: unknown, value: object) => value }) },
      distanceCalculatorService: { calculateP2PDelivery: jest.fn().mockReturnValue({ price: 800, distance: 2 }) },
      pricingService: { calculateFinancials: jest.fn().mockResolvedValue({ totalAmount: 900 }) },
      configService: { get: jest.fn() },
      usersService: { findById: jest.fn().mockRejectedValue(new Error('Aucun compte ne doit être consulté')) },
      logger: { log: jest.fn(), error: jest.fn() },
      createPublicTrackingToken: () => 'fixture-token',
      resolvePublicTrackingOrderId: () => orderId,
      generateTransactionReference: () => 'fixture-payment',
      generateDeliveryPin: () => '123456',
      sasPayService: { createCheckoutSession: checkout },
      smsService: { sendSms: sms },
    });
  });

  it('valide les champs du formulaire, y compris les dimensions et la valeur déclarée', async () => {
    const dto = plainToInstance(GuestDeliveryDto, guest);
    await expect(validate(dto, { whitelist: true, forbidNonWhitelisted: true })).resolves.toEqual([]);
  });

  it('ouvre le paiement en attente et conserve un lien de suivi sans compte ni PIN dans la réponse', async () => {
    const result = await service.createGuestDelivery(guest);
    expect(result).toEqual({
      orderId,
      trackingReference: expect.stringMatching(/^[A-F0-9]{20}$/),
      trackingToken: 'fixture-token',
      checkoutUrl: 'https://example.com/checkout',
    });
    expect(persist).toHaveBeenCalledWith(Order, expect.objectContaining({
      clientId: null,
      status: OrderStatus.AWAITING_PAYMENT,
      guestCheckoutKeyHash: expect.not.stringMatching(/^a{64}$/),
    }));
    expect(checkout).toHaveBeenCalledWith(expect.objectContaining({
      amount: 900,
      customerEmail: guest.email,
      customerPhone: guest.phone,
      returnUrl: expect.stringContaining('trackingToken=fixture-token'),
    }));
  });

  it('réutilise la session existante et ne lance aucun deuxième paiement', async () => {
    lookup.mockResolvedValue(pending);
    transactionLookup.mockResolvedValue({ gatewayCheckoutUrl: 'https://example.com/existant' });
    await expect(service.createGuestDelivery(guest)).resolves.toMatchObject({ orderId, checkoutUrl: 'https://example.com/existant' });
    expect(checkout).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
  });

  it('laisse une requête simultanée reprendre la course en cours de préparation', async () => {
    lookup.mockResolvedValueOnce(null).mockResolvedValueOnce(pending);
    persist.mockRejectedValueOnce({ code: '23505' });
    await expect(service.createGuestDelivery(guest)).rejects.toBeInstanceOf(ConflictException);
    expect(checkout).not.toHaveBeenCalled();
  });

  it('demande une nouvelle session après un paiement expiré', async () => {
    lookup.mockResolvedValue({ ...pending, status: OrderStatus.FAILED });
    await expect(service.createGuestDelivery(guest)).rejects.toBeInstanceOf(GoneException);
    expect(checkout).not.toHaveBeenCalled();
  });

  it('envoie le PIN au numéro du destinataire uniquement', async () => {
    lookup.mockResolvedValue({ id: orderId, dropoffLocation: guest.dropoffLocation, deliveryPinCode: '123456' });
    await expect(service.resendPublicDeliveryPin('fixture-token')).resolves.toEqual({ sent: true });
    expect(sms).toHaveBeenCalledWith(guest.dropoffLocation.contactPhone, expect.stringContaining('123456'));
  });
});
