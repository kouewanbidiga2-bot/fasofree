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
import { ConfigService } from '@nestjs/config';

// Entités et DTOs
import { Order, OrderStatus, OrderType } from './entities/order.entity';
import {
  Transaction,
  TransactionStatus,
} from '../payments/entities/transaction.entity';
import { CreateOrderDto } from './dto/create-order.dto';

// Gateways et Services
import { DispatchGateway } from '../dispatch/dispatch.gateway';
import { AnalyticsService } from '../analytics/analytics.service';
import { PayoutsService } from '../payments/payouts.service';
import { UserRole } from '../users/entities/user-role.enum';
import { BusinessesService } from '../businesses/businesses.service';
import { PromotionsService } from '../promotions/promotions.service';

/**
 * 📊 Structure du calcul financier interne
 */
export interface FinancialBreakdown {
  productsSubtotal: number;
  deliveryFee: number;
  platformCommission: number;
  totalAmount: number;
  merchantPayoutAmount: number;
  commissionPayer: 'CLIENT' | 'MERCHANT';
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

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly configService: ConfigService,
    private readonly dispatchGateway: DispatchGateway,
    private readonly analyticsService: AnalyticsService,
    private readonly payoutsService: PayoutsService,
    private readonly businessesService: BusinessesService,
    private readonly dataSource: DataSource,
    @Inject(forwardRef(() => PromotionsService))
    private readonly promotionsService: PromotionsService,
  ) {}

  /**
   * 🧮 Moteur de calcul financier FasoFree
   */
  public calculateFinancials(
    productsSubtotal: number,
    requestedDeliveryFee: number,
  ): FinancialBreakdown {
    const commissionRate = this.configService.get<number>(
      'FASOFREE_COMMISSION_RATE',
      0.0085,
    );
    const payer = this.configService.get<'CLIENT' | 'MERCHANT'>(
      'FASOFREE_COMMISSION_PAYER',
      'CLIENT',
    );

    const deliveryFee = Number(requestedDeliveryFee) || 0;
    const subtotal = Number(productsSubtotal) || 0;

    const platformCommission = Math.round(subtotal * commissionRate);

    let totalAmount = 0;
    let merchantPayoutAmount = 0;

    if (payer === 'CLIENT') {
      totalAmount = subtotal + deliveryFee + platformCommission;
      merchantPayoutAmount = subtotal;
    } else {
      totalAmount = subtotal + deliveryFee;
      merchantPayoutAmount = subtotal - platformCommission;
    }

    return {
      productsSubtotal: subtotal,
      deliveryFee,
      platformCommission,
      totalAmount,
      merchantPayoutAmount,
      commissionPayer: payer,
    };
  }

  /**
   * 🛍️ 1. Création d'une commande + Transaction PENDING + Dispatch WebSockets
   */
  async createOrder(clientId: string, dto: CreateOrderDto): Promise<Order> {
    const {
      orderType,
      deliveryLatitude,
      deliveryLongitude,
      deliveryFee,
      totalAmount: rawSubtotal,
      businessId,
    } = dto;

    const isDelivery = orderType === OrderType.DELIVERY;

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

    const effectiveDeliveryFee = isDelivery ? (deliveryFee ?? 500) : 0;
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

    const financials = this.calculateFinancials(
      Math.max(0, Number(rawSubtotal) - promotionDiscount),
      effectiveDeliveryFee,
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
      productsSubtotal: financials.productsSubtotal,
      deliveryFee: financials.deliveryFee,
      platformCommission: financials.platformCommission,
      totalAmount: financials.totalAmount,
      merchantPayoutAmount: financials.merchantPayoutAmount,
      commissionPayer: financials.commissionPayer,
      promotionCode,
      promotionDiscount,
      deliveryLocation,
      status: OrderStatus.PENDING,
      deliveryPinCode: isDelivery ? this.generatePinCode() : null,
      driverId: null,
      driverValidatedAt: null,
      clientValidatedAt: null,
    });

    let savedOrder: Order;
    try {
      savedOrder = await this.orderRepository.save(order);
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
    // Si la table Transaction n'est pas liée formellement par un @OneToOne dans TypeORM,
    // enlever "relations: { transaction: true }" pour éviter une erreur.
    return await this.orderRepository.find({
      where: { clientId },
      order: { createdAt: 'DESC' },
    });
  }

  async findAllByBusiness(businessId: string): Promise<Order[]> {
    return await this.orderRepository.find({
      where: { businessId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id },
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
    await this.businessesService.assertManagedBy(
      order.businessId,
      userId,
      role,
    );
    return order;
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

    await this.businessesService.assertManagedBy(
      order.businessId,
      userId,
      role,
    );

    const previousStatus = order.status;
    order.status = status;
    const updatedOrder = await this.orderRepository.save(order);

    if (
      (status === OrderStatus.DELIVERED || status === OrderStatus.COMPLETED) &&
      previousStatus !== OrderStatus.DELIVERED &&
      previousStatus !== OrderStatus.COMPLETED
    ) {
      this.payoutsService
        .processAutomaticPayout(updatedOrder.id)
        .catch((err) => {
          this.logger.error(
            `Erreur arrière-plan lors du Payout #${updatedOrder.id}`,
            err,
          );
        });
    }

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

    order.driverId = driverId;
    order.driverValidatedAt = new Date();
    order.status = OrderStatus.DELIVERED_PENDING_CONFIRMATION;

    const saved = await this.orderRepository.save(order);

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

    this.logger.warn(
      `[DISPUTE] ⚠️ Litige ouvert sur la commande #${orderId} par le client ${clientId}. Raison: ${reason}`,
    );

    return saved;
  }

  // ========================================================================
  // ⏰ CRON : Auto-complétion des commandes après 24h sans action du client
  // S'exécute toutes les heures
  // ========================================================================
  @Cron(CronExpression.EVERY_HOUR)
  async autoCompleteStaleOrders(): Promise<void> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const staleOrders = await this.orderRepository
      .createQueryBuilder('order')
      .where('order.status = :status', {
        status: OrderStatus.DELIVERED_PENDING_CONFIRMATION,
      })
      .andWhere('order.driverValidatedAt < :cutoff', {
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

      this.payoutsService.processAutomaticPayout(order.id).catch((err) => {
        this.logger.error(`Erreur Payout auto-complete #${order.id}`, err);
      });

      this.logger.log(
        `[Auto-Completed] Commande #${order.id} complétée automatiquement (24h sans action client).`,
      );
    }
  }
}
