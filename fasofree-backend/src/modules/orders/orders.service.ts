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
import { Repository, DataSource, In } from 'typeorm';

// Entités et DTOs
import {
  Order,
  OrderStatus,
  OrderType,
  FulfillmentType,
} from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { Product } from '../products/entities/product.entity';
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
import { GeniusPayService } from '../payments/providers/geniuspay.service';
import { NotificationStoreService } from '../notifications/notification-store.service';
import { UserRole as WalletUserRole } from '../wallets/entities/wallet.entity';
import { TransactionReason } from '../wallets/entities/wallet-transaction.entity';
import { NotificationType } from '../notifications/entities/notification.entity';

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
  [OrderStatus.AWAITING_PAYMENT]: [OrderStatus.PAID, OrderStatus.CANCELLED, OrderStatus.FAILED],
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
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
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
    private readonly geniusPayService: GeniusPayService,
    private readonly notificationStore: NotificationStoreService,
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
   * 🛍️ 1. Création d'une commande (BROUILLON) — invisible jusqu'au paiement confirmé
   * Pour P2P_DELIVERY et RIDE, retourne { order, checkoutUrl } pour redirection GeniusPay
   */
  async createOrder(clientId: string, dto: CreateOrderDto): Promise<Order | { order: Order; checkoutUrl: string }> {
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
      paymentMethod,
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
    // isDelivery basé sur fulfillmentType (DELIVERY, PICKUP, DINE_IN) et non orderType
    const isDelivery = fulfillmentType === FulfillmentType.DELIVERY;

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

    // 🧮 DELIVERY_FEE calculée côté serveur selon les tranches tarifaires + surcharge nuit.
    // Le montant envoyé par le client (dto.deliveryFee) est ignoré pour les commandes livrées.
    let effectiveDeliveryFee = 0;
    if (isDelivery) {
      const businessLat = business.latitude;
      const businessLng = business.longitude;

      // 🔒 REJETER si l'agence n'a pas de coordonnées GPS valides
      if (businessLat == null || businessLng == null) {
        throw new BadRequestException(
          "Cette agence n'a pas de coordonnées GPS enregistrées. Impossible de calculer la livraison.",
        );
      }

      const clientLat = deliveryLatitude;
      const clientLng = deliveryLongitude;
      if (clientLat == null || clientLng == null) {
        throw new BadRequestException(
          'Les coordonnées de livraison (latitude, longitude) sont obligatoires pour ce type de commande.',
        );
      }

      const distance = this.distanceCalculatorService.calculateDistance(
        businessLat,
        businessLng,
        clientLat,
        clientLng,
      );

      const pricingResult = this.deliveryPricingService.calculateDeliveryFee(distance);
      effectiveDeliveryFee = pricingResult.fee;

      this.logger.log(
        `[Pricing] Livraison calculée : ${distance.toFixed(2)} km | Tranche: ${pricingResult.tier.minKm}–${pricingResult.tier.maxKm ?? '+'}km | ` +
        `Base: ${pricingResult.baseFee} FCFA | Nuit: ${pricingResult.isNight ? 'OUI (+500)' : 'NON'} | Total: ${effectiveDeliveryFee} FCFA`,
      );
    }

    let promotionCode: string | null = null;
    let promotionDiscount = 0;
    let reservedPromotionId: string | null = null;

    // 🔒 RECALCUL DES PRIX DEPUIS LA DB — ne jamais faire confiance aux prix frontend
    let verifiedSubtotal = 0;
    const verifiedItems: { productId: string; productName: string; quantity: number; unitPrice: number }[] = [];

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException(
        'La commande doit contenir au moins un article.',
      );
    }

    if (dto.items && dto.items.length > 0) {
      const productIds = dto.items.map((item) => item.productId);
      const products = await this.productRepository.find({
        where: productIds.map((id) => ({ id })),
      });
      const productMap = new Map(products.map((p) => [p.id, p]));

      for (const item of dto.items) {
        const dbProduct = productMap.get(item.productId);
        if (!dbProduct) {
          throw new BadRequestException(
            `Produit #${item.productId} introuvable en base.`,
          );
        }
        // 🔒 Vérifier que le produit appartient au même commerce
        if (dbProduct.businessId !== businessId) {
          throw new BadRequestException(
            `Le produit "${dbProduct.name}" n'appartient pas à ce commerce.`,
          );
        }
        if (!dbProduct.isAvailable) {
          throw new BadRequestException(
            `Le produit "${dbProduct.name}" n'est plus disponible.`,
          );
        }
        const safeQuantity = Math.max(1, Math.floor(item.quantity));
        const unitPrice = Number(dbProduct.price);
        verifiedSubtotal += unitPrice * safeQuantity;
        verifiedItems.push({
          productId: item.productId,
          productName: dbProduct.name,
          quantity: safeQuantity,
          unitPrice,
        });
      }
    }

    if (dto.promoCode) {
      const quote = await this.promotionsService.quote(
        dto.promoCode,
        verifiedSubtotal,
      );
      await this.promotionsService.reserve(quote.promotion.id);
      promotionCode = quote.promotion.code;
      promotionDiscount = quote.discount;
      reservedPromotionId = quote.promotion.id;
    }

    const financials = await this.pricingService.calculateFinancials(
      Math.max(0, verifiedSubtotal - promotionDiscount),
      effectiveDeliveryFee,
      { clientId, businessId, orderType },
    );

    const deliveryLocation =
      isDelivery &&
      deliveryLatitude !== undefined &&
      deliveryLongitude !== undefined
        ? { latitude: deliveryLatitude, longitude: deliveryLongitude }
        : undefined;

    // 💵 Cash = PAID immédiatement (pas de webhook en attente)
    const isCash = paymentMethod === 'cash';
    const initialStatus = isCash ? OrderStatus.PAID : OrderStatus.PENDING;

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
      status: initialStatus,
      deliveryPinCode: null,
      driverId: null,
      driverValidatedAt: null,
      clientValidatedAt: null,
    });

    let savedOrder: Order;
    try {
      savedOrder = await this.orderRepository.save(order);
      savedOrder.deliveryPinCode = isDelivery ? this.getOrderCode(savedOrder.id) : null;
      await this.orderRepository.save(savedOrder);

      // Sauvegarder les articles avec les prix vérifiés depuis la DB
      if (verifiedItems.length > 0) {
        const orderItems = verifiedItems.map((item) => {
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
      status: isCash ? TransactionStatus.SUCCESS : TransactionStatus.PENDING,
    });

    await this.transactionRepository.save(transaction);

    if (isCash) {
      // 💵 Cash : dispatch immédiat + notification marchand/livreur
      this.dispatchGateway.dispatchOrderToDrivers(savedOrder);
      this.logger.log(
        `[Order Cash] #${savedOrder.id} — PAID (cash) → dispatch immédiat`,
      );
    } else {
      // 🔒 PAS DE NOTIFICATION MARCHAND/LIVREUR ICI — uniquement après webhook PAID
      // Le dispatch et la notification se font dans markAsPaidAndDispatch()
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
        const pricingResult = this.deliveryPricingService.calculateDeliveryFee(distance);
        deliveryFee = typeof pricingResult === 'number' ? pricingResult : pricingResult.fee;
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
      deliveryPinCode: null,
      driverId: null,
      driverValidatedAt: null,
      clientValidatedAt: null,
    });

    const savedOrder = await this.orderRepository.save(order);
    savedOrder.deliveryPinCode = this.getOrderCode(savedOrder.id);
    await this.orderRepository.save(savedOrder);

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
   * 🚚 Création d'une commande P2P (FasoColis)
   * Flux : validation → commande AWAITING_PAYMENT → GeniusPay → redirect
   * En cas d'échec GeniusPay, la commande et la transaction sont nettoyées.
   */
  private async createP2POrder(
    clientId: string,
    dto: CreateOrderDto,
  ): Promise<{ order: Order; checkoutUrl: string }> {
    const { pickupLocation, dropoffLocation, packageDetails, fulfillmentType } = dto;

    // ─── 1. VALIDATIONS PRÉALABLES (avant création en base) ───────────────
    if (!pickupLocation || !dropoffLocation) {
      throw new BadRequestException(
        'Les lieux de ramassage et de livraison sont obligatoires pour une course P2P',
      );
    }

    // Vérifier et normaliser le téléphone du client
    const client = await this.usersService.findById(clientId);
    if (!client?.phone) {
      throw new BadRequestException(
        'Un numéro de téléphone est obligatoire pour le paiement. Ajoutez un numéro dans votre profil.',
      );
    }
    const normalizedPhone = this.normalizePhone(client.phone);
    if (!normalizedPhone) {
      throw new BadRequestException(
        `Le numéro de téléphone "${client.phone}" n'est pas valide. Utilisez le format +226 XX XX XX XX.`,
      );
    }

    // ─── 2. CALCUL DU PRIX ────────────────────────────────────────────────
    const deliveryCalculation = this.distanceCalculatorService.calculateP2PDelivery(
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
      `[P2P Order] Distance: ${deliveryCalculation.distance} km, Base: ${deliveryCalculation.price} FCFA, Total: ${totalAmount} FCFA`,
    );

    // ─── 3. CRÉER COMMANDE + TRANSACTION ──────────────────────────────────
    const order = this.orderRepository.create({
      clientId,
      businessId: undefined,
      orderType: OrderType.P2P_DELIVERY,
      fulfillmentType: fulfillmentType || FulfillmentType.DELIVERY,
      fulfillmentDetails: { notes: packageDetails?.description },
      productsSubtotal: 0,
      itemsTotal: 0,
      deliveryFee: financials.deliveryFee,
      serviceFee: financials.serviceFee,
      merchantCommissionAmount: 0,
      driverCommissionAmount: 0,
      platformCommission: financials.platformCommission,
      totalAmount,
      merchantPayoutAmount: 0,
      commissionPayer: financials.commissionPayer,
      pickupLocation,
      dropoffLocation,
      packageDetails,
      deliveryLocation: {
        latitude: dropoffLocation.latitude,
        longitude: dropoffLocation.longitude,
      },
      status: OrderStatus.AWAITING_PAYMENT,
      deliveryPinCode: null,
      driverId: null,
      driverValidatedAt: null,
      clientValidatedAt: null,
    });

    const savedOrder = await this.orderRepository.save(order);
    savedOrder.deliveryPinCode = this.getOrderCode(savedOrder.id);
    await this.orderRepository.save(savedOrder);

    const transaction = this.transactionRepository.create({
      orderId: savedOrder.id,
      reference: this.generateTransactionReference(savedOrder.id),
      amount: totalAmount,
      commissionAmount: financials.platformCommission,
      status: TransactionStatus.PENDING,
    });
    await this.transactionRepository.save(transaction);

    this.logger.log(
      `[P2P Order] #${savedOrder.id} créée (AWAITING_PAYMENT) — Total: ${totalAmount} FCFA`,
    );

    // ─── 4. INITIER GENIUSPAY (avec cleanup en cas d'échec) ──────────────
    try {
      const payment = await this.geniusPayService.createPayment({
        amount: totalAmount,
        description: `Livraison FasoColis #${savedOrder.id.slice(0, 8)}`,
        paymentMethod: undefined,
        customer: {
          email: client.email,
          phone: normalizedPhone,
        },
        metadata: {
          order_id: savedOrder.id,
          user_id: clientId,
          order_type: OrderType.P2P_DELIVERY,
        },
        successUrl: this.configService.get<string>('P2P_SUCCESS_URL') || 'https://fasofree.site/p2p/success',
        errorUrl: this.configService.get<string>('P2P_ERROR_URL') || 'https://fasofree.site/p2p/error',
      });

      const checkoutUrl = payment.checkout_url ?? payment.payment_url;
      if (!checkoutUrl) {
        throw new BadRequestException("GeniusPay n'a retourné aucune URL de paiement.");
      }

      // Enregistrer la référence GeniusPay sur la transaction
      await this.transactionRepository.update(transaction.id, {
        paymentGatewayId: String(payment.id),
      });

      this.logger.log(
        `[P2P Order] #${savedOrder.id} — GeniusPay initialisé, redirect vers checkout`,
      );

      return { order: savedOrder, checkoutUrl };

    } catch (payError) {
      // ╔══════════════════════════════════════════════════════════════════╗
      // ║ CLEANUP : annuler la commande + la transaction si GeniusPay     ║
      // ║ échoue. On passe la commande en FAILED pour qu'elle soit        ║
      // ║ nettoyée par le cron cleanupExpiredPendingOrders.               ║
      // ╚══════════════════════════════════════════════════════════════════╝
      this.logger.error(
        `[P2P Order] GeniusPay échoué pour #${savedOrder.id}: ${payError instanceof Error ? payError.message : 'Erreur inconnue'}`,
      );

      // Marquer transaction comme FAILED
      await this.transactionRepository.update(transaction.id, {
        status: TransactionStatus.FAILED,
      });

      // Marquer commande comme FAILED (sera nettoyée par le cron)
      await this.orderRepository.update(savedOrder.id, {
        status: OrderStatus.FAILED,
      });

      throw new BadRequestException(
        `Le paiement GeniusPay a échoué: ${payError instanceof Error ? payError.message : 'Erreur inconnue'}. La commande a été annulée.`,
      );
    }
  }

  /**
   * 📱 Normalise un numéro de téléphone au format Burkina Faso (+226).
   * Accepte : 70123456, 070123456, +22670123456, 22670123456
   * Retourne : +22670123456 ou null si invalide.
   */
  private normalizePhone(phone: string): string | null {
    if (!phone) return null;

    // Retirer tous les espaces, tirets, points
    let cleaned = phone.replace(/[\s\-\.]/g, '');

    // Déjà en format international +226XXXXXXXX
    if (/^\+226\d{8}$/.test(cleaned)) return cleaned;

    // Format sans + : 226XXXXXXXX
    if (/^226\d{8}$/.test(cleaned)) return `+${cleaned}`;

    // Numéro local sans indicatif : 0XXXXXXXX ou XXXXXXXX (8 chiffres)
    if (/^0\d{8}$/.test(cleaned)) return `+226${cleaned.slice(1)}`;
    if (/^\d{8}$/.test(cleaned)) return `+226${cleaned}`;

    return null;
  }

  /**
   * 🛵 Acceptation d'une course / livraison par un livreur (DRIVER) ou coursier (COURIER).
   * Verrouille l'assignation : driverId fixé et statut → PROCESSING (le GPS est alors diffusé au client).
   * Utilise une transaction SERIALIZABLE + lock pessimiste pour éviter les race conditions.
   */
  async acceptOrder(orderId: string, driverId: string): Promise<Order> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('SERIALIZABLE');

    try {
      const order = await queryRunner.manager
        .createQueryBuilder(Order, 'o')
        .setLock('pessimistic_write')
        .where('o.id = :orderId', { orderId })
        .getOne();

      if (!order) {
        throw new NotFoundException(`Commande #${orderId} introuvable`);
      }

      if (order.driverId && order.driverId !== driverId) {
        throw new ForbiddenException(
          'Cette course a déjà été acceptée par un autre livreur',
        );
      }

      if (order.driverId === driverId) {
        await queryRunner.commitTransaction();
        return order;
      }

      // 🔒 Sécurité : seules les commandes PAYÉES peuvent être acceptées
      if (order.status === OrderStatus.PENDING) {
        throw new BadRequestException(
          'Impossible d\'accepter une commande non payée.',
        );
      }

      if (order.status !== OrderStatus.PAID) {
        throw new BadRequestException(
          `Impossible d'accepter : la commande est au statut "${order.status}"`,
        );
      }

      const previousStatus = order.status;
      order.driverId = driverId;
      order.status = OrderStatus.PROCESSING;

      const saved = await queryRunner.manager.save(order);

      await queryRunner.commitTransaction();

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
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
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

  async findClientOrders(clientId: string, limit?: number, offset?: number): Promise<Order[]> {
    return await this.orderRepository.find({
      where: { clientId },
      relations: { items: true },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  async findDriverOrders(driverId: string, statuses?: string[], limit?: number, offset?: number): Promise<Order[]> {
    const where: any = { driverId };
    if (statuses && statuses.length > 0) {
      where.status = In(statuses as OrderStatus[]);
    }
    const orders = await this.orderRepository.find({
      where,
      relations: { items: true },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    // Enrichir avec les infos client (clientName, clientPhone)
    const clientIds = [...new Set(orders.map(o => o.clientId).filter(Boolean))];
    if (clientIds.length > 0) {
      const clients = await this.dataSource.query(
        `SELECT id, "fullName", phone FROM users WHERE id IN (${clientIds.map((_, i) => `$${i + 1}`).join(',')})`,
        clientIds,
      );
      const clientMap = new Map<string, any>(clients.map((c: any) => [c.id, c]));
      return orders.map(o => {
        const client = clientMap.get(o.clientId);
        const name = client?.fullName || 'Client inconnu';
        const phone = client?.phone || 'Non disponible';
        return { 
          ...o, 
          clientName: name,
          clientPhone: phone,
          customerName: name,
          customerPhone: phone,
        };
      }) as any;
    }
    return orders.map(o => ({
      ...o,
      clientName: 'Client inconnu',
      clientPhone: 'Non disponible',
      customerName: 'Client inconnu',
      customerPhone: 'Non disponible',
    })) as any;
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
    const orders = await this.orderRepository
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.items', 'items')
      .where('o."businessId" = :businessId', { businessId })
      .orderBy('o."createdAt"', 'DESC')
      .getMany();

    // Enrichir avec les infos client via requête séparée (é(raw joins cassés)
    const clientIds = [...new Set(orders.map(o => o.clientId).filter(Boolean))];
    if (clientIds.length > 0) {
      const clients = await this.dataSource.query(
        `SELECT id, "fullName", phone FROM users WHERE id IN (${clientIds.map((_, i) => `$${i + 1}`).join(',')})`,
        clientIds,
      );
      const clientMap = new Map<string, any>(clients.map((c: any) => [c.id, c]));
      return orders.map(o => {
        const client = clientMap.get(o.clientId);
        const name = client?.fullName || 'Client inconnu';
        const phone = client?.phone || 'Non disponible';
        return { 
          ...o, 
          clientName: name,
          clientPhone: phone,
          customerName: name,
          customerPhone: phone,
        };
      }) as any;
    }
    return orders.map(o => ({
      ...o,
      clientName: 'Client inconnu',
      clientPhone: 'Non disponible',
      customerName: 'Client inconnu',
      customerPhone: 'Non disponible',
    })) as any;
  }


  async findAllByBusinesses(businessIds: string[]): Promise<Order[]> {
    if (!businessIds.length) return [];
    const orders = await this.orderRepository
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.items', 'items')
      .where('o."businessId" IN (:...businessIds)', { businessIds })
      .orderBy('o."createdAt"', 'DESC')
      .getMany();

    const clientIds = [...new Set(orders.map(o => o.clientId).filter(Boolean))];
    if (clientIds.length > 0) {
      const clients = await this.dataSource.query(
        `SELECT id, "fullName", phone FROM users WHERE id IN (${clientIds.map((_, i) => `$${i + 1}`).join(',')})`,
        clientIds,
      );
      const clientMap = new Map<string, any>(clients.map((c: any) => [c.id, c]));
      return orders.map(o => {
        const client = clientMap.get(o.clientId);
        const name = client?.fullName || 'Client inconnu';
        const phone = client?.phone || 'Non disponible';
        return { 
          ...o, 
          clientName: name,
          clientPhone: phone,
          customerName: name,
          customerPhone: phone,
        };
      }) as any;
    }
    return orders.map(o => ({
      ...o,
      clientName: 'Client inconnu',
      clientPhone: 'Non disponible',
      customerName: 'Client inconnu',
      customerPhone: 'Non disponible',
    })) as any;
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

      // 🔒 Idempotence : ignorer si déjà payée ou avancée
      const terminalPaidStatuses: OrderStatus[] = [
        OrderStatus.PAID,
        OrderStatus.IN_PREPARATION,
        OrderStatus.READY_FOR_PICKUP,
        OrderStatus.DRIVER_ASSIGNED,
        OrderStatus.PROCESSING,
        OrderStatus.IN_DELIVERY,
        OrderStatus.DELIVERED_PENDING_CONFIRMATION,
        OrderStatus.DELIVERED,
        OrderStatus.COMPLETED,
      ];
      if (terminalPaidStatuses.includes(order.status)) {
        this.logger.warn(
          `La commande ${orderId} est déjà au statut ${order.status} — ignoré.`,
        );
        await queryRunner.rollbackTransaction();
        return;
      }

      // 🔒 Refuser un paiement sur une commande FAILED/CANCELLED/REFUNDED
      const deadStatuses: OrderStatus[] = [
        OrderStatus.FAILED,
        OrderStatus.CANCELLED,
        OrderStatus.REFUNDED,
      ];
      if (deadStatuses.includes(order.status)) {
        this.logger.error(
          `[Order Paid] Commande ${orderId} au statut ${order.status} — paiement GeniusPay ignoré (commande morte)`,
        );
        await queryRunner.rollbackTransaction();
        return;
      }

      // Valider la transition FSM
      const allowedTransitions = ORDER_STATUS_FSM[order.status] || [];
      if (!allowedTransitions.includes(OrderStatus.PAID)) {
        this.logger.error(
          `[Order Paid] Transition invalide: ${order.status} → PAID pour la commande ${orderId}`,
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

    // 🔒 Ne JAMAIS écraser une commande déjà payée ou en cours de livraison
    const nonOverridableStatuses: OrderStatus[] = [
      OrderStatus.PAID,
      OrderStatus.IN_PREPARATION,
      OrderStatus.READY_FOR_PICKUP,
      OrderStatus.DRIVER_ASSIGNED,
      OrderStatus.PROCESSING,
      OrderStatus.IN_DELIVERY,
      OrderStatus.DELIVERED_PENDING_CONFIRMATION,
      OrderStatus.DELIVERED,
      OrderStatus.COMPLETED,
      OrderStatus.DISPUTED,
      OrderStatus.REFUNDED,
    ];

    if (nonOverridableStatuses.includes(order.status)) {
      this.logger.warn(
        `[Payment Failed] Commande ${orderId} déjà au statut ${order.status} — annulation ignorée`,
      );
      return;
    }

    // Annulation si en attente de paiement ou déjà échoué
    const cancellableStatuses: OrderStatus[] = [
      OrderStatus.PENDING,
      OrderStatus.AWAITING_PAYMENT,
      OrderStatus.FAILED,
    ];
    if (cancellableStatuses.includes(order.status)) {
      order.status = OrderStatus.FAILED;
      await this.orderRepository.save(order);
      this.logger.log(
        `[Payment Failed] Commande ${orderId} passée au statut FAILED (était ${order.status === OrderStatus.FAILED ? 'déjà FAILED' : order.status})`,
      );
    }
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

    // ✅ FIX #2 : Vérification de propriété — empêche toute modification non autorisée
    if (role === UserRole.DRIVER || role === UserRole.COURIER) {
      if (order.driverId && order.driverId !== userId) {
        throw new ForbiddenException('Vous n\'êtes pas le livreur assigné à cette commande');
      }
    }
    if (role === UserRole.BUSINESS_ADMIN) {
      if (!order.businessId) {
        throw new ForbiddenException('Cette commande n\'est pas liée à un commerce');
      }
      await this.businessesService.assertManagedBy(order.businessId, userId, role);
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

    // 📡 Broadcast temps réel : tous les dashboards reçoivent le changement sans reconnexion
    this.dispatchGateway.broadcastOrderStatusChanged({
      id: updatedOrder.id,
      status: updatedOrder.status,
      driverId: updatedOrder.driverId,
      businessId: updatedOrder.businessId,
    });

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
  // 🔑 CODE DE COMMANDE (6 derniers caractères de l'ID — déterministe)
  // ========================================================================
  private getOrderCode(orderId: string): string {
    return orderId.slice(-6);
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
  // 🧹 NETTOYAGE DES COMMANDES PENDING EXPIRÉES (>30 min sans paiement)
  // ========================================================================
  @Cron(CronExpression.EVERY_10_MINUTES)
  async cleanupExpiredPendingOrders(): Promise<void> {
    const expiredThreshold = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes

    // Nettoyer les commandes PENDING et AWAITING_PAYMENT qui n'ont pas été payées
    const result = await this.orderRepository
      .createQueryBuilder()
      .update(Order)
      .set({ status: OrderStatus.FAILED })
      .where('status IN (:...statuses)', {
        statuses: [OrderStatus.PENDING, OrderStatus.AWAITING_PAYMENT],
      })
      .andWhere('"createdAt" < :threshold', { threshold: expiredThreshold })
      .execute();

    if (result.affected && result.affected > 0) {
      this.logger.log(
        `[Cleanup] ${result.affected} commande(s) sans paiement (PENDING/AWAITING_PAYMENT) expirée(s) marquée(s) FAILED`,
      );
    }
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
      order.status !== OrderStatus.DRIVER_ASSIGNED &&
      order.status !== OrderStatus.IN_DELIVERY &&
      order.status !== OrderStatus.DELIVERED_PENDING_CONFIRMATION
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

    // 📡 Broadcast temps réel : admin + marchand voient le changement sans reconnexion
    this.dispatchGateway.broadcastOrderStatusChanged({
      id: saved.id,
      status: saved.status,
      driverId: saved.driverId,
      businessId: saved.businessId,
    });

    // 🔔 Settlement livreur : crédit gains + Pass Journée / micro-commission
    this.emitOrderSettlementEvents(saved, previousStatus);

    this.logger.log(
      `[Driver Validated] Commande #${orderId} marquée livrée par le livreur ${driverId}. En attente de confirmation du client.`,
    );

    // Notifier le client en temps réel
    try {
      this.dispatchGateway.server
        .to(`order_${orderId}`)
        .emit('deliveryPendingConfirmation', {
          message:
            'Le livreur a marqué votre commande comme livrée. Confirmez la réception avec votre code de commande.',
          orderId,
          orderCode: this.getOrderCode(orderId),
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

    const expectedCode = this.getOrderCode(orderId);
    if (!pinCode || pinCode !== expectedCode) {
      throw new BadRequestException('Code invalide. Veuillez réessayer.');
    }

    order.clientValidatedAt = new Date();
    order.status = OrderStatus.COMPLETED;

    const saved = await this.orderRepository.save(order);

    // 📡 Broadcast temps réel
    this.dispatchGateway.broadcastOrderStatusChanged({
      id: saved.id,
      status: saved.status,
      driverId: saved.driverId,
      businessId: saved.businessId,
    });

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
      `[Order Completed] Commande #${orderId} validée par le client. Double validation réussie !`,
    );

    // Déclencher le Payout automatique au marchand
    this.payoutsService.processAutomaticPayout(saved.id).catch((err) => {
      this.logger.error(`Erreur Payout après validation #${saved.id}`, err);
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
    this.notifyChatClosedIfTerminal(saved, order.status);

    this.logger.warn(
      `[DISPUTE] ⚠️ Litige ouvert sur la commande #${orderId} par le client ${clientId}. Raison: ${reason}`,
    );

    return saved;
  }

  // ========================================================================
  // ✅ CONFIRMATION DE LIVRAISON (admin / marchand — sans PIN)
  // ========================================================================
  async confirmDeliveryByAdmin(orderId: string, userId: string): Promise<Order> {
    const order = await this.findOne(orderId);

    if (
      order.status !== OrderStatus.DELIVERED_PENDING_CONFIRMATION &&
      order.status !== OrderStatus.DELIVERED
    ) {
      throw new BadRequestException(
        `Impossible de confirmer : la commande est au statut "${order.status}"`,
      );
    }

    order.clientValidatedAt = new Date();
    order.status = OrderStatus.COMPLETED;

    const saved = await this.orderRepository.save(order);

    // 📡 Broadcast temps réel
    this.dispatchGateway.broadcastOrderStatusChanged({
      id: saved.id,
      status: saved.status,
      driverId: saved.driverId,
      businessId: saved.businessId,
    });

    // 🔔 Settlement marchand
    this.emitOrderSettlementEvents(
      saved,
      OrderStatus.DELIVERED_PENDING_CONFIRMATION,
    );
    this.notifyChatClosedIfTerminal(
      saved,
      OrderStatus.DELIVERED_PENDING_CONFIRMATION,
    );

    this.logger.log(
      `[Order Completed] ✅ Commande #${orderId} confirmée par admin/marchand ${userId}.`,
    );

    // Déclencher le Payout automatique
    this.payoutsService.processAutomaticPayout(saved.id).catch((err) => {
      this.logger.error(`Erreur Payout après confirmation admin #${saved.id}`, err);
    });

    try {
      await this.analyticsService.invalidateMerchantCache(order.businessId);
    } catch {
      // silencieux
    }

    return saved;
  }

  // ========================================================================
  // 📍 LOCALISATION DU LIVREUR (temps réel)
  // ========================================================================
  async updateDriverLocation(
    orderId: string,
    driverId: string,
    latitude: number,
    longitude: number,
  ): Promise<{ success: boolean }> {
    const order = await this.findOne(orderId);

    if (order.driverId && order.driverId !== driverId) {
      throw new ForbiddenException(
        "Vous n'êtes pas le livreur assigné à cette commande",
      );
    }

    // Stocker la position via le service geo-dispatch (Redis)
    try {
      await this.geoDispatchService.updateDriverLocation(driverId, latitude, longitude);
    } catch {
      // Silencieux — le tracking WebSocket gère aussi les mises à jour
    }

    return { success: true };
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
                title: 'Commande confirmée',
                body: 'Votre commande a été confirmée par le restaurant. Préparation en cours!',
                data: { orderId: order.id, type: 'ORDER_CONFIRMED' },
              })
            : false;

          // 🔒 Notification persistante en DB
          await this.notificationStore.create({
            userId: order.clientId,
            type: NotificationType.ORDER_UPDATE,
            title: 'Commande confirmée',
            body: 'Votre commande a été confirmée par le restaurant. Préparation en cours!',
            orderId: order.id,
            actionUrl: `/order-tracking?orderId=${order.id}`,
          });

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
              title: 'En préparation',
              body: 'Votre commande est en cours de préparation.',
              data: { orderId: order.id, type: 'ORDER_PREPARING' },
            });
          }
          await this.notificationStore.create({
            userId: order.clientId,
            type: NotificationType.ORDER_UPDATE,
            title: 'En préparation',
            body: 'Votre commande est en cours de préparation.',
            orderId: order.id,
            actionUrl: `/order-tracking?orderId=${order.id}`,
          });
          break;

        case OrderStatus.DRIVER_ASSIGNED: {
          // Client: "Un livreur a été assigné à votre commande"
          if (clientFcmToken) {
            await this.notificationsService.sendToDevice(clientFcmToken, {
              title: 'Livreur assigné',
              body: 'Un livreur a été assigné à votre commande. Il arrive bientôt!',
              data: { orderId: order.id, type: 'DRIVER_ASSIGNED' },
            });
          }
          await this.notificationStore.create({
            userId: order.clientId,
            type: NotificationType.ORDER_UPDATE,
            title: 'Livreur assigné',
            body: 'Un livreur a été assigné à votre commande.',
            orderId: order.id,
            actionUrl: `/order-tracking?orderId=${order.id}`,
          });
          break;
        }

        case OrderStatus.IN_DELIVERY: {
          // Client: "Le livreur est en route avec votre repas"
          const fcmEnRouteSuccess = clientFcmToken
            ? await this.notificationsService.sendToDevice(clientFcmToken, {
                title: 'Livreur en route',
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
          await this.notificationStore.create({
            userId: order.clientId,
            type: NotificationType.DELIVERY,
            title: 'Livreur en route',
            body: 'Le livreur est en route avec votre repas.',
            orderId: order.id,
            actionUrl: `/order-tracking?orderId=${order.id}`,
          });
          break;
        }

        case OrderStatus.DELIVERED_PENDING_CONFIRMATION: {
          // Client: "Le livreur est arrivé - confirmez la réception"
          if (clientFcmToken) {
            await this.notificationsService.sendToDevice(clientFcmToken, {
              title: 'Livreur arrivé',
              body: 'Le livreur est arrivé avec votre commande. Confirmez la réception!',
              data: { orderId: order.id, type: 'DELIVERY_PENDING_CONFIRMATION' },
            });
          }
          await this.notificationStore.create({
            userId: order.clientId,
            type: NotificationType.DELIVERY,
            title: 'Livreur arrivé',
            body: 'Le livreur est arrivé avec votre commande. Confirmez la réception!',
            orderId: order.id,
            actionUrl: `/order-tracking?orderId=${order.id}`,
          });
          break;
        }

        case OrderStatus.DELIVERED:
          // Client: "Le livreur est arrivé à destination"
          if (clientFcmToken) {
            await this.notificationsService.sendToDevice(clientFcmToken, {
              title: 'Livraison validée',
              body: 'Le livreur a validé la livraison. Confirmez la réception de votre commande!',
              data: { orderId: order.id, type: 'DRIVER_ARRIVED' },
            });
          }
          await this.notificationStore.create({
            userId: order.clientId,
            type: NotificationType.DELIVERY,
            title: 'Livraison validée',
            body: 'Le livreur a validé la livraison. Confirmez la réception!',
            orderId: order.id,
            actionUrl: `/order-tracking?orderId=${order.id}`,
          });
          break;

        case OrderStatus.COMPLETED:
          // Client: "Commande livrée avec succès"
          if (clientFcmToken) {
            await this.notificationsService.sendToDevice(clientFcmToken, {
              title: 'Commande livrée',
              body: 'Votre commande a été livrée avec succès. Bon appétit!',
              data: { orderId: order.id, type: 'ORDER_COMPLETED' },
            });
          }
          await this.notificationStore.create({
            userId: order.clientId,
            type: NotificationType.ORDER_UPDATE,
            title: 'Commande livrée',
            body: 'Votre commande a été livrée avec succès.',
            orderId: order.id,
            actionUrl: `/receipt?orderId=${order.id}`,
          });
          break;

        case OrderStatus.CANCELLED:
          // Client: "Votre commande a été annulée"
          if (clientFcmToken) {
            await this.notificationsService.sendToDevice(clientFcmToken, {
              title: 'Commande annulée',
              body: 'Votre commande a été annulée. Aucun montant ne vous a été débité.',
              data: { orderId: order.id, type: 'ORDER_CANCELLED' },
            });
          }
          if (!clientFcmToken && client?.phone) {
            await this.smsService.sendSms(
              client.phone,
              `FasoFree: Votre commande #${order.id.slice(0, 8)} a été annulée.`,
            );
          }
          await this.notificationStore.create({
            userId: order.clientId,
            type: NotificationType.ORDER_UPDATE,
            title: 'Commande annulée',
            body: 'Votre commande a été annulée.',
            orderId: order.id,
          });
          break;

        case OrderStatus.FAILED:
          // Client: "Paiement échoué"
          if (clientFcmToken) {
            await this.notificationsService.sendToDevice(clientFcmToken, {
              title: 'Paiement échoué',
              body: 'Le paiement de votre commande a échoué. Veuillez réessayer.',
              data: { orderId: order.id, type: 'PAYMENT_FAILED' },
            });
          }
          if (!clientFcmToken && client?.phone) {
            await this.smsService.sendSms(
              client.phone,
              `FasoFree: Le paiement de votre commande #${order.id.slice(0, 8)} a échoué.`,
            );
          }
          await this.notificationStore.create({
            userId: order.clientId,
            type: NotificationType.ORDER_UPDATE,
            title: 'Paiement échoué',
            body: 'Le paiement de votre commande a échoué.',
            orderId: order.id,
          });
          break;

        case OrderStatus.REFUNDED:
          // Client: "Votre commande a été remboursée"
          if (clientFcmToken) {
            await this.notificationsService.sendToDevice(clientFcmToken, {
              title: 'Commande remboursée',
              body: 'Votre commande a été remboursée. Le montant sera crédité sous 48h.',
              data: { orderId: order.id, type: 'ORDER_REFUNDED' },
            });
          }
          if (!clientFcmToken && client?.phone) {
            await this.smsService.sendSms(
              client.phone,
              `FasoFree: Votre commande #${order.id.slice(0, 8)} a été remboursée.`,
            );
          }
          await this.notificationStore.create({
            userId: order.clientId,
            type: NotificationType.ORDER_UPDATE,
            title: 'Commande remboursée',
            body: 'Votre commande a été remboursée. Le montant sera crédité sous 48h.',
            orderId: order.id,
          });
          break;

        case OrderStatus.DISPUTED:
          // Client + Marchand: "Un litige a été ouvert"
          if (clientFcmToken) {
            await this.notificationsService.sendToDevice(clientFcmToken, {
              title: 'Litige ouvert',
              body: 'Un litige a été ouvert sur votre commande. Notre équipe va examiner le dossier.',
              data: { orderId: order.id, type: 'ORDER_DISPUTED' },
            });
          }
          await this.notificationStore.create({
            userId: order.clientId,
            type: NotificationType.ORDER_UPDATE,
            title: 'Litige ouvert',
            body: 'Un litige a été ouvert sur votre commande.',
            orderId: order.id,
            actionUrl: `/order-tracking?orderId=${order.id}`,
          });
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
