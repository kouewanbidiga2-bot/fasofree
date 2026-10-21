/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

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
import {
  Repository,
  DataSource,
  In,
  IsNull,
  Not,
  FindOptionsWhere,
} from 'typeorm';
import { randomInt, timingSafeEqual } from 'crypto';

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
import { DeliverySlaService } from '../dispatch/services/delivery-sla.service';
import { DeliveryAgency } from '../dispatch/entities/delivery-agency.entity';
import { PenaltiesService } from '../penalties/penalties.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { PayoutsService } from '../payments/payouts.service';
import { PayoutStatus } from '../payments/entities/merchant-payout.entity';
import { UserRole } from '../users/entities/user-role.enum';
import { BusinessesService } from '../businesses/businesses.service';
import { PromotionsService } from '../promotions/promotions.service';
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
import { AFFILIATE_ORDER_CREATED } from '../affiliate/affiliate.events';

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
export const ORDER_STATUS_FSM: Record<string, OrderStatus[]> = {
  [OrderStatus.AWAITING_PAYMENT]: [
    OrderStatus.PAID,
    OrderStatus.CANCELLED,
    OrderStatus.FAILED,
  ],
  // 📅 SCHEDULED (bloc H) : une commande à l'avance est payée mais pas
  // encore due. Elle ne peut que devenir PAID (libération par le cron) ou
  // être annulée — jamais être dispatchée directement.
  [OrderStatus.PENDING]: [
    OrderStatus.PAID,
    OrderStatus.SCHEDULED,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.SCHEDULED]: [OrderStatus.PAID, OrderStatus.CANCELLED],
  [OrderStatus.PAID]: [OrderStatus.IN_PREPARATION, OrderStatus.CANCELLED],
  [OrderStatus.IN_PREPARATION]: [
    OrderStatus.READY_FOR_PICKUP,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.READY_FOR_PICKUP]: [
    OrderStatus.DRIVER_ASSIGNED,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.DRIVER_ASSIGNED]: [
    OrderStatus.IN_DELIVERY,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.IN_DELIVERY]: [
    OrderStatus.DELIVERED_PENDING_CONFIRMATION,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.DELIVERED_PENDING_CONFIRMATION]: [
    OrderStatus.DELIVERED,
    OrderStatus.COMPLETED,
    OrderStatus.DISPUTED,
  ],
  [OrderStatus.DELIVERED]: [
    OrderStatus.COMPLETED,
    OrderStatus.DISPUTED,
    OrderStatus.REFUNDED,
  ],
  [OrderStatus.PROCESSING]: [
    OrderStatus.IN_DELIVERY,
    OrderStatus.DELIVERED_PENDING_CONFIRMATION,
    OrderStatus.CANCELLED,
  ],
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

/**
 * ⏱️ Statuts marquant la REMISE PHYSIQUE du colis (SLA livraison, bloc B).
 *
 * Le premier atteint gagne : c'est la validation du livreur
 * (DELIVERED_PENDING_CONFIRMATION) qui fait foi en pratique ; les autres
 * existent pour les flux de secours (confirmation admin, rattrapage auto)
 * où la validation livreur a été sautée.
 */
const DELIVERED_TRACKING_STATES: OrderStatus[] = [
  OrderStatus.DELIVERED_PENDING_CONFIRMATION,
  OrderStatus.DELIVERED,
  OrderStatus.COMPLETED,
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
 * 🗂️ Statuts masqués PAR DÉFAUT dans les listes de commandes.
 * - FAILED : réserve d'un paiement expiré/échoué — aucun filtre UI ne
 *   l'attend ; c'est le résidu de « commande fantôme » après expiration.
 * - PENDING : commande non payée (paiement abandonné ou en cours) — jamais
 *   présentée comme une commande active. Réactivable via `includeUnpaid`
 *   (filtre « En attente de paiement » côté marchand).
 * CANCELLED et REFUNDED restent visibles : les filtres « Annulées » du client
 * et du marchand en dépendent.
 */
const DEFAULT_HIDDEN_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.FAILED,
  OrderStatus.PENDING,
];

/**
 * Options des listes de commandes (findClientOrders, findAllByBusiness*).
 */
export interface OrderListOptions {
  /**
   * Statuts explicitement demandés (?status=…) : ignore les masques par
   * défaut, sinon le filtre utilisateur « Annulées » / « En attente »
   * renverrait une liste vide.
   */
  statuses?: OrderStatus[];
  /** Inclure les commandes en attente de paiement (PENDING). */
  includeUnpaid?: boolean;
  /** Inclure les commandes en échec (FAILED) — audit/debug. */
  includeFailed?: boolean;
}

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
 * 🏢 Badge d'identité d'une société de livraison (Lot 1).
 *
 * Objet volontairement minimal et SANS donnée sensible : c'est ce qui est
 * exposé au client et au marchand pour qu'ils sachent QUELLE société a livré.
 * `id` peut être null si la société a été supprimée après la course — dans ce
 * cas seul le nom figé sur la commande subsiste.
 */
export interface AgencyBadge {
  id: string | null;
  name: string;
  logoUrl: string | null;
  description: string | null;
  brandColor: string | null;
  website: string | null;
  isVerified: boolean;
  phone: string | null;
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
  // 🧭 Provider de livraison (dispatch multi-niveaux) — Phase 0/1
  deliveryProvider: string | null;
  deliveryProviderStatus: string | null;
  // 🏢 Lot 1 : société de livraison identifiée (null si livraison interne).
  agency: AgencyBadge | null;
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
    private readonly deliverySlaService: DeliverySlaService,
    private readonly penaltiesService: PenaltiesService,
    // 🏢 Lot 1 : lecture du badge société (logo, nom, vérification) sur les commandes.
    @InjectRepository(DeliveryAgency)
    private readonly deliveryAgencyRepository: Repository<DeliveryAgency>,
  ) {}

  /**
   * ⏱️ Bloc B — horodate la REMISE RÉELLE du colis et mesure le retard.
   *
   * Idempotent et à sens unique : le premier horodatage gagne. Sans cela,
   * la confirmation client (parfois plusieurs heures après) écraserait
   * l'heure de livraison et rendrait toute mesure de SLA fausse.
   */
  private stampDeliveredAt(order: Order): void {
    if (order.deliveredAt) return;

    const now = new Date();
    order.deliveredAt = now;

    // Durée mesurée depuis le dispatch (à défaut, depuis la création) :
    // c'est le temps que le client a réellement attendu.
    const start = order.dispatchedAt ?? order.createdAt;
    if (start) {
      order.deliveryDurationMinutes = Math.max(
        0,
        Math.round((now.getTime() - new Date(start).getTime()) / 60000),
      );
    }

    order.deliveryLate = this.deliverySlaService.isLate(
      now,
      order.deliverySlaDeadline,
    );
  }

  /**
   * ⚖️ Bloc C — avertissement qualité automatique sur livraison en retard.
   *
   * Cible le livreur ET, quand la course a été confiée à une société de
   * livraison, la société elle-même : c'est elle qui répond de ses
   * chauffeurs. Le dédoublonnage par (commande, cible) est assuré par
   * PenaltiesService — cet appel peut donc être rejoué sans risque.
   *
   * Seul le niveau ① (avertissement) est automatique : les niveaux ②
   * (baisse de priorité) et ③ (suspension) restent des décisions humaines.
   */
  private async issueLateDeliveryPenalties(order: Order): Promise<void> {
    if (!order.deliveryLate || !order.deliveredAt) return;

    try {
      const minutesLate = this.deliverySlaService.minutesLate(
        order.deliveredAt,
        order.deliverySlaDeadline,
      );
      const reason = `Livraison en retard de ${minutesLate} min (commande #${order.id})`;

      if (order.driverId) {
        await this.penaltiesService.issueAutomaticWarning({
          orderId: order.id,
          driverId: order.driverId,
          reason,
        });
      }
      if (order.deliveryProviderId) {
        await this.penaltiesService.issueAutomaticWarning({
          orderId: order.id,
          agencyId: order.deliveryProviderId,
          reason,
        });
      }

      // 🔔 Alerte temps réel : le retard est visible sans ouvrir la commande.
      this.dispatchGateway.notifyDeliveryLate({
        orderId: order.id,
        businessId: order.businessId,
        driverId: order.driverId,
        minutesLate,
      });

      this.logger.warn(
        `[SLA] Commande #${order.id} livrée avec ${minutesLate} min de retard — avertissement qualité émis`,
      );
    } catch (err) {
      // Une sanction manquée ne doit jamais faire échouer une livraison.
      this.logger.warn(
        `[SLA] Avertissement de retard impossible pour la commande #${order.id}: ${
          (err as Error)?.message ?? 'inconnu'
        }`,
      );
    }
  }

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
  async createOrder(
    clientId: string,
    dto: CreateOrderDto,
  ): Promise<Order | { order: Order; checkoutUrl: string }> {
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
    // 🕐 Bloc H : `isOpenAt` et non `isOpen` — un commerce ouvert mais hors
    // de ses horaires déclarés doit refuser une commande immédiate.
    if (!this.businessesService.isOpenAt(business)) {
      throw new BadRequestException('Ce commerce est actuellement fermé');
    }

    // 📅 Bloc H — commande à l'avance : le commerce choisit s'il l'accepte,
    // avec un délai min (heures) et max (jours). `null` = immédiate.
    let scheduledFor: Date | null = null;
    if (dto.scheduledFor) {
      const config = business.advanceOrderConfig;
      if (!config?.enabled) {
        throw new BadRequestException(
          "Ce commerce n'accepte pas les commandes à l'avance.",
        );
      }
      const target = new Date(dto.scheduledFor);
      if (Number.isNaN(target.getTime())) {
        throw new BadRequestException('Date de livraison souhaitée invalide.');
      }
      const nowMs = Date.now();
      const minMs = (config.minHoursAhead || 0) * 3_600_000;
      const maxMs = (config.maxDaysAhead || 0) * 86_400_000;
      if (target.getTime() < nowMs + minMs) {
        throw new BadRequestException(
          `Livraison la plus proche possible : dans ${config.minHoursAhead} h minimum.`,
        );
      }
      if (target.getTime() > nowMs + maxMs) {
        throw new BadRequestException(
          `Livraison la plus éloignée possible : ${config.maxDaysAhead} jours maximum.`,
        );
      }
      scheduledFor = target;
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

      const pricingResult =
        this.deliveryPricingService.calculateDeliveryFee(distance);
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
    const verifiedItems: {
      productId: string;
      productName: string;
      quantity: number;
      unitPrice: number;
    }[] = [];

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
      // 📅 Bloc H : livraison souhaitée (null = immédiate, cas historique).
      scheduledFor,
      deliveryPinCode: null,
      driverId: null,
      driverValidatedAt: null,
      clientValidatedAt: null,
    });

    let savedOrder: Order;
    // 🔒 Transaction englobante : commande + articles + transaction financière
    // doivent être persistés ensemble ou pas du tout. Sans elle, un 500 après
    // le premier save laisse une commande orpheline en base, affichée comme
    // "active" côté dashboard marchand et app client alors que le client a
    // abandonné le paiement.
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      savedOrder = await queryRunner.manager.save(order);
      savedOrder.deliveryPinCode = isDelivery
        ? this.generateDeliveryPin()
        : null;
      // 🎫 QR Click & Collect : valeur générée en mémoire (crypto pure) pour
      // rester DANS la transaction. L'ancien appel passait par le service
      // dédié, qui faisait son propre `save` via un autre repository — hors
      // de la transaction, donc non atomique avec la commande.
      if (
        order.fulfillmentType === FulfillmentType.PICKUP ||
        order.fulfillmentType === FulfillmentType.DINE_IN
      ) {
        savedOrder.qrCode = this.qrCodeService.generateQrCode(savedOrder.id);
      }
      await queryRunner.manager.save(savedOrder);

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
        await queryRunner.manager.save(orderItems);
      }

      // Transaction financière : doit tomber avec la commande, sinon un échec
      // ici crée une commande sans trace de paiement (et réciproquement).
      const transaction = this.transactionRepository.create({
        orderId: savedOrder.id,
        reference: this.generateTransactionReference(savedOrder.id),
        amount: financials.totalAmount,
        commissionAmount: financials.platformCommission,
        status: isCash ? TransactionStatus.SUCCESS : TransactionStatus.PENDING,
      });
      await queryRunner.manager.save(transaction);

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction().catch(() => undefined);
      this.logger.error(
        `[Order] Transaction rollbackée (${clientId}): ${(error as Error).message}`,
      );
      // Libération du compteur de promo réservé avant la transaction.
      if (reservedPromotionId) {
        await this.promotionsService
          .release(reservedPromotionId)
          .catch(() => undefined);
      }
      throw error;
    } finally {
      await queryRunner.release();
    }

    this.logger.log(
      `[Order Created] #${savedOrder.id} - Total Client: ${savedOrder.totalAmount} FCFA (Commission: ${savedOrder.platformCommission} FCFA)`,
    );

    // --- Effets de bord APRÈS commit (jamais dans la transaction) ---

    // 🔗 Alimente le tunnel d'affiliation (clics → clients → commandes).
    // Non bloquant : un échec ici ne doit jamais faire échouer la commande.
    // L'AffiliateService n'enregistre l'événement que si le client est
    // réellement rattaché à ce commerce via un lien de suivi.
    try {
      this.events.emit(AFFILIATE_ORDER_CREATED, {
        orderId: savedOrder.id,
        clientId: savedOrder.clientId,
        businessId: savedOrder.businessId,
        amount: Number(savedOrder.totalAmount) || 0,
      });
    } catch (err) {
      this.logger.warn(
        `[Affiliate] Émission commande impossible: ${(err as Error).message}`,
      );
    }

    if (isCash) {
      // 💵 Cash : dispatch immédiat + notification marchand/livreur.
      // Non bloquant : la commande est déjà commitée, un WebSocket en échec
      // ne doit pas renvoyer un 500 au client (qui réessaierait et
      // dupliquerait la commande).
      try {
        this.dispatchGateway.dispatchOrderToDrivers(savedOrder);
        this.logger.log(
          `[Order Cash] #${savedOrder.id} — PAID (cash) → dispatch immédiat`,
        );
      } catch (dispatchError) {
        this.logger.error(
          `[Dispatch] Échec push WebSocket pour #${savedOrder.id}: ${(dispatchError as Error).message}`,
        );
      }
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
  async quoteOrder(
    clientId: string,
    dto: QuoteOrderDto,
  ): Promise<PricingQuote> {
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
        const pricingResult =
          this.deliveryPricingService.calculateDeliveryFee(distance);
        deliveryFee =
          typeof pricingResult === 'number' ? pricingResult : pricingResult.fee;
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

    // 🔒 Transaction base de données pour garantir l'atomicité des opérations critiques
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('SERIALIZABLE');

    try {
      const savedOrder = await queryRunner.manager.save(order);
      savedOrder.deliveryPinCode = this.generateDeliveryPin();
      await queryRunner.manager.save(savedOrder);

      // 🏦 Débit du wallet client (séquestre). En cas d'échec (solde insuffisant),
      // tout est rollbacké → aucune course sans paiement.
      await this.walletService.debitWallet(
        clientId,
        WalletUserRole.CUSTOMER,
        totalAmount,
        TransactionReason.ORDER_PAYMENT,
        `ESCROW-${savedOrder.id}`,
        `Séquestre course FasoFree Ride #${savedOrder.id} (${estimate.distanceKm} km)`,
        undefined,
        queryRunner.manager,
      );

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

      await queryRunner.manager.save(transaction);

      await queryRunner.commitTransaction();

      // 🧾 Reçu client automatique (non bloquant en cas d'échec)
      try {
        await this.receiptsService.createClientOrderReceipt(savedOrder);
      } catch (receiptError) {
        this.logger.warn(
          `[Receipt] Échec reçu client pour ${savedOrder.id}: ${receiptError.message}`,
        );
      }

      // 🚀 Dispatch aux chauffeurs
      try {
        this.dispatchGateway.dispatchOrderToDrivers(savedOrder);
        this.dispatchService.autoDispatchOrder(savedOrder.id).catch((err) => {
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

      return savedOrder;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `[Ride Order] Transaction rollbackée pour commande: ${error.message}`,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
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
    const { pickupLocation, dropoffLocation, packageDetails, fulfillmentType } =
      dto;

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
    savedOrder.deliveryPinCode = this.generateDeliveryPin();
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
        successUrl:
          this.configService.get<string>('P2P_SUCCESS_URL') ||
          'https://fasofree.site/p2p/success',
        errorUrl:
          this.configService.get<string>('P2P_ERROR_URL') ||
          'https://fasofree.site/p2p/error',
      });

      const checkoutUrl = payment.checkout_url ?? payment.payment_url;
      if (!checkoutUrl) {
        throw new BadRequestException(
          "GeniusPay n'a retourné aucune URL de paiement.",
        );
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
    const cleaned = phone.replace(/[\s. -]/g, '');

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

      // 🏁 Bloc A4 — « premier qui accepte gagne » : une société de
      // livraison peut déjà avoir pris la course depuis son espace
      // (deliveryProviderId renseigné). Sans ce garde-fou, un livreur
      // interne prendrait la course sous le nez de l'agence gagnante et la
      // commission contractée serait perdue.
      if (order.deliveryProviderId) {
        throw new ForbiddenException(
          'Cette course a déjà été prise par une société de livraison',
        );
      }

      // 🔒 Sécurité : seules les commandes PAYÉES peuvent être acceptées
      if (order.status === OrderStatus.PENDING) {
        throw new BadRequestException(
          "Impossible d'accepter une commande non payée.",
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
  async assignDriverToOrder(orderId: string, driverId: string): Promise<Order> {
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

  /**
   * Masque de statuts d'une liste : exclusions par défaut (FAILED + PENDING),
   * chacun réactivable via `includeFailed` / `includeUnpaid`.
   * Un tableau vide signifie « ne rien masquer » : l'appelant doit alors
   * omettre la clause NOT IN (syntaxe SQL invalide sinon).
   */
  private hiddenOrderStatuses(options?: OrderListOptions): OrderStatus[] {
    let hidden = [...DEFAULT_HIDDEN_ORDER_STATUSES];
    if (options?.includeFailed) {
      hidden = hidden.filter((status) => status !== OrderStatus.FAILED);
    }
    if (options?.includeUnpaid) {
      hidden = hidden.filter((status) => status !== OrderStatus.PENDING);
    }
    return hidden;
  }

  async findClientOrders(
    clientId: string,
    limit?: number,
    offset?: number,
    options?: OrderListOptions,
  ): Promise<Order[]> {
    const where: FindOptionsWhere<Order> = { clientId };
    if (options?.statuses?.length) {
      // Demande explicite via ?status= : aucune exclusion (le client a choisi
      // ce filtre, ex. « En attente » ou « Annulées »).
      where.status = In(options.statuses);
    } else {
      const hidden = this.hiddenOrderStatuses(options);
      if (hidden.length) {
        where.status = Not(In(hidden));
      }
    }
    return await this.orderRepository.find({
      where,
      relations: { items: true },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  async findDriverOrders(
    driverId: string,
    statuses?: string[],
    limit?: number,
    offset?: number,
  ): Promise<Order[]> {
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
    const clientIds = [
      ...new Set(orders.map((o) => o.clientId).filter(Boolean)),
    ];
    if (clientIds.length > 0) {
      const clients = await this.dataSource.query(
        `SELECT id, "fullName", phone FROM users WHERE id IN (${clientIds.map((_, i) => `$${i + 1}`).join(',')})`,
        clientIds,
      );
      const clientMap = new Map<string, any>(
        clients.map((c: any) => [c.id, c]),
      );
      return orders.map((o) => {
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
      });
    }
    return orders.map((o) => ({
      ...o,
      clientName: 'Client inconnu',
      clientPhone: 'Non disponible',
      customerName: 'Client inconnu',
      customerPhone: 'Non disponible',
    }));
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
      items: o.items?.map((i) => ({
        name: i.productName,
        quantity: i.quantity,
      })),
      createdAt: o.createdAt,
    }));
  }

  async findAllByBusiness(
    businessId: string,
    options?: OrderListOptions,
  ): Promise<Order[]> {
    const query = this.orderRepository
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.items', 'items')
      .where('o."businessId" = :businessId', { businessId })
      .orderBy('o."createdAt"', 'DESC');

    if (options?.statuses?.length) {
      query.andWhere('o.status IN (:...statuses)', {
        statuses: options.statuses,
      });
    } else {
      const hidden = this.hiddenOrderStatuses(options);
      if (hidden.length) {
        query.andWhere('o.status NOT IN (:...hidden)', { hidden });
      }
    }

    const orders = await query.getMany();

    // Enrichir avec les infos client via requête séparée (é(raw joins cassés)
    const clientIds = [
      ...new Set(orders.map((o) => o.clientId).filter(Boolean)),
    ];
    // 🏢 Lot 1 : le marchand doit savoir QUELLE société a livré (une requête).
    const agencyMap = await this.loadAgencyBadges(orders);
    if (clientIds.length > 0) {
      const clients = await this.dataSource.query(
        `SELECT id, "fullName", phone FROM users WHERE id IN (${clientIds.map((_, i) => `$${i + 1}`).join(',')})`,
        clientIds,
      );
      const clientMap = new Map<string, any>(
        clients.map((c: any) => [c.id, c]),
      );
      return orders.map((o) => {
        const client = clientMap.get(o.clientId);
        const name = client?.fullName || 'Client inconnu';
        const phone = client?.phone || 'Non disponible';
        return {
          ...o,
          clientName: name,
          clientPhone: phone,
          customerName: name,
          customerPhone: phone,
          agency: o.deliveryProviderId
            ? (agencyMap.get(o.deliveryProviderId) ?? null)
            : null,
        };
      });
    }
    return orders.map((o) => ({
      ...o,
      clientName: 'Client inconnu',
      clientPhone: 'Non disponible',
      customerName: 'Client inconnu',
      customerPhone: 'Non disponible',
      agency: o.deliveryProviderId
        ? (agencyMap.get(o.deliveryProviderId) ?? null)
        : null,
    }));
  }

  async findAllByBusinesses(
    businessIds: string[],
    options?: OrderListOptions,
  ): Promise<Order[]> {
    if (!businessIds.length) return [];
    const query = this.orderRepository
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.items', 'items')
      .where('o."businessId" IN (:...businessIds)', { businessIds })
      .orderBy('o."createdAt"', 'DESC');

    if (options?.statuses?.length) {
      query.andWhere('o.status IN (:...statuses)', {
        statuses: options.statuses,
      });
    } else {
      const hidden = this.hiddenOrderStatuses(options);
      if (hidden.length) {
        query.andWhere('o.status NOT IN (:...hidden)', { hidden });
      }
    }

    const orders = await query.getMany();

    // 🏢 Lot 1 : identifie la société de livraison de chaque commande.
    const agencyMap = await this.loadAgencyBadges(orders);

    const clientIds = [
      ...new Set(orders.map((o) => o.clientId).filter(Boolean)),
    ];
    if (clientIds.length > 0) {
      const clients = await this.dataSource.query(
        `SELECT id, "fullName", phone FROM users WHERE id IN (${clientIds.map((_, i) => `$${i + 1}`).join(',')})`,
        clientIds,
      );
      const clientMap = new Map<string, any>(
        clients.map((c: any) => [c.id, c]),
      );
      return orders.map((o) => {
        const client = clientMap.get(o.clientId);
        const name = client?.fullName || 'Client inconnu';
        const phone = client?.phone || 'Non disponible';
        return {
          ...o,
          clientName: name,
          clientPhone: phone,
          customerName: name,
          customerPhone: phone,
          agency: o.deliveryProviderId
            ? (agencyMap.get(o.deliveryProviderId) ?? null)
            : null,
        };
      });
    }
    return orders.map((o) => ({
      ...o,
      clientName: 'Client inconnu',
      clientPhone: 'Non disponible',
      customerName: 'Client inconnu',
      customerPhone: 'Non disponible',
      agency: o.deliveryProviderId
        ? (agencyMap.get(o.deliveryProviderId) ?? null)
        : null,
    }));
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

    // 🏢 Lot 1 : une seule requête pour identifier les sociétés de livraison
    // (le tour de contrôle doit voir QUI livre, pas « Agence partenaire »).
    const agencyMap = await this.loadAgencyBadges(orders);

    for (const order of orders) {
      if (order.driverId) {
        const loc = await this.geoDispatchService.getDriverLocation(
          order.driverId,
        );
        (
          order as Order & { driverLocation?: DriverLocation | null }
        ).driverLocation = loc;
      }
      (
        order as Order & { agency?: AgencyBadge | null }
      ).agency = order.deliveryProviderId
        ? (agencyMap.get(order.deliveryProviderId) ?? null)
        : null;
    }

    return orders;
  }

  async findOne(id: string): Promise<Order> {
    const uuidRe =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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
    // Toute l'administration (super admin / admin / support) peut consulter
    // une commande : suivi live + chat de commande (messagerie support).
    if (
      [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT].includes(role) ||
      order.clientId === userId
    )
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

  // ========================================================================
  // 🏢 Lot 1 — Identité des sociétés de livraison.
  //
  // Une course confiée à une société partenaire était tracée sur la commande
  // (`deliveryProviderId` + `deliveryProviderDetails.agencyName`) mais jamais
  // présentée comme telle : le client voyait « une agence partenaire ».
  // Ces helpers exposent un badge d'identité minimal (nom, logo, vérification)
  // sans jamais divulguer de donnée sensible.
  // ========================================================================

  /** Convertit une agence (ou son nom figé) en badge exposable au client. */
  private toAgencyBadge(
    agency: DeliveryAgency | null | undefined,
    fallbackName?: string | null,
  ): AgencyBadge | null {
    if (!agency) {
      // La société a pu être supprimée après la course : on conserve au moins
      // le nom figé sur la commande, sinon on n'affiche rien (mieux que mentir).
      if (!fallbackName) return null;
      return {
        id: null,
        name: fallbackName,
        logoUrl: null,
        description: null,
        brandColor: null,
        website: null,
        isVerified: false,
        phone: null,
      };
    }
    return {
      id: agency.id,
      name: agency.name,
      logoUrl: agency.logoUrl ?? null,
      description: agency.description ?? null,
      brandColor: agency.brandColor ?? null,
      website: agency.website ?? null,
      isVerified: agency.isVerified === true,
      phone: agency.phone ?? null,
    };
  }

  /**
   * Badge de la société ayant livré la commande (`null` si livraison interne).
   * Ne lève jamais : une erreur de lecture ne doit pas casser le suivi.
   */
  private async getOrderAgencyBadge(order: Order): Promise<AgencyBadge | null> {
    if (!order.deliveryProviderId) return null;
    const fallbackName =
      (order.deliveryProviderDetails?.agencyName as string | undefined) ?? null;
    try {
      const agency = await this.deliveryAgencyRepository.findOne({
        where: { id: order.deliveryProviderId },
      });
      return this.toAgencyBadge(agency, fallbackName);
    } catch {
      this.logger.warn(
        `Agence ${order.deliveryProviderId} introuvable pour la commande ${order.id}`,
      );
      return this.toAgencyBadge(null, fallbackName);
    }
  }

  /**
   * Charge en UNE requête les badges des agences de plusieurs commandes
   * (évite le N+1 sur les listes marchand).
   */
  private async loadAgencyBadges(
    orders: Order[],
  ): Promise<Map<string, AgencyBadge>> {
    const ids = [
      ...new Set(
        orders
          .map((o) => o.deliveryProviderId)
          .filter((id): id is string => !!id),
      ),
    ];
    const map = new Map<string, AgencyBadge>();
    if (ids.length === 0) return map;

    try {
      const agencies = await this.deliveryAgencyRepository.find({
        where: { id: In(ids) },
      });
      for (const agency of agencies) {
        const badge = this.toAgencyBadge(agency);
        if (badge) map.set(agency.id, badge);
      }
    } catch {
      this.logger.warn(
        `Impossible de charger les badges des agences (${ids.length})`,
      );
    }
    return map;
  }

  /**
   * 🔍 Détail d'une commande enrichi du badge société (client / marchand).
   * On l'expose via une méthode dédiée plutôt que dans `findOneForUser` pour
   * ne pas ajouter de requête aux appelants qui n'en ont pas besoin (chat).
   */
  async findOneForUserWithAgency(
    id: string,
    userId: string,
    role: UserRole,
  ): Promise<Order & { agency: AgencyBadge | null }> {
    const order = await this.findOneForUser(id, userId, role);
    const agency = await this.getOrderAgencyBadge(order);
    return Object.assign(order, { agency });
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

    // 🏢 Lot 1 : la société de livraison est identifiée, jamais anonymisée.
    const agency = await this.getOrderAgencyBadge(order);

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

    let businessLocation: { latitude: number; longitude: number } | null = null;
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
      this.logger.warn(`Impossible de calculer l'ETA pour la commande ${id}`);
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
      deliveryProvider: order.deliveryProvider ?? null,
      deliveryProviderStatus: order.deliveryProviderStatus ?? null,
      agency,
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

      // 📅 Bloc H — commande à l'avance : payée mais pas encore due.
      // On ne dispatche PAS tout de suite ; la commande passe en SCHEDULED
      // et le cron `releaseScheduledOrders` la libérera à l'heure dite.
      // Sans cela, une commande à l'avance serait dispatchée immédiatement,
      // ce qui annulerait toute la promesse faite au client.
      if (order.scheduledFor) {
        const allowedForScheduled = ORDER_STATUS_FSM[order.status] || [];
        if (!allowedForScheduled.includes(OrderStatus.SCHEDULED)) {
          this.logger.error(
            `[Order Scheduled] Transition invalide: ${order.status} → SCHEDULED pour la commande ${orderId}`,
          );
          await queryRunner.rollbackTransaction();
          return;
        }

        order.status = OrderStatus.SCHEDULED;
        await queryRunner.manager.save(order);
        await queryRunner.commitTransaction();

        this.logger.log(
          `[Order Scheduled] ${orderId} → libération prévue à ${order.scheduledFor.toISOString()}`,
        );
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

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const order = await queryRunner.manager.findOne(Order, {
        where: { id: orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) {
        this.logger.error(`Commande ${orderId} introuvable pour l'annulation.`);
        await queryRunner.rollbackTransaction();
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
        await queryRunner.rollbackTransaction();
        return;
      }

      // Annulation si en attente de paiement ou déjà échoué
      const cancellableStatuses: OrderStatus[] = [
        OrderStatus.PENDING,
        OrderStatus.AWAITING_PAYMENT,
        OrderStatus.FAILED,
      ];
      if (cancellableStatuses.includes(order.status)) {
        const previousStatus = order.status;
        const result = await queryRunner.manager.update(
          Order,
          { id: orderId, status: In(cancellableStatuses) },
          { status: OrderStatus.FAILED },
        );
        if (result.affected === 1) {
          this.logger.log(
            `[Payment Failed] Commande ${orderId} passée au statut FAILED (était ${previousStatus})`,
          );
        }
      }
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async markOrderAsRefunded(orderId: string): Promise<void> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });
    if (!order || order.status === OrderStatus.REFUNDED) return;
    const previousStatus = order.status;
    order.status = OrderStatus.REFUNDED;
    const saved = await this.orderRepository.save(order);
    this.notifyChatClosedIfTerminal(saved, previousStatus);
    this.dispatchGateway.broadcastOrderStatusChanged({
      id: saved.id,
      status: saved.status,
      driverId: saved.driverId,
      businessId: saved.businessId,
    });
  }

  async updateStatus(
    id: string,
    status: OrderStatus,
    userId: string,
    role: UserRole,
  ): Promise<Order> {
    // 🔒 SÉCURITÉ PAIEMENT : `PAID` ne doit JAMAIS pouvoir être posé par cette
    // voie. Avant correction, cet endpoint n'avait AUCUN @Roles (seulement
    // AuthGuard au niveau classe) et la FSM autorisait PENDING → PAID :
    // n'importe quel utilisateur authentifié pouvait marquer une commande
    // comme payée sans avoir payé (commandes mobiles/livraison).
    //
    // PAID est un état FINANCIAL : il ne peut venir que de
    //   - OrdersService.markAsPaidAndDispatch() (webhook GeniusPay signé)
    //   - la création d'une commande CASH (déjà payée à la création)
    if (status === OrderStatus.PAID) {
      throw new ForbiddenException(
        "Le statut PAID ne peut pas être posé manuellement : il est appliqué " +
          "automatiquement après confirmation du paiement (webhook) ou dès la " +
          "création pour un paiement en espèces.",
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('SERIALIZABLE');

    try {
      const order = await queryRunner.manager
        .createQueryBuilder(Order, 'o')
        .setLock('pessimistic_write')
        .where('o.id = :id', { id })
        .getOne();

      if (!order) {
        throw new NotFoundException(`Commande avec l'ID #${id} introuvable.`);
      }

      if (role === UserRole.DRIVER || role === UserRole.COURIER) {
        if (order.driverId && order.driverId !== userId) {
          throw new ForbiddenException(
            "Vous n'êtes pas le livreur assigné à cette commande",
          );
        }
      }
      if (role === UserRole.BUSINESS_ADMIN) {
        if (!order.businessId) {
          throw new ForbiddenException(
            "Cette commande n'est pas liée à un commerce",
          );
        }
        await this.businessesService.assertManagedBy(
          order.businessId,
          userId,
          role,
        );
      }

      // 🔒 SÉCURITÉ : un CLIENT ne peut modifier que SES propres commandes.
      // Ce contrôle manquait : n'importe quel client authentifié pouvait
      // viser la commande d'un tiers (usurpation de suivi, annulation, etc.).
      if (role === UserRole.CLIENT) {
        if (order.clientId !== userId) {
          throw new ForbiddenException(
            "Cette commande ne vous appartient pas",
          );
        }
        // Un client ne fait qu'annuler sa propre commande ; tout le reste
        // relève du marchand, du livreur ou de l'administration.
        if (status !== OrderStatus.CANCELLED) {
          throw new ForbiddenException(
            "Un client ne peut que mettre sa commande en attente d'annulation",
          );
        }
      }

      const previousStatus = order.status;

      const allowedTransitions = ORDER_STATUS_FSM[previousStatus] || [];
      if (!allowedTransitions.includes(status)) {
        throw new BadRequestException(
          `Transition invalide : ${previousStatus} → ${status}. Transitions autorisées : ${allowedTransitions.join(', ') || 'aucune'}`,
        );
      }

      const isDriverTransition = DRIVER_TRANSITIONS.includes(status);
      const isMerchantTransition =
        MERCHANT_TRANSITIONS.includes(status) ||
        status === OrderStatus.CANCELLED;

      let hasOwnFleet = false;
      if (order.businessId) {
        try {
          const business = await this.businessesService.findOne(
            order.businessId,
          );
          hasOwnFleet = business?.hasOwnDrivers === true;
        } catch {
          // fallback: pas de fleet interne
        }
      }

      const isDriver = role === UserRole.DRIVER || role === UserRole.COURIER;
      const isMerchant = role === UserRole.BUSINESS_ADMIN;

      if (isDriverTransition) {
        if (isDriver) {
          // OK
        } else if (isMerchant && hasOwnFleet) {
          // OK
        } else if (role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN) {
          // OK
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

      // ⏱️ Bloc B : un statut « livré » atteint par un autre chemin
      // (admin, marchand avec flotte interne) horodate aussi la remise —
      // sinon la durée de course et le retard resteraient vides.
      if (DELIVERED_TRACKING_STATES.includes(status)) {
        this.stampDeliveredAt(order);
      }

      order.status = status;
      const updatedOrder = await queryRunner.manager.save(order);

      await queryRunner.commitTransaction();

      this.dispatchGateway.broadcastOrderStatusChanged({
        id: updatedOrder.id,
        status: updatedOrder.status,
        driverId: updatedOrder.driverId,
        businessId: updatedOrder.businessId,
      });

      if (
        status === OrderStatus.DELIVERED &&
        previousStatus !== OrderStatus.DELIVERED
      ) {
        updatedOrder.payoutScheduledAt = new Date(
          Date.now() + HOLDING_PERIOD_MS,
        );
        updatedOrder.payoutReleased = false;
        await this.orderRepository.save(updatedOrder);
        this.logger.log(
          `[Holding] Commande #${id} → séquestre 3h (libération prévue ${updatedOrder.payoutScheduledAt.toISOString()})`,
        );
      }

      this.emitOrderSettlementEvents(updatedOrder, previousStatus);
      this.notifyChatClosedIfTerminal(updatedOrder, previousStatus);

      // ⚖️ Bloc C : avertissement automatique si la course est en retard
      // (même dédoublonnage que la validation livreur).
      if (DELIVERED_TRACKING_STATES.includes(status)) {
        await this.issueLateDeliveryPenalties(updatedOrder);
      }

      // ⚠️ `PAID` n'est plus listé ici : il ne peut pas arriver via cet endpoint
      // (verrou en tête de updateStatus). Le dispatch au passage à PAID est
      // déclenché par markAsPaidAndDispatch() sur webhook de paiement confirmé.
      if (
        status === OrderStatus.IN_PREPARATION &&
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

      await this.sendStatusNotifications(updatedOrder, previousStatus);

      try {
        await this.analyticsService.invalidateMerchantCache(order.businessId);
      } catch (error) {
        this.logger.warn(
          `Échec invalidation cache analytics: ${error?.message || error}`,
        );
      }

      return updatedOrder;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ========================================================================
  // 🔑 CODE PIN DE COMMANDE (6 chiffres aléatoires cryptographiques)
  // ========================================================================
  private generateDeliveryPin(): string {
    return randomInt(0, 1_000_000).toString().padStart(6, '0');
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

    const expiredPromotionalOrders = await this.orderRepository
      .createQueryBuilder('o')
      .where('o.status IN (:...statuses)', {
        statuses: [OrderStatus.PENDING, OrderStatus.AWAITING_PAYMENT],
      })
      .andWhere('o."createdAt" < :threshold', { threshold: expiredThreshold })
      .andWhere('o."promotionCode" IS NOT NULL')
      .getMany();

    for (const expiredOrder of expiredPromotionalOrders) {
      await this.promotionsService
        .releaseByCode(expiredOrder.promotionCode)
        .catch((error) =>
          this.logger.error(
            `[Cleanup] Promotion non libérée pour ${expiredOrder.id}: ${error.message}`,
          ),
        );
    }

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

    // Ride : le client est débité dès la création. Sans chauffeur après 30 min,
    // annuler la course et rembourser le séquestre de façon idempotente.
    const expiredRides = await this.orderRepository.find({
      where: {
        orderType: OrderType.RIDE,
        status: OrderStatus.PAID,
        driverId: IsNull(),
      },
    });
    for (const ride of expiredRides.filter(
      (r) => r.createdAt < expiredThreshold,
    )) {
      await this.orderRepository.update(ride.id, {
        status: OrderStatus.FAILED,
      });
      await this.walletService.creditWallet(
        ride.clientId,
        WalletUserRole.CUSTOMER,
        Number(ride.totalAmount),
        TransactionReason.REFUND,
        `RIDE-REFUND-${ride.id}`,
        `Remboursement automatique : aucun livreur pour la course ${ride.id}`,
      );
      await this.transactionRepository.update(
        { orderId: ride.id, status: TransactionStatus.SUCCESS },
        { status: TransactionStatus.REFUNDED },
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
    // Chargé avec addSelect('deliveryPinCode') : le PIN (colonne select:false)
    // est nécessaire pour le transmettre au client via WebSocket.
    const order = await this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'items')
      .addSelect('order.deliveryPinCode')
      .where('order.id = :id', { id: orderId })
      .getOne();

    if (!order) {
      throw new NotFoundException(`La commande #${orderId} est introuvable.`);
    }

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

    // ⏱️ Bloc B : c'est ICI que le colis est physiquement remis.
    // On horodate avant la sauvegarde pour que `deliveredAt`, la durée et
    // le retard soient persistés dans le même UPDATE que le statut.
    this.stampDeliveredAt(order);

    const saved = await this.orderRepository.save(order);

    // 📡 Broadcast temps réel : admin + marchand voient le changement sans reconnexion
    this.dispatchGateway.broadcastOrderStatusChanged({
      id: saved.id,
      status: saved.status,
      driverId: saved.driverId,
      businessId: saved.businessId,
    });

    // 🔔 Paiements & séquestre + notifications
    this.emitOrderSettlementEvents(saved, previousStatus);
    await this.sendStatusNotifications(saved, previousStatus);

    // ⚖️ Bloc C : retard constaté → avertissement qualité automatique
    // (livreur + société de livraison le cas échéant) et alerte temps réel.
    await this.issueLateDeliveryPenalties(saved);

    this.logger.log(
      `[Driver Validated] Commande #${orderId} marquée livrée par le livreur ${driverId}. En attente de confirmation du client.`,
    );

    // Notifier le client en temps réel
    try {
      this.dispatchGateway.server
        .to(`order_${orderId}`)
        .emit('deliveryPendingConfirmation', {
          message: saved.deliveryPinCode
            ? 'Le livreur a marqué votre commande comme livrée. Confirmez la réception avec votre code de commande.'
            : 'Le livreur a marqué votre commande comme livrée. Vous pouvez confirmer la réception.',
          orderId,
          orderCode: saved.deliveryPinCode ?? undefined,
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
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('SERIALIZABLE');

    try {
      const order = await queryRunner.manager
        .createQueryBuilder(Order, 'o')
        .setLock('pessimistic_write')
        .addSelect('o.deliveryPinCode')
        .where('o.id = :orderId', { orderId })
        .getOne();

      if (!order) {
        throw new NotFoundException(`Commande #${orderId} introuvable`);
      }

      if (order.clientId !== clientId) {
        throw new ForbiddenException('Cette commande ne vous appartient pas');
      }

      if (order.status !== OrderStatus.DELIVERED_PENDING_CONFIRMATION) {
        throw new BadRequestException(
          `La commande n'est pas en attente de confirmation (statut actuel: "${order.status}")`,
        );
      }

      // Validation contre le PIN stocké en base (jamais dérivé de l'ID).
      // Comparaison à temps constant pour éviter les fuites par timing.
      const expectedCode = order.deliveryPinCode;
      const pinOk =
        !!pinCode &&
        !!expectedCode &&
        pinCode.length === expectedCode.length &&
        timingSafeEqual(Buffer.from(pinCode), Buffer.from(expectedCode));
      if (!pinOk) {
        throw new BadRequestException('Code invalide. Veuillez réessayer.');
      }

      order.clientValidatedAt = new Date();
      order.status = OrderStatus.COMPLETED;
      // ⏱️ Bloc B : filet de sécurité — si la validation livreur a été
      // sautée, la remise est horodatée ici (jamais réécrite sinon).
      this.stampDeliveredAt(order);

      const saved = await queryRunner.manager.save(order);
      await queryRunner.commitTransaction();

      this.dispatchGateway.broadcastOrderStatusChanged({
        id: saved.id,
        status: saved.status,
        driverId: saved.driverId,
        businessId: saved.businessId,
      });

      this.emitOrderSettlementEvents(
        saved,
        OrderStatus.DELIVERED_PENDING_CONFIRMATION,
      );
      this.notifyChatClosedIfTerminal(
        saved,
        OrderStatus.DELIVERED_PENDING_CONFIRMATION,
      );
      // 📱 Notifier toutes les parties (push / in-app) — COMPLETED
      await this.sendStatusNotifications(
        saved,
        OrderStatus.DELIVERED_PENDING_CONFIRMATION,
      );

      // ⚖️ Bloc C : retard → avertissement qualité + alerte temps réel.
      await this.issueLateDeliveryPenalties(saved);

      this.logger.log(
        `[Order Completed] Commande #${orderId} validée par le client. Double validation réussie !`,
      );

      this.payoutsService.processAutomaticPayout(saved.id).catch((err) => {
        this.logger.error(`Erreur Payout après validation #${saved.id}`, err);
      });

      try {
        await this.analyticsService.invalidateMerchantCache(order.businessId);
      } catch (error) {
        this.logger.warn(
          `Échec invalidation cache analytics: ${error?.message || error}`,
        );
      }

      return saved;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
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

      const previousStatus = order.status;
      order.status = OrderStatus.DISPUTED;
      const saved = await queryRunner.manager.save(order);
      await queryRunner.commitTransaction();

      this.notifyChatClosedIfTerminal(saved, previousStatus);

      this.logger.warn(
        `[DISPUTE] Litige ouvert sur la commande #${orderId} par le client ${clientId}. Raison: ${reason}`,
      );

      return saved;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ========================================================================
  // ✅ CONFIRMATION DE LIVRAISON (admin / marchand — sans PIN)
  // ========================================================================
  async confirmDeliveryByAdmin(
    orderId: string,
    userId: string,
  ): Promise<Order> {
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
    // ⏱️ Bloc B : filet de sécurité (validation livreur sautée).
    this.stampDeliveredAt(order);

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

    // ⚖️ Bloc C : retard → avertissement qualité + alerte temps réel.
    await this.issueLateDeliveryPenalties(saved);

    this.logger.log(
      `[Order Completed] ✅ Commande #${orderId} confirmée par admin/marchand ${userId}.`,
    );

    // Déclencher le Payout automatique
    this.payoutsService.processAutomaticPayout(saved.id).catch((err) => {
      this.logger.error(
        `Erreur Payout après confirmation admin #${saved.id}`,
        err,
      );
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
      await this.geoDispatchService.updateDriverLocation(
        driverId,
        latitude,
        longitude,
      );
    } catch {
      // Silencieux — le tracking WebSocket gère aussi les mises à jour
    }

    return { success: true };
  }

  // ========================================================================
  // 📱 Notifications FCM & WebSocket selon le statut de commande
  // ========================================================================
  async sendStatusNotifications(
    order: Order,
    previousStatus: OrderStatus,
  ): Promise<void> {
    try {
      // 📨 Notifications in-app + push FCM uniquement (jamais d'e-mail /
      // SMS / WhatsApp) : `notificationStore.create` dépose la notification
      // en base et pousse le FCM si l'utilisateur a un token.
      //
      // 🏢 Lot 1 : quand une société de livraison a pris la course, on la
      // NOMME dans les messages. Sans cela le client ne saurait jamais que
      // c'est « Transport X » qui a livré, et FasoFree en récolterait le mérite.
      const agency = await this.getOrderAgencyBadge(order);
      const agencySuffix = agency ? ` de ${agency.name}` : '';

      switch (order.status) {
        case OrderStatus.PAID: {
          // Client: "Paiement confirmé, en attente de préparation"
          // 🔒 Notification persistante en DB (+ push FCM si token)
          await this.notificationStore.create({
            userId: order.clientId,
            type: NotificationType.ORDER_UPDATE,
            title: 'Paiement confirmé',
            body: 'Paiement confirmé, en attente de préparation par le restaurant.',
            orderId: order.id,
            actionUrl: `/order-tracking?orderId=${order.id}`,
          });
          break;
        }

        case OrderStatus.IN_PREPARATION:
          // Client: "Votre commande est en préparation"
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
          await this.notificationStore.create({
            userId: order.clientId,
            type: NotificationType.ORDER_UPDATE,
            title: 'Livreur assigné',
            body: agency
              ? `Un livreur${agencySuffix} a été assigné à votre commande.`
              : 'Un livreur a été assigné à votre commande.',
            orderId: order.id,
            actionUrl: `/order-tracking?orderId=${order.id}`,
          });

          // 🛵 Notifier le livreur assigné (fire-and-forget)
          if (order.driverId) {
            this.notificationStore
              .create({
                userId: order.driverId,
                type: NotificationType.ORDER_UPDATE,
                title: 'Nouvelle commande assignée',
                body: `Commande #${order.id.slice(-8)} — ${order.totalAmount} FCFA. Allez récupérer!`,
                orderId: order.id,
                actionUrl: `/order-tracking?orderId=${order.id}`,
              })
              .catch(() => {});
          }
          break;
        }

        case OrderStatus.IN_DELIVERY: {
          // Client: "Le livreur est en route avec votre repas"
          await this.notificationStore.create({
            userId: order.clientId,
            type: NotificationType.DELIVERY,
            title: 'Livreur en route',
            body: agency
              ? `Un livreur${agencySuffix} est en route avec votre commande.`
              : 'Le livreur est en route avec votre repas.',
            orderId: order.id,
            actionUrl: `/order-tracking?orderId=${order.id}`,
          });
          break;
        }

        case OrderStatus.DELIVERED_PENDING_CONFIRMATION: {
          // Client: "Le livreur est arrivé - confirmez la réception"
          await this.notificationStore.create({
            userId: order.clientId,
            type: NotificationType.DELIVERY,
            title: 'Livreur arrivé',
            body: agency
              ? `Le livreur${agencySuffix} est arrivé avec votre commande. Confirmez la réception!`
              : 'Le livreur est arrivé avec votre commande. Confirmez la réception!',
            orderId: order.id,
            actionUrl: `/order-tracking?orderId=${order.id}`,
          });
          break;
        }

        case OrderStatus.DELIVERED:
          // Client: "Le livreur est arrivé à destination"
          await this.notificationStore.create({
            userId: order.clientId,
            type: NotificationType.DELIVERY,
            title: 'Livraison validée',
            body: agency
              ? `${agency.name} a validé la livraison. Confirmez la réception!`
              : 'Le livreur a validé la livraison. Confirmez la réception!',
            orderId: order.id,
            actionUrl: `/order-tracking?orderId=${order.id}`,
          });
          break;

        case OrderStatus.COMPLETED:
          // Client: "Commande livrée avec succès"
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
          await this.notificationStore.create({
            userId: order.clientId,
            type: NotificationType.ORDER_UPDATE,
            title: 'Commande annulée',
            body: 'Votre commande a été annulée.',
            orderId: order.id,
          });

          // 🏪 Notifier le marchand de l'annulation (fire-and-forget)
          if (order.businessId) {
            this.businessesService
              .findOne(order.businessId)
              .then((business) => {
                if (business?.ownerId) {
                  this.notificationStore
                    .create({
                      userId: business.ownerId,
                      type: NotificationType.ORDER_UPDATE,
                      title: 'Commande annulée',
                      body: `La commande #${order.id.slice(-8)} a été annulée par le client.`,
                      orderId: order.id,
                    })
                    .catch(() => {});
                }
              })
              .catch(() => {});
          }
          break;

        case OrderStatus.FAILED:
          // Client: "Paiement échoué"
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
      // ⏱️ Bloc B : rattrapage 24h — horodate la remise si elle manque,
      // sinon la durée de course resterait définitivement vide.
      this.stampDeliveredAt(order);
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
  // ========================================================================
  // 📅 Bloc H — libération des commandes à l'avance.
  //
  // Une commande à l'avance est payée mais reste en SCHEDULED jusqu'à son
  // `scheduledFor`. Ce cron la fait passer à PAID (ce qui la rend éligible
  // au dispatch) puis déclenche le dispatch — exactement comme le ferait
  // un paiement immédiat, mais à l'heure choisie par le client.
  //
  // Pourquoi un cron et non un setTimeout : le processus peut redémarrer
  // (déploiement Render, crash). Un timer en mémoire serait perdu ; une
  // requête base survivre à tout.
  //
  // Idempotent : une commande déjà passée à PAID n'est plus SCHEDULED,
  // donc n'est plus sélectionnée. Deux instances qui s'exécutent en même
  // temps ne peuvent pas la libérer deux fois (le statut est la garde).
  // ========================================================================
  @Cron(CronExpression.EVERY_MINUTE)
  async releaseScheduledOrders(): Promise<void> {
    const now = new Date();

    const dueOrders = await this.orderRepository
      .createQueryBuilder('o')
      .where('o.status = :scheduled', { scheduled: OrderStatus.SCHEDULED })
      .andWhere('o."scheduledFor" IS NOT NULL')
      .andWhere('o."scheduledFor" <= :now', { now })
      .take(50)
      .getMany();

    if (dueOrders.length === 0) return;

    this.logger.log(
      `[Scheduled] ${dueOrders.length} commande(s) à l'avance à libérer`,
    );

    for (const order of dueOrders) {
      try {
        order.status = OrderStatus.PAID;
        // `scheduledFor` est conservé : il trace que cette commande était
        // à l'avance, ce qui explique un dispatch tardif dans les stats.
        await this.orderRepository.save(order);

        this.dispatchGateway.dispatchOrderToDrivers(order);
        this.logger.log(
          `[Scheduled] Commande #${order.id} libérée et dispatchée`,
        );
      } catch (error) {
        // Une commande en échec ne doit pas bloquer les suivantes : elles
        // seront retentées à la minute suivante (statut resté SCHEDULED).
        this.logger.error(
          `[Scheduled] Échec de libération de #${order.id}: ${error.message}`,
        );
      }
    }
  }

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
