import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';

// Entités et DTOs
import {
  Order,
  OrderStatus,
  OrderType,
  FulfillmentType,
} from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import {
  Transaction,
  TransactionStatus,
} from '../payments/entities/transaction.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { QuoteOrderDto } from './dto/quote-order.dto';

// Gateways et Services
import { DispatchGateway } from '../dispatch/dispatch.gateway';
import { DispatchService } from '../dispatch/dispatch.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { PayoutsService } from '../payments/payouts.service';
import { PayoutStatus } from '../payments/entities/merchant-payout.entity';
import { UserRole } from '../users/entities/user-role.enum';
import { BusinessesService } from '../businesses/businesses.service';
import { PromotionsService } from '../promotions/promotions.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SmsService } from '../notifications/sms.service';
import { UsersService } from '../users/users.service';
import { QrCodeService } from './qr-code.service';
import { DistanceCalculatorService } from './services/distance-calculator.service';
import { DeliveryPricingService } from './delivery-pricing.service';
import {
  GeoDispatchService,
  DriverLocation,
  OrderTracePoint,
} from './dispatch.service';
import {
  MIN_DELIVERY_FEE,
  OrderPricingService,
  PricingQuote,
} from '../financial/order-pricing.service';
import { ReceiptsService } from '../receipts/receipts.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { RidePricingService } from './services/ride-pricing.service';
import { WalletService } from '../wallets/wallet.service';
import { UserRole as WalletUserRole } from '../wallets/entities/wallet.entity';
import { TransactionReason } from '../wallets/entities/wallet-transaction.entity';

/**
 * 💬 Statuts terminaux : le canal de chat éphémère de la commande est archivé.
 */
const CHAT_TERMINAL_STATUSES: OrderStatus[] = [
  OrderStatus.COMPLETED,
  OrderStatus.CANCELLED,
  OrderStatus.FAILED,
  OrderStatus.DISPUTED,
  OrderStatus.REFUNDED,
];

/**
 * 🔄 Machine à États (FSM) des statuts de commande.
 * KEY = statut actuel → VALUES = statuts autorisés en transition.
 *
 * RÈGLES MÉTIER :
 * - PREPARING → READY_FOR_PICKUP : restaurant uniquement
 * - READY_FOR_PICKUP → DRIVER_ASSIGNED : livreur/coursier uniquement
 * - DRIVER_ASSIGNED → IN_DELIVERY : livreur/coursier uniquement (ou restaurant si hasOwnFleet)
 * - IN_DELIVERY → DELIVERED_PENDING_CONFIRMATION : livreur/coursier uniquement (ou restaurant si hasOwnFleet)
 */
const ORDER_STATUS_FSM: Record<string, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.PAID, OrderStatus.CANCELLED],
  [OrderStatus.PAID]: [OrderStatus.IN_PREPARATION, OrderStatus.CANCELLED],
  [OrderStatus.IN_PREPARATION]: [
    OrderStatus.READY_FOR_PICKUP,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.READY_FOR_PICKUP]: [OrderStatus.DRIVER_ASSIGNED, OrderStatus.CANCELLED],
  [OrderStatus.DRIVER_ASSIGNED]: [OrderStatus.IN_DELIVERY, OrderStatus.CANCELLED],
  [OrderStatus.IN_DELIVERY]: [OrderStatus.DELIVERED_PENDING_CONFIRMATION, OrderStatus.CANCELLED],
  [OrderStatus.DELIVERED_PENDING_CONFIRMATION]: [
    OrderStatus.DELIVERED,
    OrderStatus.COMPLETED,
    OrderStatus.DISPUTED,
  ],
  [OrderStatus.DELIVERED]: [OrderStatus.COMPLETED, OrderStatus.DISPUTED, OrderStatus.REFUNDED],
  [OrderStatus.PROCESSING]: [OrderStatus.IN_DELIVERY, OrderStatus.DELIVERED_PENDING_CONFIRMATION, OrderStatus.CANCELLED],
  [OrderStatus.COMPLETED]: [],
  [OrderStatus.CANCELLED]: [],
  [OrderStatus.FAILED]: [],
  [OrderStatus.DISPUTED]: [OrderStatus.REFUNDED, OrderStatus.COMPLETED],
  [OrderStatus.REFUNDED]: [],
};

/**
 * 🔒 Rôles autorisés par transition de statut.
 * Si une transition n'est pas listée ici, elle est refusée.
 */
const DRIVER_TRANSITIONS: OrderStatus[] = [
  OrderStatus.READY_FOR_PICKUP,
  OrderStatus.IN_DELIVERY,
  OrderStatus.DELIVERED_PENDING_CONFIRMATION,
];

const MERCHANT_TRANSITIONS: OrderStatus[] = [
  OrderStatus.IN_PREPARATION,
  OrderStatus.READY_FOR_PICKUP,
  OrderStatus.CANCELLED,
];

/**
 * ⏳ Délai de séquestre financier (3 heures en millisecondes).
 * Les fonds marchand et livreur ne sont libérés qu'après ce délai,
 * sauf si un litige (DISPUTE) est créé avant.
 */
const HOLDING_PERIOD_MS = 3 * 60 * 60 * 1000;

/**
 * 🧾 DTO de réponse pour l'application Mobile Client
 */
export interface ClientInvoiceResponse {
  orderId: string;
  status: OrderStatus;
  invoice: {
    productsSubtotal: number;
    deliveryFee: number;
    totalToPay: number;
    currency: string;
  };
  createdAt: Date;
}

/**
 * 🗺️ Payload de suivi live d'une commande (GPS + ETA).
 */
export interface OrderTrackingPayload {
  orderId: string;
  orderType: OrderType;
  status: OrderStatus;
  trackingActive: boolean;
  driverId: string | null;
  driverLocation: DriverLocation | null;
  trace: OrderTracePoint[];
  businessLocation: { latitude: number; longitude: number } | null;
  pickupLocation: Order['pickupLocation'] | null;
  deliveryLocation: Order['deliveryLocation'] | null;
  eta: {
    preparationMinutes: number;
    remainingPreparationMinutes: number;
    travelMinutes: number;
    totalMinutes: number;
    distanceKm: number;
    arrivalAt: string;
  };
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly dispatchGateway: DispatchGateway,
    private readonly dispatchService: DispatchService,
    private readonly analyticsService: AnalyticsService,
    private readonly payoutsService: PayoutsService,
    private readonly businessesService: BusinessesService,
    private readonly dataSource: DataSource,
    @Inject(forwardRef(() => PromotionsService))
    private readonly promotionsService: PromotionsService,
    private readonly notificationsService: NotificationsService,
    private readonly smsService: SmsService,
    private readonly usersService: UsersService,
    private readonly qrCodeService: QrCodeService,
    private readonly distanceCalculatorService: DistanceCalculatorService,
    private readonly deliveryPricingService: DeliveryPricingService,
    private readonly pricingService: OrderPricingService,
    private readonly receiptsService: ReceiptsService,
    private readonly events: EventEmitter2,
    private readonly configService: ConfigService,
    private readonly geoDispatchService: GeoDispatchService,
    private readonly ridePricingService: RidePricingService,
    private readonly walletService: WalletService,
  ) {}

  /**
   * 🔔 Émet les événements de settlement financier à la livraison/complétion.
   * - `order.delivered` : crédit gains livreur, Pass Journée / micro-commission
   * - `order.completed` : crédit du wallet marchand (payout net)
   * La double-validation par PIN peut passer par plusieurs statuts : les
   * listeners sont rendus idempotents par `reference = order.id` dans le ledger.
   */
  private emitOrderSettlementEvents(
    order: Order,
    previousStatus: OrderStatus,
  ): void {
    const deliveredStates: OrderStatus[] = [
      OrderStatus.DELIVERED_PENDING_CONFIRMATION,
      OrderStatus.DELIVERED,
      OrderStatus.COMPLETED,
    ];

    if (
      deliveredStates.includes(order.status) &&
      !deliveredStates.includes(previousStatus)
    ) {
      this.events.emit('order.delivered', order);
    }

    if (
      order.status === OrderStatus.COMPLETED &&
      previousStatus !== OrderStatus.COMPLETED
    ) {
      this.events.emit('order.completed', order);
    }
  }

  /**
   * 💬 Archive le canal de chat éphémère dès qu'un statut terminal est atteint.
   */
  private notifyChatClosedIfTerminal(
    order: Order,
    previousStatus: OrderStatus,
  ): void {
    if (
      CHAT_TERMINAL_STATUSES.includes(order.status) &&
      !CHAT_TERMINAL_STATUSES.includes(previousStatus)
    ) {
      this.events.emit('order.chat.closed', {
        orderId: order.id,
        status: order.status,
      });
    }
  }

  /**
   * 🛍️ 1. Création d'une commande + Transaction PENDING + Dispatch WebSockets
   */
  async createOrder(clientId: string, dto: CreateOrderDto): Promise<Order> {
    const {
      orderType,
      fulfillmentType,
      fulfillmentDetails,
      deliveryLatitude,
      deliveryLongitude,
      deliveryFee,
      totalAmount: rawSubtotal,
      businessId,
      pickupLocation,
      dropoffLocation,
      packageDetails,
    } = dto;

    // --- 🚚 GESTION P2P DELIVERY ---
    if (orderType === OrderType.P2P_DELIVERY) {
      return this.createP2POrder(clientId, dto);
    }

    // --- 🏍️ GESTION FASOFREE RIDE (VTC / moto-taxi) ---
    if (orderType === OrderType.RIDE) {
      return this.createRideOrder(clientId, dto);
    }

    // --- 🛍️ GESTION MERCHANT (flux existant) ---
    const isDelivery = orderType === OrderType.DELIVERY;

    if (!businessId) {
      throw new BadRequestException(
        'Le commerce (businessId) est obligatoire pour une commande marchand.',
      );
    }

    const business = await this.businessesService.findOne(businessId);
    if (!business.isOpen) {
      throw new BadRequestException('Ce commerce est actuellement fermé');
    }

    if (
      isDelivery &&
      (deliveryLatitude === undefined || deliveryLongitude === undefined)
    ) {
      throw new BadRequestException(
        'Les coordonnées de livraison (latitude, longitude) sont obligatoires pour ce type de commande.',
      );
    }

    // 🧮 DELIVERY_FEE calculée côté serveur : max(distance GPS boutique→client, 800 FCFA).
    // Le montant envoyé par le client (dto.deliveryFee) est ignoré pour les commandes livrées.
    let effectiveDeliveryFee = 0;
    if (isDelivery) {
      const businessLat = business.latitude;
      const businessLng = business.longitude;
      const clientLat = deliveryLatitude;
      const clientLng = deliveryLongitude;
      if (
        businessLat != null &&
        businessLng != null &&
        clientLat != null &&
        clientLng != null
      ) {
        const distance = this.distanceCalculatorService.calculateDistance(
          businessLat,
          businessLng,
          clientLat,
          clientLng,
        );
        effectiveDeliveryFee =
          this.deliveryPricingService.calculateDeliveryFee(distance);
        this.logger.log(
          `[Pricing] Livraison marchand calculée : ${distance} km → ${effectiveDeliveryFee} FCFA (min ${MIN_DELIVERY_FEE})`,
        );
      } else {
        effectiveDeliveryFee = deliveryFee ?? MIN_DELIVERY_FEE;
      }
    }

    let promotionCode: string | null = null;
    let promotionDiscount = 0;
    let reservedPromotionId: string | null = null;
    if (dto.promoCode) {
      const quote = await this.promotionsService.quote(
        dto.promoCode,
        rawSubtotal,
      );
      await this.promotionsService.reserve(quote.promotion.id);
      promotionCode = quote.promotion.code;
      promotionDiscount = quote.discount;
      reservedPromotionId = quote.promotion.id;
    }

    const financials = await this.pricingService.calculateFinancials(
      Math.max(0, Number(rawSubtotal) - promotionDiscount),
      effectiveDeliveryFee,
      { clientId, businessId, orderType },
    );

    const deliveryLocation =
      isDelivery &&
      deliveryLatitude !== undefined &&
      deliveryLongitude !== undefined
        ? { latitude: deliveryLatitude, longitude: deliveryLongitude }
        : undefined;

    const order = this.orderRepository.create({
      clientId,
      businessId,
      orderType,
      fulfillmentType: fulfillmentType || FulfillmentType.DELIVERY,
      fulfillmentDetails,
      productsSubtotal: financials.productsSubtotal,
      itemsTotal: financials.itemsTotal,
      deliveryFee: financials.deliveryFee,
      serviceFee: financials.serviceFee,
      merchantCommissionAmount: financials.merchantCommissionAmount,
      driverCommissionAmount: financials.driverCommissionAmount,
      platformCommission: financials.platformCommission,
      totalAmount: financials.totalAmount,
      merchantPayoutAmount: financials.merchantPayoutAmount,
      commissionPayer: financials.commissionPayer,
      promotionCode,
      promotionDiscount,
      deliveryLocation,
      landmark: dto.landmark ?? undefined,
      status: OrderStatus.PENDING,
      deliveryPinCode: isDelivery ? this.generatePinCode() : null,
      driverId: null,
      driverValidatedAt: null,
      clientValidatedAt: null,
    });

    let savedOrder: Order;
    try {
      savedOrder = await this.orderRepository.save(order);

      // Sauvegarder les articles de la commande (OrderItems)
      if (dto.items && dto.items.length > 0) {
        const orderItems = dto.items.map((item) => {
          const oi = this.orderItemRepository.create({
            orderId: savedOrder.id,
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.quantity * item.unitPrice,
          });
          return oi;
        });
        await this.orderItemRepository.save(orderItems);
      }

      // Générer un QR Code pour les commandes PICKUP ou DINE_IN
      if (
        order.fulfillmentType === FulfillmentType.PICKUP ||
        order.fulfillmentType === FulfillmentType.DINE_IN
      ) {
        const qrCode = await this.qrCodeService.generateAndAssignQrCode(
          savedOrder.id,
        );
        this.logger.log(
          `[QR Code] Généré pour la commande #${savedOrder.id}: ${qrCode ?? ''}`,
        );
      }
    } catch (error) {
      if (reservedPromotionId) {
        await this.promotionsService
          .release(reservedPromotionId)
          .catch(() => undefined);
      }
      throw error;
    }
    this.logger.log(
      `[Order Created] #${savedOrder.id} - Total Client: ${savedOrder.totalAmount} FCFA (Commission: ${savedOrder.platformCommission} FCFA)`,
    );

    const transaction = this.transactionRepository.create({
      orderId: savedOrder.id,
      reference: this.generateTransactionReference(savedOrder.id),
      amount: financials.totalAmount,
      commissionAmount: financials.platformCommission,
      status: TransactionStatus.PENDING,
    });

    await this.transactionRepository.save(transaction);

    try {
      this.dispatchGateway.notifyNewOrderToBusiness(businessId, savedOrder);
      if (isDelivery) {
        this.dispatchGateway.dispatchOrderToDrivers(savedOrder);
      }
    } catch (error) {
      this.logger.error(
        `[WebSocket Error] Échec de la notification temps réel pour la commande #${savedOrder.id}`,
        error.stack,
      );
    }

    return this.findOne(savedOrder.id);
  }

  /**
   * 💬 Devis tarifaire (POST /orders/quote).
   * Calcule et renvoie les montants exacts qui seront verrouillés lors du
   * POST /orders : { subtotal, deliveryFee, platformFee, total }.
   * DELIVERY_FEE = max(calcul distance GPS, 800 FCFA).
   */
  async quoteOrder(clientId: string, dto: QuoteOrderDto): Promise<PricingQuote> {
    const subtotal = Math.max(0, Number(dto.subtotal) || 0);
    let deliveryFee: number;

    if (dto.orderType === OrderType.P2P_DELIVERY) {
      if (!dto.pickupLocation || !dto.dropoffLocation) {
        throw new BadRequestException(
          'Les lieux de ramassage et de livraison sont obligatoires pour un devis P2P',
        );
      }
      const calculation = this.distanceCalculatorService.calculateP2PDelivery(
        dto.pickupLocation.latitude,
        dto.pickupLocation.longitude,
        dto.dropoffLocation.latitude,
        dto.dropoffLocation.longitude,
      );
      deliveryFee = calculation.price;
      this.logger.log(
        `[Quote P2P] Distance: ${calculation.distance} km → livraison ${deliveryFee} FCFA`,
      );
    } else if (dto.orderType === OrderType.RIDE) {
      if (!dto.pickupLocation || !dto.dropoffLocation) {
        throw new BadRequestException(
          'Les lieux de départ et de destination sont obligatoires pour un devis FasoFree Ride',
        );
      }
      const estimate = await this.ridePricingService.estimate(
        dto.pickupLocation.latitude,
        dto.pickupLocation.longitude,
        dto.dropoffLocation.latitude,
        dto.dropoffLocation.longitude,
        clientId,
        dto.rideOption,
      );
      deliveryFee = estimate.fare;
      this.logger.log(
        `[Quote Ride] Distance: ${estimate.distanceKm} km → course ${estimate.fare} FCFA (min 500 FCFA) + plateforme ${estimate.platformFee} FCFA`,
      );
    } else {
      // Coordonnées boutique : businessId en base, sinon fallback fourni par le client
      let businessLatitude: number | undefined = dto.businessLatitude;
      let businessLongitude: number | undefined = dto.businessLongitude;
      if (dto.businessId) {
        const business = await this.businessesService.findOne(dto.businessId);
        businessLatitude = business.latitude ?? undefined;
        businessLongitude = business.longitude ?? undefined;
      }

      if (
        businessLatitude !== undefined &&
        businessLongitude !== undefined &&
        dto.deliveryLatitude !== undefined &&
        dto.deliveryLongitude !== undefined
      ) {
        const distance = this.distanceCalculatorService.calculateDistance(
          businessLatitude,
          businessLongitude,
          dto.deliveryLatitude,
          dto.deliveryLongitude,
        );
        deliveryFee = this.deliveryPricingService.calculateDeliveryFee(distance);
      } else {
        // Pas de coordonnées → tarif minimum garanti
        deliveryFee = MIN_DELIVERY_FEE;
      }
    }

    return this.pricingService.getQuoteBreakdown({
      subtotal,
      deliveryFee,
      clientId,
      orderType: dto.orderType,
      rideOption: dto.rideOption,
    });
  }

  /**
   * 🏍️ Création d'une commande FasoFree Ride (VTC / moto-taxi à la demande).
   * Calquée sur le flux P2P mais avec un vrai séquestre : le wallet CLIENT est
   * débité du total à la création (statut PAID), les gains livreur sont crédités
   * à la livraison (event `order.delivered`), et la plateforme conserve sa part.
   * Aucun remboursement client en cas d'imprévu (règles métier FasoFree).
   */
  private async createRideOrder(
    clientId: string,
    dto: CreateOrderDto,
  ): Promise<Order> {
    const { pickupLocation, dropoffLocation, fulfillmentType } = dto;

    if (!pickupLocation || !dropoffLocation) {
      throw new BadRequestException(
        'Les lieux de départ et de destination sont obligatoires pour une course FasoFree Ride',
      );
    }

    const estimate = await this.ridePricingService.estimate(
      pickupLocation.latitude,
      pickupLocation.longitude,
      dropoffLocation.latitude,
      dropoffLocation.longitude,
      clientId,
      dto.rideOption,
    );

    const financials = await this.pricingService.calculateFinancials(
      0,
      estimate.fare,
      { clientId, orderType: OrderType.RIDE },
    );

    const totalAmount = financials.totalAmount;

    this.logger.log(
      `[Ride Order] Option: ${estimate.rideOption}, Distance: ${estimate.distanceKm} km, Course: ${estimate.fare} FCFA, Service: ${financials.serviceFee} FCFA, Total: ${totalAmount} FCFA`,
    );

    const order = this.orderRepository.create({
      clientId,
      businessId: undefined, // Pas de business pour une course
      orderType: OrderType.RIDE,
      fulfillmentType: fulfillmentType || FulfillmentType.DELIVERY,
      rideOption: estimate.rideOption,
      fulfillmentDetails: {
        notes: `Course FasoFree Ride - ${pickupLocation.address} → ${dropoffLocation.address}`,
      },
      productsSubtotal: 0,
      itemsTotal: 0,
      deliveryFee: financials.deliveryFee,
      serviceFee: financials.serviceFee,
      merchantCommissionAmount: 0,
      driverCommissionAmount: 0,
      platformCommission: financials.platformCommission,
      totalAmount,
      merchantPayoutAmount: 0, // Pas de payout marchand
      commissionPayer: financials.commissionPayer,
      pickupLocation,
      dropoffLocation,
      deliveryLocation: {
        latitude: dropoffLocation.latitude,
        longitude: dropoffLocation.longitude,
      },
      // 💳 Séquestre : le client est débité immédiatement → statut PAID (dispatch activé)
      status: OrderStatus.PAID,
      deliveryPinCode: this.generatePinCode(),
      driverId: null,
      driverValidatedAt: null,
      clientValidatedAt: null,
    });

    const savedOrder = await this.orderRepository.save(order);

    // 🏦 Débit du wallet client (séquestre). En cas d'échec (solde insuffisant),
    // la commande est supprimée et l'erreur propagée → aucune course sans paiement.
    try {
      await this.walletService.debitWallet(
        clientId,
        WalletUserRole.CUSTOMER,
        totalAmount,
        TransactionReason.ORDER_PAYMENT,
        `ESCROW-${savedOrder.id}`,
        `Séquestre course FasoFree Ride #${savedOrder.id} (${estimate.distanceKm} km)`,
      );
    } catch (error) {
      await this.orderRepository.delete(savedOrder.id).catch(() => undefined);
      this.logger.error(
        `[Ride Order] Débit séquestre échoué pour la commande #${savedOrder.id}: ${error.message}`,
      );
      throw error;
    }

    this.logger.log(
      `[Ride Order Created] #${savedOrder.id} - Total séquestré: ${totalAmount} FCFA (Distance: ${estimate.distanceKm} km)`,
    );

    const transaction = this.transactionRepository.create({
      orderId: savedOrder.id,
      reference: this.generateTransactionReference(savedOrder.id),
      amount: totalAmount,
      commissionAmount: financials.platformCommission,
      status: TransactionStatus.SUCCESS,
    });

    await this.transactionRepository.save(transaction);

    // 🧾 Reçu client automatique (non bloquant en cas d'échec)
    try {
      await this.receiptsService.createClientOrderReceipt(savedOrder);
    } catch (receiptError) {
      this.logger.warn(
        `[Receipt] Échec reçu client pour ${savedOrder.id}: ${receiptError.message}`,
      );
    }

    // 🚀 Dispatch aux chauffeurs : broadcast (tous les livreurs en ligne)
    // puis offre ciblée aux meilleurs candidats (scoring distance + note).
    try {
      this.dispatchGateway.dispatchOrderToDrivers(savedOrder);
      this.dispatchService
        .autoDispatchOrder(savedOrder.id)
        .catch((err) => {
          this.logger.error(
            `[Auto-Dispatch Error] Échec du dispatch Ride #${savedOrder.id}: ${err.message}`,
          );
        });
    } catch (error) {
      this.logger.error(
        `[WebSocket Error] Échec du dispatch Ride pour la commande #${savedOrder.id}`,
        error.stack,
      );
    }

    return this.findOne(savedOrder.id);
  }

  /**
   * 🚚 Création d'une commande P2P (Course à la demande)
   */
  private async createP2POrder(
    clientId: string,
    dto: CreateOrderDto,
  ): Promise<Order> {
    const { pickupLocation, dropoffLocation, packageDetails, fulfillmentType } =
      dto;

    // Validation des champs P2P
    if (!pickupLocation || !dropoffLocation) {
      throw new BadRequestException(
        'Les lieux de ramassage et de livraison sont obligatoires pour une course P2P',
      );
    }

    // Calcul du prix basé sur la distance
    const deliveryCalculation =
      this.distanceCalculatorService.calculateP2PDelivery(
        pickupLocation.latitude,
        pickupLocation.longitude,
        dropoffLocation.latitude,
        dropoffLocation.longitude,
        packageDetails?.isFragile || false,
        packageDetails?.weight || 0,
      );

    const financials = await this.pricingService.calculateFinancials(
      0,
      deliveryCalculation.price,
      { clientId, orderType: OrderType.P2P_DELIVERY },
    );

    const totalAmount = financials.totalAmount;

    this.logger.log(
      `[P2P Order] Distance: ${deliveryCalculation.distance} km, Prix de base: ${deliveryCalculation.price} FCFA, Service: ${financials.serviceFee} FCFA, Total: ${totalAmount} FCFA`,
    );

    const order = this.orderRepository.create({
      clientId,
      businessId: undefined, // Pas de business pour P2P
      orderType: OrderType.P2P_DELIVERY,
      fulfillmentType: fulfillmentType || FulfillmentType.DELIVERY,
      fulfillmentDetails: {
        notes: packageDetails?.description,
      },
      productsSubtotal: 0, // Pas de produits pour P2P
      itemsTotal: 0,
      deliveryFee: financials.deliveryFee,
      serviceFee: financials.serviceFee,
      merchantCommissionAmount: 0,
      driverCommissionAmount: 0,
      platformCommission: financials.platformCommission,
      totalAmount,
      merchantPayoutAmount: 0, // Pas de payout pour P2P
      commissionPayer: financials.commissionPayer,
      pickupLocation,
      dropoffLocation,
      packageDetails,
      deliveryLocation: {
        latitude: dropoffLocation.latitude,
        longitude: dropoffLocation.longitude,
      },
      status: OrderStatus.PENDING,
      deliveryPinCode: this.generatePinCode(),
      driverId: null,
      driverValidatedAt: null,
      clientValidatedAt: null,
    });

    const savedOrder = await this.orderRepository.save(order);

    this.logger.log(
      `[P2P Order Created] #${savedOrder.id} - Total: ${savedOrder.totalAmount} FCFA (Distance: ${deliveryCalculation.distance} km)`,
    );

    // Créer la transaction
    const transaction = this.transactionRepository.create({
      orderId: savedOrder.id,
      reference: this.generateTransactionReference(savedOrder.id),
      amount: totalAmount,
      commissionAmount: financials.platformCommission,
      status: TransactionStatus.PENDING,
    });

    await this.transactionRepository.save(transaction);

    // Dispatch directement aux chauffeurs (pas de business pour P2P)
    try {
      this.dispatchGateway.dispatchOrderToDrivers(savedOrder);
    } catch (error) {
      this.logger.error(
        `[WebSocket Error] Échec du dispatch P2P pour la commande #${savedOrder.id}`,
        error.stack,
      );
    }

    return this.findOne(savedOrder.id);
  }

  /**
   * 🛵 Acceptation d'une course / livraison par un livreur (DRIVER) ou coursier (COURIER).
   * Verrouille l'assignation : driverId fixé et statut → PROCESSING (le GPS est alors diffusé au client).
   */
  async acceptOrder(orderId: string, driverId: string): Promise<Order> {
    const order = await this.findOne(orderId);

    if (order.driverId && order.driverId !== driverId) {
      throw new ForbiddenException(
        'Cette course a déjà été acceptée par un autre livreur',
      );
    }

    if (order.driverId === driverId) {
      return order;
    }

    if (
      order.status !== OrderStatus.PENDING &&
      order.status !== OrderStatus.PAID
    ) {
      throw new BadRequestException(
        `Impossible d'accepter : la commande est au statut "${order.status}"`,
      );
    }

    const previousStatus = order.status;
    order.driverId = driverId;
    order.status = OrderStatus.PROCESSING;

    const saved = await this.orderRepository.save(order);

    // 🔔 Notifier le client et le livreur en temps réel (room order_<id>)
    try {
      this.dispatchGateway.server
        .to(`order_${orderId}`)
        .emit('orderAccepted', {
          message: '🛵 Un livreur a accepté votre course !',
          orderId,
          driverId,
        });
    } catch (error) {
      this.logger.warn(
        `Notification WebSocket échouée: ${error?.message || error}`,
      );
    }

    this.logger.log(
      `[Order Accepted] Commande #${orderId} acceptée par le livreur ${driverId} (${previousStatus} → PROCESSING)`,
    );

    return saved;
  }

  /**
   * 🎯 Assignation manuelle d'un livreur à une commande (admin/support).
   * Délègue au DispatchService qui notifie le livreur via WebSocket.
   */
  async assignDriverToOrder(
    orderId: string,
    driverId: string,
  ): Promise<Order> {
    return this.dispatchService.assignDriverToOrder(orderId, driverId);
  }

  public formatClientInvoiceResponse(order: Order): ClientInvoiceResponse {
    return {
      orderId: order.id,
      status: order.status,
      invoice: {
        productsSubtotal: Number(order.productsSubtotal),
        deliveryFee: Number(order.deliveryFee),
        totalToPay: Number(order.totalAmount),
        currency: 'FCFA',
      },
      createdAt: order.createdAt,
    };
  }

  async findClientOrders(clientId: string): Promise<Order[]> {
    return await this.orderRepository.find({
      where: { clientId },
      relations: { items: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findRecentForUser(userId: string, limit = 5): Promise<any[]> {
    const orders = await this.orderRepository.find({
      where: { clientId: userId },
      relations: { items: true },
      order: { createdAt: 'DESC' },
      take: limit,
    });

    return orders.map((o) => ({
      id: o.id,
      businessId: o.businessId,
      status: o.status,
      totalAmount: o.totalAmount,
      items: o.items?.map((i) => ({ name: i.productName, quantity: i.quantity })),
      createdAt: o.createdAt,
    }));
  }

  async findAllByBusiness(businessId: string): Promise<Order[]> {
    return await this.orderRepository.find({
      where: { businessId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * 🎛️ Tour de contrôle : liste globale des commandes pour
   * SUPER_ADMIN / ADMIN / SUPPORT. Attache la position live du livreur
   * lorsqu'un coursier est assigné (pour l'affichage carte).
   */
  async findAllForAdmin(
    options: { status?: OrderStatus } = {},
  ): Promise<Order[]> {
    const orders = await this.orderRepository.find({
      where: options.status ? { status: options.status } : {},
      order: { createdAt: 'DESC' },
      take: 200,
    });

    for (const order of orders) {
      if (order.driverId) {
        const loc = await this.geoDispatchService.getDriverLocation(
          order.driverId,
        );
        (order as Order & { driverLocation?: DriverLocation | null }).driverLocation =
          loc;
      }
    }

    return orders;
  }

  async findOne(id: string): Promise<Order> {
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRe.test(id)) {
      throw new NotFoundException(`La commande #${id} est introuvable.`);
    }
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: { items: true },
    });

    if (!order) {
      throw new NotFoundException(`La commande #${id} est introuvable.`);
    }

    return order;
  }

  async findOneForUser(
    id: string,
    userId: string,
    role: UserRole,
  ): Promise<Order> {
    const order = await this.findOne(id);
    if (role === UserRole.SUPER_ADMIN || order.clientId === userId)
      return order;
    // Livreur assigné : accès au suivi live et au chat (coursier de la course)
    if (order.driverId === userId) return order;
    if (!order.businessId)
      throw new ForbiddenException("Vous n'avez pas accès à cette commande.");
    await this.businessesService.assertManagedBy(
      order.businessId,
      userId,
      role,
    );
    return order;
  }

  /**
   * 🗺️ Suivi live de la commande : statut + dernière position GPS + tracé + ETA.
   */
  async getOrderTracking(
    id: string,
    userId: string,
    role: UserRole,
  ): Promise<OrderTrackingPayload> {
    const order = await this.findOneForUser(id, userId, role);

    let driverLocation: DriverLocation | null = null;
    if (order.driverId) {
      try {
        driverLocation = await this.geoDispatchService.getDriverLocation(
          order.driverId,
        );
      } catch {
        this.logger.warn(
          `Impossible de récupérer la position du livreur ${order.driverId} pour la commande ${id}`,
        );
      }
    }

    let trace: OrderTracePoint[] = [];
    try {
      trace = await this.geoDispatchService.getOrderTrace(order.id);
    } catch {
      this.logger.warn(
        `Impossible de récupérer le tracé GPS de la commande ${id}`,
      );
    }

    let businessLocation: { latitude: number; longitude: number } | null =
      null;
    if (order.businessId) {
      try {
        const business = await this.businessesService.findOne(order.businessId);
        if (business?.latitude != null && business?.longitude != null) {
          businessLocation = {
            latitude: business.latitude,
            longitude: business.longitude,
          };
        }
      } catch {
        this.logger.warn(
          `Commerce ${order.businessId} introuvable pour le tracking de la commande ${id}`,
        );
      }
    }

    let eta: OrderTrackingPayload['eta'] = {
      preparationMinutes: 0,
      remainingPreparationMinutes: 0,
      travelMinutes: 0,
      totalMinutes: 0,
      distanceKm: 0,
      arrivalAt: new Date().toISOString(),
    };
    try {
      eta = this.computeEta(order, driverLocation, businessLocation);
    } catch {
      this.logger.warn(
        `Impossible de calculer l'ETA pour la commande ${id}`,
      );
    }

    return {
      orderId: order.id,
      orderType: order.orderType,
      status: order.status,
      trackingActive: order.status === OrderStatus.PROCESSING,
      driverId: order.driverId ?? null,
      driverLocation,
      trace,
      businessLocation,
      pickupLocation: order.pickupLocation ?? null,
      deliveryLocation: order.deliveryLocation ?? null,
      eta,
    };
  }

  /**
   * ⏱️ Estimateur de temps : préparation marchand + trajet GPS.
   */
  private computeEta(
    order: Order,
    driverLocation: DriverLocation | null,
    businessLocation: { latitude: number; longitude: number } | null,
  ): OrderTrackingPayload['eta'] {
    const prepTotal = Number(
      this.configService.get('MERCHANT_PREP_TIME_MINUTES', 15),
    );
    const avgSpeedKmh = Number(
      this.configService.get('DELIVERY_AVG_SPEED_KMH', 25),
    );

    // ⏳ Temps de préparation restant (dégressif pendant la préparation)
    let remainingPrep = 0;
    if (
      order.status === OrderStatus.PAID ||
      order.status === OrderStatus.IN_PREPARATION
    ) {
      const startedAt = order.createdAt?.getTime() ?? Date.now();
      const elapsedMinutes = Math.max(0, (Date.now() - startedAt) / 60000);
      remainingPrep = Math.max(0, Math.ceil(prepTotal - elapsedMinutes));
    }

    // 📍 Destination (livraison marchand ou point de dépôt P2P)
    const dest = order.deliveryLocation
      ? {
          latitude: order.deliveryLocation.latitude,
          longitude: order.deliveryLocation.longitude,
        }
      : order.dropoffLocation?.latitude != null &&
        order.dropoffLocation?.longitude != null
        ? {
            latitude: order.dropoffLocation.latitude,
            longitude: order.dropoffLocation.longitude,
          }
        : null;

    // 📍 Origine du trajet : livreur (temps réel) > commerce > point de ramassage
    const origin = driverLocation
      ? {
          latitude: driverLocation.latitude,
          longitude: driverLocation.longitude,
        }
      : businessLocation
        ? businessLocation
        : order.pickupLocation?.latitude != null &&
            order.pickupLocation?.longitude != null
          ? {
              latitude: order.pickupLocation.latitude,
              longitude: order.pickupLocation.longitude,
            }
          : null;

    let distanceKm = 0;
    if (origin && dest) {
      distanceKm = this.distanceCalculatorService.calculateDistance(
        origin.latitude,
        origin.longitude,
        dest.latitude,
        dest.longitude,
      );
    }

    const travelMinutes =
      distanceKm > 0 ? Math.ceil((distanceKm / avgSpeedKmh) * 60) : 0;
    const totalMinutes = remainingPrep + travelMinutes;

    return {
      preparationMinutes: prepTotal,
      remainingPreparationMinutes: remainingPrep,
      travelMinutes,
      totalMinutes,
      distanceKm: Math.round(distanceKm * 100) / 100,
      arrivalAt: new Date(Date.now() + totalMinutes * 60000).toISOString(),
    };
  }

  async markAsPaidAndDispatch(
    orderId: string,
    transactionId: string,
  ): Promise<void> {
    this.logger.log(
      `[Order Paid] Validation de la commande ${orderId} (Tx: ${transactionId})`,
    );

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const order = await queryRunner.manager.findOne(Order, {
        where: { id: orderId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!order) {
        throw new NotFoundException(`Commande ${orderId} introuvable.`);
      }

      if (order.status === OrderStatus.PAID) {
        this.logger.warn(
          `La commande ${orderId} est déjà marquée comme payée.`,
        );
        await queryRunner.rollbackTransaction();
        return;
      }

      order.status = OrderStatus.PAID;
      order.paymentTransactionRef = transactionId; // CORRIGÉ : Correspond au nom dans l'entité
      await queryRunner.manager.save(order);

      const transaction = await queryRunner.manager.findOne(Transaction, {
        where: { orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (transaction) {
        transaction.status = TransactionStatus.SUCCESS;
        transaction.paymentGatewayId = transactionId;
        await queryRunner.manager.save(transaction);
      }

      await queryRunner.commitTransaction();

      this.logger.log(
        `[Dispatch] Recherche d'un livreur pour la commande ${orderId}`,
      );
      this.dispatchGateway.dispatchOrderToDrivers(order); // Ajout manquant

      // 🧾 Reçu client automatique (ne bloque jamais le flux en cas d'échec)
      try {
        await this.receiptsService.createClientOrderReceipt(order);
      } catch (receiptError) {
        this.logger.warn(
          `[Receipt] Échec reçu client pour ${orderId}: ${receiptError.message}`,
        );
      }
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Erreur lors de la validation de la commande ${orderId}: ${error.message}`,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async markAsPaymentFailed(orderId: string): Promise<void> {
    this.logger.warn(
      `[Payment Failed] Annulation de la commande ${orderId} pour échec de paiement`,
    );

    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });
    if (!order) {
      this.logger.error(`Commande ${orderId} introuvable pour l'annulation.`);
      return;
    }

    order.status = OrderStatus.FAILED;
    await this.orderRepository.save(order);
  }

  async updateStatus(
    id: string,
    status: OrderStatus,
    userId: string,
    role: UserRole,
  ): Promise<Order> {
    const order = await this.orderRepository.findOne({ where: { id } });

    if (!order) {
      throw new NotFoundException(`Commande avec l'ID #${id} introuvable.`);
    }

    const previousStatus = order.status;

    // 🔒 1. Vérifier que la transition est possible dans la FSM
    const allowedTransitions = ORDER_STATUS_FSM[previousStatus] || [];
    if (!allowedTransitions.includes(status)) {
      throw new BadRequestException(
        `Transition invalide : ${previousStatus} → ${status}. Transitions autorisées : ${allowedTransitions.join(', ') || 'aucune'}`,
      );
    }

    // 🔒 2. Vérifier que le rôle est autorisé pour cette transition
    const isDriverTransition = DRIVER_TRANSITIONS.includes(status);
    const isMerchantTransition =
      MERCHANT_TRANSITIONS.includes(status) ||
      status === OrderStatus.CANCELLED;

    // Déterminer si c'est une flotte interne (hasOwnDrivers)
    let hasOwnFleet = false;
    if (order.businessId) {
      try {
        const business = await this.businessesService.findOne(order.businessId);
        hasOwnFleet = business?.hasOwnDrivers === true;
      } catch {
        // fallback: pas de fleet interne
      }
    }

    const isDriver = role === UserRole.DRIVER || role === UserRole.COURIER;
    const isMerchant = role === UserRole.BUSINESS_ADMIN;

    // Le restaurant peut gérer IN_DELIVERY / DELIVERED uniquement si hasOwnFleet
    if (isDriverTransition) {
      if (isDriver) {
        // OK — le livreur peut faire ces transitions
      } else if (isMerchant && hasOwnFleet) {
        // OK — le restaurant avec flotte interne peut gérer
      } else if (role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN) {
        // OK — admin peut tout
      } else {
        throw new ForbiddenException(
          `Transition ${status} réservée aux livreurs/coursiers` +
            (hasOwnFleet ? '' : ' (flotte interne non activée)'),
        );
      }
    }

    if (isMerchantTransition && isDriver) {
      throw new ForbiddenException(
        `Transition ${status} réservée au restaurant`,
      );
    }

    // ✅ Appliquer la transition
    order.status = status;
    const updatedOrder = await this.orderRepository.save(order);

    // ⏳ 3. Séquestre financier : programmer la libération des fonds à J+3h
    if (status === OrderStatus.DELIVERED && previousStatus !== OrderStatus.DELIVERED) {
      updatedOrder.payoutScheduledAt = new Date(Date.now() + HOLDING_PERIOD_MS);
      updatedOrder.payoutReleased = false;
      await this.orderRepository.save(updatedOrder);
      this.logger.log(
        `[Holding] Commande #${id} → séquestre 3h (libération prévue ${updatedOrder.payoutScheduledAt.toISOString()})`,
      );
    }

    // 🔔 Settlement financier : livreur (delivered) & marchand (completed)
    this.emitOrderSettlementEvents(updatedOrder, previousStatus);
    // 💬 Archivage du chat éphémère si la commande atteint un statut terminal
    this.notifyChatClosedIfTerminal(updatedOrder, previousStatus);

    // 🚀 Auto-Dispatch: Quand la commande est en préparation
    if (
      (status === OrderStatus.PAID || status === OrderStatus.IN_PREPARATION) &&
      previousStatus !== OrderStatus.PAID &&
      previousStatus !== OrderStatus.IN_PREPARATION
    ) {
      this.logger.log(
        `[Auto-Dispatch] Déclenchement du dispatch automatique pour la commande #${id}`,
      );
      this.dispatchService.autoDispatchOrder(id).catch((err) => {
        this.logger.error(
          `[Auto-Dispatch Error] Échec du dispatch pour la commande #${id}: ${err.message}`,
        );
      });
    }

    // 📱 Notifications FCM & WebSocket selon le statut
    await this.sendStatusNotifications(updatedOrder, previousStatus);

    try {
      await this.analyticsService.invalidateMerchantCache(order.businessId);
    } catch (error) {
      this.logger.warn(
        `Échec invalidation cache analytics: ${error?.message || error}`,
      );
    }

    return updatedOrder;
  }

  // ========================================================================
  // 🔑 GÉNÉRATION DU CODE PIN (4 chiffres aléatoires)
  // ========================================================================
  private generatePinCode(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  // ========================================================================
  // 🆔 Référence interne unique de transaction (colonne NOT NULL / UNIQUE)
  // ========================================================================
  private generateTransactionReference(orderId: string): string {
    const time = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `FSF-${orderId.slice(0, 8)}-${time.slice(-4)}${rand}`;
  }

  // ========================================================================
  // 🚚 VALIDATION PAR LE LIVREUR/COURSIER
  // Le livreur signale qu'il a effectué la livraison
  // ========================================================================
  async driverValidateDelivery(
    orderId: string,
    driverId: string,
  ): Promise<Order> {
    const order = await this.findOne(orderId);

    if (order.driverId && order.driverId !== driverId) {
      throw new ForbiddenException(
        "Vous n'êtes pas le livreur assigné à cette commande",
      );
    }

    if (order.driverValidatedAt) {
      throw new BadRequestException(
        'Vous avez déjà validé la livraison de cette commande',
      );
    }

    if (
      order.status !== OrderStatus.PAID &&
      order.status !== OrderStatus.PROCESSING &&
      order.status !== OrderStatus.IN_PREPARATION
    ) {
      throw new BadRequestException(
        `Impossible de valider : la commande est au statut "${order.status}"`,
      );
    }

    const previousStatus = order.status;
    order.driverId = driverId;
    order.driverValidatedAt = new Date();
    order.status = OrderStatus.DELIVERED_PENDING_CONFIRMATION;

    const saved = await this.orderRepository.save(order);

    // 🔔 Settlement livreur : crédit gains + Pass Journée / micro-commission
    this.emitOrderSettlementEvents(saved, previousStatus);

    this.logger.log(
      `[Driver Validated] Commande #${orderId} marquée livrée par le livreur ${driverId}. En attente du Code PIN du client.`,
    );

    // Notifier le client en temps réel
    try {
      this.dispatchGateway.server
        .to(`order_${orderId}`)
        .emit('deliveryPendingConfirmation', {
          message:
            '📦 Le livreur a marqué votre commande comme livrée. Veuillez confirmer avec votre Code PIN.',
          orderId,
        });
    } catch (e) {
      this.logger.warn(`Notification WebSocket échouée: ${e?.message}`);
    }

    return saved;
  }

  // ========================================================================
  // ✅ VALIDATION PAR LE CLIENT (avec Code PIN)
  // Le client confirme la réception en saisissant son Code PIN
  // ========================================================================
  async clientValidateWithPin(
    orderId: string,
    clientId: string,
    pinCode: string,
  ): Promise<Order> {
    const order = await this.findOne(orderId);

    if (order.clientId !== clientId) {
      throw new ForbiddenException('Cette commande ne vous appartient pas');
    }

    if (order.status !== OrderStatus.DELIVERED_PENDING_CONFIRMATION) {
      throw new BadRequestException(
        `La commande n'est pas en attente de confirmation (statut actuel: "${order.status}")`,
      );
    }

    if (!order.deliveryPinCode || order.deliveryPinCode !== pinCode) {
      throw new BadRequestException('Code PIN invalide. Veuillez réessayer.');
    }

    order.clientValidatedAt = new Date();
    order.status = OrderStatus.COMPLETED;

    const saved = await this.orderRepository.save(order);

    // 🔔 Settlement marchand : crédit du wallet (payout net de commission)
    this.emitOrderSettlementEvents(
      saved,
      OrderStatus.DELIVERED_PENDING_CONFIRMATION,
    );
    // 💬 Archivage du chat éphémère (commande COMPLETED)
    this.notifyChatClosedIfTerminal(
      saved,
      OrderStatus.DELIVERED_PENDING_CONFIRMATION,
    );

    this.logger.log(
      `[Order Completed] ✅ Commande #${orderId} validée par le client avec Code PIN. Double validation réussie !`,
    );

    // Déclencher le Payout automatique au marchand
    this.payoutsService.processAutomaticPayout(saved.id).catch((err) => {
      this.logger.error(`Erreur Payout après validation PIN #${saved.id}`, err);
    });

    // Invalider le cache analytics
    try {
      await this.analyticsService.invalidateMerchantCache(order.businessId);
    } catch (error) {
      this.logger.warn(
        `Échec invalidation cache analytics: ${error?.message || error}`,
      );
    }

    return saved;
  }

  // ========================================================================
  // ⚠️ LITIGE (DISPUTE)
  // Le client conteste la livraison
  // ========================================================================
  async disputeOrder(
    orderId: string,
    clientId: string,
    reason: string,
  ): Promise<Order> {
    const order = await this.findOne(orderId);

    if (order.clientId !== clientId) {
      throw new ForbiddenException('Cette commande ne vous appartient pas');
    }

    if (
      order.status !== OrderStatus.DELIVERED_PENDING_CONFIRMATION &&
      order.status !== OrderStatus.DELIVERED
    ) {
      throw new BadRequestException(
        `Impossible d'ouvrir un litige : la commande est au statut "${order.status}"`,
      );
    }

    order.status = OrderStatus.DISPUTED;
    const saved = await this.orderRepository.save(order);

    // 💬 Archivage du chat éphémère (commande DISPUTED = statut terminal)
    this.notifyChatClosedIfTerminal(saved, OrderStatus.DELIVERED);

    this.logger.warn(
      `[DISPUTE] ⚠️ Litige ouvert sur la commande #${orderId} par le client ${clientId}. Raison: ${reason}`,
    );

    return saved;
  }

  // ========================================================================
  // 📱 Notifications FCM & WebSocket selon le statut de commande
  // ========================================================================
  private async sendStatusNotifications(
    order: Order,
    previousStatus: OrderStatus,
  ): Promise<void> {
    try {
      // Récupérer le client pour son FCM token
      const client = await this.usersService.findById(order.clientId);
      const clientFcmToken = client?.fcmToken;

      // Récupérer le livreur assigné pour son FCM token
      let driverFcmToken: string | null = null;
      if (order.driverId) {
        const driver = await this.usersService.findById(order.driverId);
        driverFcmToken = driver?.fcmToken ?? null;
      }

      // Notifier selon le nouveau statut
      switch (order.status) {
        case OrderStatus.PAID: {
          // Client: "Votre commande a été confirmée par le restaurant"
          const fcmSuccess = clientFcmToken
            ? await this.notificationsService.sendToDevice(clientFcmToken, {
                title: 'Commande confirmée ✅',
                body: 'Votre commande a été confirmée par le restaurant. Préparation en cours!',
                data: { orderId: order.id, type: 'ORDER_CONFIRMED' },
              })
            : false;

          // SMS fallback si FCM échoue ou pas de token
          if (!fcmSuccess && client?.phone) {
            await this.smsService.sendOrderConfirmationSms(
              client.phone,
              order.id,
              order.totalAmount,
            );
          }
          break;
        }

        case OrderStatus.IN_PREPARATION:
          // Client: "Votre commande est en préparation"
          if (clientFcmToken) {
            await this.notificationsService.sendToDevice(clientFcmToken, {
              title: 'En préparation 🍳',
              body: 'Votre commande est en cours de préparation.',
              data: { orderId: order.id, type: 'ORDER_PREPARING' },
            });
          }
          break;

        case OrderStatus.PROCESSING: {
          // Client: "Le livreur est en route avec votre repas"
          const fcmEnRouteSuccess = clientFcmToken
            ? await this.notificationsService.sendToDevice(clientFcmToken, {
                title: 'Livreur en route 🛵',
                body: 'Le livreur est en route avec votre repas. Il arrivera bientôt!',
                data: { orderId: order.id, type: 'DRIVER_EN_ROUTE' },
              })
            : false;

          // SMS fallback si FCM échoue
          if (!fcmEnRouteSuccess && client?.phone) {
            await this.smsService.sendDeliveryNotificationSms(
              client.phone,
              order.id,
            );
          }
          break;
        }

        case OrderStatus.DELIVERED:
          // Client: "Le livreur est arrivé à destination"
          if (clientFcmToken) {
            await this.notificationsService.sendToDevice(clientFcmToken, {
              title: 'Livreur arrivé 📍',
              body: 'Le livreur est arrivé à destination. Prêt à récupérer votre commande!',
              data: { orderId: order.id, type: 'DRIVER_ARRIVED' },
            });
          }
          break;

        case OrderStatus.COMPLETED:
          // Client: "Commande livrée avec succès"
          if (clientFcmToken) {
            await this.notificationsService.sendToDevice(clientFcmToken, {
              title: 'Commande livrée 🎉',
              body: 'Votre commande a été livrée avec succès. Bon appétit!',
              data: { orderId: order.id, type: 'ORDER_COMPLETED' },
            });
          }
          break;
      }

      this.logger.log(
        `[Notifications] Notifications envoyées pour la commande #${order.id} (statut: ${order.status})`,
      );
    } catch (error) {
      this.logger.error(
        `[Notifications Error] Échec de l'envoi des notifications pour la commande #${order.id}: ${error.message}`,
      );
    }
  }

  // ========================================================================
  // ⏰ CRON : Auto-complétion des commandes après 24h sans action du client
  // S'exécute toutes les heures
  // ========================================================================
  @Cron(CronExpression.EVERY_HOUR)
  async autoCompleteStaleOrders(): Promise<void> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const staleOrders = await this.orderRepository
      .createQueryBuilder('o')
      .where('o.status = :status', {
        status: OrderStatus.DELIVERED_PENDING_CONFIRMATION,
      })
      .andWhere('o.driverValidatedAt < :cutoff', {
        cutoff: twentyFourHoursAgo,
      })
      .getMany();

    if (staleOrders.length === 0) return;

    this.logger.log(
      `[Auto-Complete Cron] ${staleOrders.length} commande(s) en attente depuis plus de 24h. Complétion automatique...`,
    );

    for (const order of staleOrders) {
      order.status = OrderStatus.COMPLETED;
      order.clientValidatedAt = new Date();
      await this.orderRepository.save(order);

      // 🔔 Settlement marchand (cron auto-complétion 24h)
      this.emitOrderSettlementEvents(
        order,
        OrderStatus.DELIVERED_PENDING_CONFIRMATION,
      );

      this.payoutsService.processAutomaticPayout(order.id).catch((err) => {
        this.logger.error(`Erreur Payout auto-complete #${order.id}`, err);
      });

      this.logger.log(
        `[Auto-Completed] Commande #${order.id} complétée automatiquement (24h sans action client).`,
      );
    }
  }

  // ========================================================================
  // ⏳ CRON : Séquestre financier 3h — libération des fonds après holding
  // Vérifie toutes les 5 minutes les commandes dont le payoutScheduledAt est
  // dépassé et dont aucun litige n'a été créé.
  //
  // Machine à états du payout (anti-double-paiement) :
  //   due → payout UNIQUE créé → processing → succès CONFIRMÉ → payoutReleased=true
  //   échec certain (FAILED/PENDING) → retry (réclamation atomique)
  //   timeout / état inconnu (PROCESSING) → PAS de 2e payout ; réconcilier
  //
  // Deux instances concurrentes sont sûres :
  //   • création : index UNIQUE sur merchant_payouts.orderId (+ garde-fou)
  //   • retry     : réclamation atomique UPDATE conditionnelle (claimAndExecute)
  // ========================================================================
  @Cron('*/5 * * * *')
  async releaseHeldPayouts(): Promise<void> {
    const now = new Date();

    const heldOrders = await this.orderRepository
      .createQueryBuilder('o')
      .where('o."payoutScheduledAt" IS NOT NULL')
      .andWhere('o."payoutScheduledAt" <= :now', { now })
      .andWhere('o."payoutReleased" = false')
      .andWhere('o.status != :disputed', { disputed: OrderStatus.DISPUTED })
      .andWhere('o.status != :cancelled', { cancelled: OrderStatus.CANCELLED })
      .andWhere('o.status != :refunded', { refunded: OrderStatus.REFUNDED })
      .getMany();

    if (heldOrders.length === 0) return;

    this.logger.log(
      `[Holding Cron] ${heldOrders.length} commande(s) à libérer après séquestre 3h`,
    );

    for (const order of heldOrders) {
      try {
        // Délègue à PayoutsService la logique idempotente (payout unique +
        // réconciliation). Returns le payout (créé ou existant) et son statut.
        const payout = await this.payoutsService.processAutomaticPayout(
          order.id,
        );

        if (payout?.status === PayoutStatus.SUCCESS) {
          // ✅ Virement CONFIRMÉ → on libère seulement maintenant.
          await this.orderRepository.update(order.id, {
            payoutReleased: true,
          });
          this.logger.log(
            `[Holding Released] Commande #${order.id} — payout SUCCESS, fonds libérés (pas de litige)`,
          );
        } else if (
          payout?.status === PayoutStatus.FAILED ||
          payout?.status === PayoutStatus.PENDING
        ) {
          // ❌ Échec certain → retry explicite (réclamation atomique).
          // payoutReleased reste false : retenté au prochain cycle.
          await this.payoutsService.processAutomaticPayout(order.id, {
            retryFailed: true,
          });
          this.logger.warn(
            `[Holding Cron] Commande #${order.id} — payout ${payout.status}, new retry`,
          );
        } else {
          // ⏳ PROCESSING / état inconnu → on NE crée PAS un 2e payout et on
          // ne marque PAS libéré. À réconcilier. Re-vérifié au prochain cycle.
          this.logger.warn(
            `[Holding Cron] Commande #${order.id} — payout en ${payout?.status} (état inconnu). ` +
              `Aucun nouveau virement, à réconcilier.`,
          );
        }
      } catch (error) {
        this.logger.error(
          `[Holding Cron] Échec libération #${order.id}: ${error.message}`,
        );
      }
    }
  }

  /**
   * 🛵 Liste des livreurs disponibles (ADMIN / SUPPORT — pour assignation manuelle).
   */
  async listAvailableDrivers() {
    const allUsers = await this.usersService.findAll();
    return allUsers
      .filter((u) => u.role === UserRole.DRIVER || u.role === UserRole.COURIER)
      .map((d) => ({
        id: d.id,
        name: d.fullName || d.email,
        phone: d.phone || '',
        vehicleType: d.vehicleType || null,
        isActive: d.isActive ?? true,
        email: d.email,
      }));
  }
}
