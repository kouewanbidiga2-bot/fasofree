import { Injectable, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

// Entités
import { Order, OrderStatus, OrderType } from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { Product } from '../products/entities/product.entity';
import { Transaction } from '../payments/entities/transaction.entity';
import { Brand } from '../brands/entities/brand.entity';
import { Business } from '../businesses/entities/business.entity';
import { UserRole } from '../users/entities/user-role.enum';

// DTOs
import {
  AnalyticsFilterDto,
  AnalyticsPeriod,
} from './dto/analytics-filter.dto';

// --- INTERFACES ---
export interface MerchantDashboardStats {
  summary: {
    totalRevenue: number; // CA brut
    netEarnings: number; // Gain Net marchand
    platformCommission: number; // Commission FasoFree
    totalOrders: number;
    completedOrders: number;
    cancelledOrders: number;
    averageOrderValue: number;
  };
  topSellingProducts: Array<{
    productId: string;
    name: string;
    totalSold: number;
    revenue: number;
  }>;
  lowStockAlerts: Array<{
    productId: string;
    name: string;
    stockQuantity: number;
  }>;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  // ⚠️ À CONFIGURER : 0.15 pour 15% ou 0.015 pour 1.5% selon tes règles métier
  private readonly COMMISSION_RATE = 0.15;

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Brand)
    private readonly brandRepository: Repository<Brand>,
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
    @Inject(CACHE_MANAGER) private readonly cacheManager?: Cache,
  ) {}

  /**
   * Invalide le cache lié au dashboard marchand si le cache est présent
   */
  async invalidateMerchantCache(businessId: string): Promise<void> {
    if (!this.cacheManager) return;
    try {
      const key = `analytics:merchant:${businessId}`;
      // Accéder de manière sûre à la méthode `del` du gestionnaire de cache
      const maybeDel = (
        this.cacheManager as unknown as {
          del?: (k: string) => Promise<void> | void;
        }
      ).del;
      if (typeof maybeDel === 'function') {
        // Appel en liant le contexte pour supporter différentes implémentations
        await maybeDel.call(this.cacheManager, key);
        this.logger.log(
          `Cache analytics invalidé pour le merchant ${businessId}`,
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Impossible d'invalider le cache analytics: ${msg}`);
    }
  }

  /**
   * 📊 1. Obtenir les statistiques détaillées (Top produits, stocks, CA)
   * Optimisé avec le QueryBuilder pour des requêtes SQL rapides.
   */
  async getMerchantDashboard(
    businessId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<MerchantDashboardStats> {
    try {
      // 1. Calcul des statistiques financières (Query SQL directe pour la performance)
      const query = this.orderRepository
        .createQueryBuilder('o')
        .select('COUNT(o.id)', 'totalOrders')
        .addSelect(
          'SUM(CASE WHEN o.status = :deliveredStatus THEN o.totalAmount ELSE 0 END)',
          'totalRevenue',
        )
        .addSelect(
          'COUNT(CASE WHEN o.status = :deliveredStatus THEN 1 END)',
          'completedOrders',
        )
        .addSelect(
          'COUNT(CASE WHEN o.status = :cancelledStatus THEN 1 END)',
          'cancelledOrders',
        )
        .where('o.businessId = :businessId', { businessId })
        .setParameters({
          deliveredStatus: OrderStatus.DELIVERED,
          cancelledStatus: OrderStatus.CANCELLED,
        });

      if (startDate && endDate) {
        query.andWhere('order.createdAt BETWEEN :startDate AND :endDate', {
          startDate,
          endDate,
        });
      }

      const _raw = (await query.getRawOne()) as unknown;

      const rawSummary = _raw as
        | {
            totalOrders?: string | number;
            completedOrders?: string | number;
            cancelledOrders?: string | number;
            totalRevenue?: string | number;
          }
        | undefined;

      const totalOrders = Number(rawSummary?.totalOrders ?? 0);
      const completedOrders = Number(rawSummary?.completedOrders ?? 0);
      const cancelledOrders = Number(rawSummary?.cancelledOrders ?? 0);
      const totalRevenue = parseFloat(String(rawSummary?.totalRevenue ?? '0'));

      // Calculs financiers
      const platformCommission = totalRevenue * this.COMMISSION_RATE;
      const netEarnings = totalRevenue - platformCommission;
      const averageOrderValue =
        completedOrders > 0 ? Math.round(totalRevenue / completedOrders) : 0;

      // 2. Top 5 des produits vendus
      const topProductsQuery = this.orderItemRepository
        .createQueryBuilder('item')
        .innerJoin('item.order', 'order')
        .innerJoin('item.product', 'product')
        .select('product.id', 'productId')
        .addSelect('product.name', 'name')
        .addSelect('SUM(item.quantity)', 'totalSold')
        .addSelect('SUM(item.price * item.quantity)', 'revenue')
        .where('order.businessId = :businessId', { businessId })
        .andWhere('order.status = :deliveredStatus', {
          deliveredStatus: OrderStatus.DELIVERED,
        })
        .groupBy('product.id')
        .addGroupBy('product.name')
        .orderBy('"totalSold"', 'DESC')
        .limit(5);

      if (startDate && endDate) {
        topProductsQuery.andWhere(
          'order.createdAt BETWEEN :startDate AND :endDate',
          {
            startDate,
            endDate,
          },
        );
      }

      const _rawTop = (await topProductsQuery.getRawMany()) as unknown;
      const rawTopProducts = _rawTop as
        | Array<{
            productId?: string | number;
            name?: string;
            totalSold?: string | number;
            revenue?: string | number;
          }>
        | [];

      const topSellingProducts = rawTopProducts.map(
        (p: {
          productId?: string | number;
          name?: string;
          totalSold?: string | number;
          revenue?: string | number;
        }) => ({
          productId: String(p?.productId ?? ''),
          name: String(p?.name ?? ''),
          totalSold: Number(p?.totalSold ?? 0),
          revenue: parseFloat(String(p?.revenue ?? '0')),
        }),
      );

      // 3. Alertes de stock bas (<= 5 unités)
      const lowStockProducts = await this.productRepository
        .createQueryBuilder('product')
        .select(['product.id', 'product.name', 'product.stockQuantity'])
        .where('product.businessId = :businessId', { businessId })
        .andWhere('product.trackStock = true')
        .andWhere('product.stockQuantity <= :threshold', { threshold: 5 })
        .orderBy('product.stockQuantity', 'ASC')
        .getMany();

      return {
        summary: {
          totalRevenue,
          netEarnings,
          platformCommission,
          totalOrders,
          completedOrders,
          cancelledOrders,
          averageOrderValue,
        },
        topSellingProducts,
        lowStockAlerts: lowStockProducts.map((p) => ({
          productId: p.id,
          name: p.name,
          stockQuantity: p.stockQuantity,
        })),
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const meta = err instanceof Error ? err.stack : undefined;
      this.logger.error(
        `Erreur lors de la récupération du dashboard pour le marchand ${businessId}: ${msg}`,
        meta,
      );
      throw err;
    }
  }

  /**
   * 📈 2. Vue d'ensemble du business (Graphiques et distribution)
   */
  async getBusinessOverview(
    businessId: string,
    userId: string,
    role: UserRole | undefined,
    filter: AnalyticsFilterDto,
  ) {
    const { startDate, endDate } = this.resolveDateRange(filter);

    // 🔒 Vérifier l'accès : un BUSINESS_ADMIN ne peut consulter que ses propres
    // commerces (via ses marques). SUPER_ADMIN peut tout voir.
    if (role === UserRole.BUSINESS_ADMIN) {
      const owned = await this.businessRepository
        .createQueryBuilder('biz')
        .innerJoin('biz.brand', 'brand')
        .where('biz.id = :businessId', { businessId })
        .andWhere('brand.ownerId = :userId', { userId })
        .getOne();
      if (!owned) {
        throw new Error('Commerce introuvable ou accès refusé');
      }
    }

    const query = this.orderRepository
      .createQueryBuilder('o')
      .where('o.businessId = :businessId', { businessId })
      .andWhere('o.status != :cancelled', {
        cancelled: OrderStatus.CANCELLED,
      });

    if (startDate && endDate) {
      query.andWhere('o.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    }

    const orders = await query.getMany();

    const totalOrdersCount = orders.length;
    const completedOrdersCount = orders.filter(
      (o) =>
        o.status === OrderStatus.DELIVERED ||
        o.status === OrderStatus.COMPLETED,
    ).length;

    // Chiffre d'Affaires Brut (hors frais de livraison)
    const grossSales = orders.reduce((sum, o) => {
      const productTotal = Number(o.totalAmount) - Number(o.deliveryFee || 0);
      return sum + productTotal;
    }, 0);

    const fasofreeCommission = Number(
      (grossSales * this.COMMISSION_RATE).toFixed(2),
    );
    const netRevenue = Number((grossSales - fasofreeCommission).toFixed(2));
    const averageOrderValue =
      totalOrdersCount > 0
        ? Number((grossSales / totalOrdersCount).toFixed(2))
        : 0;

    const deliveryCount = orders.filter(
      (o) => o.orderType === OrderType.DELIVERY,
    ).length;
    const pickupCount = orders.filter(
      (o) => o.orderType === OrderType.PICKUP,
    ).length;

    return {
      period: filter.period || 'custom',
      summary: {
        totalOrders: totalOrdersCount,
        completedOrders: completedOrdersCount,
        grossSalesXOF: grossSales,
        fasofreeCommissionXOF: fasofreeCommission,
        netRevenueXOF: netRevenue,
        averageOrderValueXOF: averageOrderValue,
      },
      distribution: {
        deliveryCount,
        pickupCount,
        deliveryPercentage:
          totalOrdersCount > 0
            ? Number(((deliveryCount / totalOrdersCount) * 100).toFixed(1))
            : 0,
        pickupPercentage:
          totalOrdersCount > 0
            ? Number(((pickupCount / totalOrdersCount) * 100).toFixed(1))
            : 0,
      },
      chartData: this.groupSalesByDay(orders),
    };
  }

  // --- HELPERS PRIVÉS ---

  /**
   * 🗓️ Calcule la plage de dates en fonction de la période demandée
   */
  private resolveDateRange(filter: AnalyticsFilterDto): {
    startDate?: Date;
    endDate?: Date;
  } {
    const now = new Date();
    let startDate: Date | undefined;
    const endDate: Date = new Date();

    if (filter.startDate && filter.endDate) {
      return {
        startDate: new Date(filter.startDate),
        endDate: new Date(`${filter.endDate}T23:59:59.999Z`),
      };
    }

    switch (filter.period) {
      case AnalyticsPeriod.TODAY:
        startDate = new Date(now.setHours(0, 0, 0, 0));
        break;
      case AnalyticsPeriod.WEEK:
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case AnalyticsPeriod.MONTH:
        startDate = new Date(now.setMonth(now.getMonth() - 1));
        break;
      case AnalyticsPeriod.YEAR:
        startDate = new Date(now.setFullYear(now.getFullYear() - 1));
        break;
      case AnalyticsPeriod.ALL:
      default:
        startDate = undefined;
        break;
    }

    return { startDate, endDate };
  }

  /**
   * 📊 Groupe les ventes par jour pour alimenter les graphiques frontend (Chart.js, Recharts, etc.)
   */
  private groupSalesByDay(orders: Order[]) {
    const groupedMap = new Map<
      string,
      { date: string; sales: number; ordersCount: number }
    >();

    orders.forEach((order) => {
      const dateStr = order.createdAt.toISOString().split('T')[0];
      const productTotal =
        Number(order.totalAmount) - Number(order.deliveryFee || 0);

      if (!groupedMap.has(dateStr)) {
        groupedMap.set(dateStr, { date: dateStr, sales: 0, ordersCount: 0 });
      }

      const current = groupedMap.get(dateStr)!;
      current.sales += productTotal;
      current.ordersCount += 1;
    });

    return Array.from(groupedMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );
  }

  // ========================================================================
  // 🏷️ ANALYTICS PAR MARQUE (agrégés sur toutes les agences)
  // ========================================================================

  async getBrandOverview(
    brandId: string,
    userId: string,
    filter: AnalyticsFilterDto,
  ) {
    const { startDate, endDate } = this.resolveDateRange(filter);

    // 1. Vérifier que la marque appartient au marchand
    const brand = await this.brandRepository.findOne({
      where: { id: brandId, ownerId: userId },
      relations: { businesses: true },
    });
    if (!brand) {
      throw new Error('Marque introuvable ou accès refusé');
    }

    const businessIds = brand.businesses.map((b) => b.id);
    if (businessIds.length === 0) {
      return {
        summary: {
          totalRevenue: 0,
          netEarnings: 0,
          platformCommission: 0,
          totalOrders: 0,
          completedOrders: 0,
          cancelledOrders: 0,
          averageOrderValue: 0,
        },
        branches: [],
        salesChart: [],
      };
    }

    // 2. Stats agrégées sur toutes les agences
    const query = this.orderRepository
      .createQueryBuilder('o')
      .select('COUNT(o.id)', 'totalOrders')
      .addSelect(
        'SUM(CASE WHEN o.status = :deliveredStatus THEN o.totalAmount ELSE 0 END)',
        'totalRevenue',
      )
      .addSelect(
        'COUNT(CASE WHEN o.status = :deliveredStatus THEN 1 END)',
        'completedOrders',
      )
      .addSelect(
        'COUNT(CASE WHEN o.status = :cancelledStatus THEN 1 END)',
        'cancelledOrders',
      )
      .where('o.businessId IN (:...businessIds)', { businessIds })
      .setParameters({
        deliveredStatus: OrderStatus.DELIVERED,
        cancelledStatus: OrderStatus.CANCELLED,
      });

    if (startDate && endDate) {
      query.andWhere('o.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    }

    const raw = await query.getRawOne();
    const totalOrders = Number(raw?.totalOrders ?? 0);
    const completedOrders = Number(raw?.completedOrders ?? 0);
    const cancelledOrders = Number(raw?.cancelledOrders ?? 0);
    const totalRevenue = parseFloat(String(raw?.totalRevenue ?? '0'));
    const platformCommission = totalRevenue * this.COMMISSION_RATE;
    const netEarnings = totalRevenue - platformCommission;
    const averageOrderValue = completedOrders > 0 ? Math.round(totalRevenue / completedOrders) : 0;

    // 3. Détail par agence
    const branchStats = await Promise.all(
      brand.businesses.map(async (biz) => {
        const bQuery = this.orderRepository
          .createQueryBuilder('o')
          .select('COUNT(o.id)', 'totalOrders')
          .addSelect(
            'SUM(CASE WHEN o.status = :deliveredStatus THEN o.totalAmount ELSE 0 END)',
            'revenue',
          )
          .where('o.businessId = :businessId', { businessId: biz.id })
          .setParameters({ deliveredStatus: OrderStatus.DELIVERED });

        if (startDate && endDate) {
          bQuery.andWhere('o.createdAt BETWEEN :startDate AND :endDate', {
            startDate,
            endDate,
          });
        }

        const bRaw = await bQuery.getRawOne();
        return {
          businessId: biz.id,
          name: biz.name,
          totalOrders: Number(bRaw?.totalOrders ?? 0),
          revenue: parseFloat(String(bRaw?.revenue ?? '0')),
        };
      }),
    );

    // 4. Graphique ventes par jour
    const ordersInRange = await this.orderRepository.find({
      where: businessIds.map((id) => ({ businessId: id, status: OrderStatus.DELIVERED })),
    });
    const salesChart = this.groupSalesByDay(ordersInRange);

    return {
      summary: {
        totalRevenue,
        netEarnings,
        platformCommission,
        totalOrders,
        completedOrders,
        cancelledOrders,
        averageOrderValue,
      },
      branches: branchStats,
      salesChart,
    };
  }

  async compareBranches(
    brandId: string,
    userId: string,
    filter: AnalyticsFilterDto,
  ) {
    const { startDate, endDate } = this.resolveDateRange(filter);

    const brand = await this.brandRepository.findOne({
      where: { id: brandId, ownerId: userId },
      relations: { businesses: true },
    });
    if (!brand) {
      throw new Error('Marque introuvable ou accès refusé');
    }

    const branches = await Promise.all(
      brand.businesses.map(async (biz) => {
        const overview = await this.getBusinessOverview(
          biz.id,
          userId,
          UserRole.SUPER_ADMIN,
          filter,
        );
        return {
          businessId: biz.id,
          name: biz.name,
          ...overview,
        };
      }),
    );

    return branches;
  }
}
