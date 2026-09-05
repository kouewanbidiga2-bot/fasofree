import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Wallet } from '../../wallets/entities/wallet.entity';
import { WalletTransaction, TransactionType, TransactionReason } from '../../wallets/entities/wallet-transaction.entity';
import { PayoutRequest, PayoutStatus } from '../entities/payout-request.entity';
import { Order, OrderStatus, FulfillmentType } from '../../orders/entities/order.entity';
import { OrderItem } from '../../orders/entities/order-item.entity';
import { Business } from '../../businesses/entities/business.entity';
import { Brand } from '../../brands/entities/brand.entity';
import { GeniusPayService } from '../../payments/providers/geniuspay.service';
import { WalletService } from '../../wallets/wallet.service';
export interface FinancialDashboardSummary {
  ligdiCash: {
    payinBalance: number;
    payoutBalance: number;
    totalRealCash: number;
  };
  internalLiabilities: {
    driversTotalBalance: number;
    merchantsTotalBalance: number;
    totalVirtualLiabilities: number;
  };
  metrics: {
    coverageRatio: number;
    status: 'GREEN' | 'ORANGE' | 'RED';
    pendingPayoutsCount: number;
    pendingPayoutsAmount: number;
  };
}

@Injectable()
export class FinancialMonitoringService {
  private readonly logger = new Logger(FinancialMonitoringService.name);

  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
    @InjectRepository(WalletTransaction)
    private readonly walletTxRepository: Repository<WalletTransaction>,
    @InjectRepository(PayoutRequest)
    private readonly payoutRepository: Repository<PayoutRequest>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
    @InjectRepository(Brand)
    private readonly brandRepository: Repository<Brand>,
    private readonly geniusPayService: GeniusPayService,
    private readonly walletService: WalletService,
  ) {}

  async getDashboardSummary(): Promise<FinancialDashboardSummary> {
    try {
      // 1. Solde réel chez GeniusPay (Appel API)
      const geniusPayBalance = await this.geniusPayService
        .getBalance()
        .catch((err) => {
          this.logger.error(
            'Échec récupération solde GeniusPay',
            err?.stack ?? err,
          );
          return null;
        });

      const balances = {
        available: Number(geniusPayBalance?.available ?? 0),
        pending: Number(geniusPayBalance?.pending ?? 0),
      };

      // 2. Passifs virtuels (Dette interne envers les livreurs et marchands)
      const liabilities = await this.walletRepository
        .createQueryBuilder('wallet')
        .select('wallet.userRole', 'userRole')
        .addSelect('SUM(wallet.balance)', 'total')
        .groupBy('wallet.userRole')
        .getRawMany();

      let driversTotal = 0;
      let merchantsTotal = 0;

      liabilities.forEach((item: any) => {
        const userRole = item.userRole;
        const total = Number(item.total) || 0;
        if (userRole === 'DRIVER') driversTotal = total;
        if (userRole === 'MERCHANT') merchantsTotal = total;
      });

      const totalVirtualLiabilities = driversTotal + merchantsTotal;

      // 3. Demandes de retraits en attente dans la file
      const pendingStatsRaw = await this.payoutRepository
        .createQueryBuilder('payout')
        .select('COUNT(payout.id)', 'count')
        .addSelect('SUM(payout.amount)', 'total')
        .where('payout.status = :status', { status: PayoutStatus.PENDING })
        .getRawOne();

      const pendingPayoutsCount = Number(pendingStatsRaw?.count ?? 0) || 0;
      const pendingPayoutsAmount = Number(pendingStatsRaw?.total ?? 0) || 0;

      // 4. Calcul du Ratio de Couverture
      const coverageBalance = Number(balances.available) || 0;
      const coverageRatio =
        totalVirtualLiabilities > 0
          ? coverageBalance / totalVirtualLiabilities
          : 1.0;

      let status: 'GREEN' | 'ORANGE' | 'RED' = 'GREEN';
      if (coverageRatio < 0.5) {
        status = 'RED';
      } else if (coverageRatio < 1.0) {
        status = 'ORANGE';
      }

      return {
        ligdiCash: {
          payinBalance: balances.available,
          payoutBalance: balances.pending,
          totalRealCash: balances.available + balances.pending,
        },
        internalLiabilities: {
          driversTotalBalance: driversTotal,
          merchantsTotalBalance: merchantsTotal,
          totalVirtualLiabilities,
        },
        metrics: {
          coverageRatio: Number(coverageRatio.toFixed(2)),
          status,
          pendingPayoutsCount,
          pendingPayoutsAmount,
        },
      };
    } catch (err) {
      this.logger.error(
        'Erreur lors de la construction du dashboard financier',
        err?.stack ?? err,
      );
      // Retourne un résumé sûr par défaut pour éviter crashs en aval
      return {
        ligdiCash: { payinBalance: 0, payoutBalance: 0, totalRealCash: 0 },
        internalLiabilities: {
          driversTotalBalance: 0,
          merchantsTotalBalance: 0,
          totalVirtualLiabilities: 0,
        },
        metrics: {
          coverageRatio: 1.0,
          status: 'GREEN',
          pendingPayoutsCount: 0,
          pendingPayoutsAmount: 0,
        },
      };
    }
  }

  async getOverview(period: string = '30d') {
    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const orders = await this.orderRepository
      .createQueryBuilder('o')
      .select("TO_CHAR(o.createdAt AT TIME ZONE 'Africa/Ouagadougou', 'YYYY-MM-DD')", 'date')
      .addSelect('COUNT(o.id)', 'orderCount')
      .addSelect('SUM(o.totalAmount)', 'revenue')
      .addSelect('SUM(o.platformCommission)', 'platformCommission')
      .addSelect('SUM(o.serviceFee)', 'serviceFee')
      .addSelect('SUM(o.deliveryFee)', 'deliveryFee')
      .addSelect('SUM(o.merchantPayoutAmount)', 'merchantPayout')
      .addSelect('SUM(o.merchantCommissionAmount)', 'merchantCommission')
      .addSelect('SUM(o.driverCommissionAmount)', 'driverCommission')
      .where('o.createdAt >= :since', { since })
      .andWhere("o.status NOT IN (:...excluded)", {
        excluded: [OrderStatus.CANCELLED, OrderStatus.FAILED],
      })
      .groupBy("date")
      .orderBy('date', 'ASC')
      .getRawMany();

    const cancelled = await this.orderRepository
      .createQueryBuilder('o')
      .select("TO_CHAR(o.createdAt AT TIME ZONE 'Africa/Ouagadougou', 'YYYY-MM-DD')", 'date')
      .addSelect('COUNT(o.id)', 'count')
      .addSelect('SUM(o.totalAmount)', 'amount')
      .where('o.createdAt >= :since', { since })
      .andWhere("o.status IN (:...statuses)", {
        statuses: [OrderStatus.CANCELLED, OrderStatus.REFUNDED],
      })
      .groupBy("date")
      .orderBy('date', 'ASC')
      .getRawMany();

    const cancelledMap: Record<string, { count: number; amount: number }> = {};
    cancelled.forEach((c) => {
      cancelledMap[c.date] = { count: Number(c.count), amount: Number(c.amount) || 0 };
    });

    const summary = {
      totalRevenue: 0,
      totalPlatformCommission: 0,
      totalServiceFee: 0,
      totalDeliveryFee: 0,
      totalMerchantPayout: 0,
      totalMerchantCommission: 0,
      totalDriverCommission: 0,
      totalOrders: 0,
      totalCancelled: 0,
      cancelledAmount: 0,
    };

    const chartData = orders.map((row) => {
      const date = row.date;
      const revenue = Number(row.revenue) || 0;
      const platformCommission = Number(row.platformCommission) || 0;
      const serviceFee = Number(row.serviceFee) || 0;
      const deliveryFee = Number(row.deliveryFee) || 0;
      const merchantPayout = Number(row.merchantPayout) || 0;
      const merchantCommission = Number(row.merchantCommission) || 0;
      const driverCommission = Number(row.driverCommission) || 0;
      const orderCount = Number(row.orderCount) || 0;
      const cancelled = cancelledMap[date] || { count: 0, amount: 0 };

      summary.totalRevenue += revenue;
      summary.totalPlatformCommission += platformCommission;
      summary.totalServiceFee += serviceFee;
      summary.totalDeliveryFee += deliveryFee;
      summary.totalMerchantPayout += merchantPayout;
      summary.totalMerchantCommission += merchantCommission;
      summary.totalDriverCommission += driverCommission;
      summary.totalOrders += orderCount;
      summary.totalCancelled += cancelled.count;
      summary.cancelledAmount += cancelled.amount;

      return {
        date,
        revenue,
        platformCommission,
        serviceFee,
        deliveryFee,
        merchantPayout,
        merchantCommission,
        driverCommission,
        orderCount,
        cancelledCount: cancelled.count,
        cancelledAmount: cancelled.amount,
      };
    });

    return { period, summary, chartData };
  }

  // ─── ANALYTICS PRODUITS ────────────────────────────────────────────
  async getProductAnalytics(filters: { brandId?: string; businessId?: string; period?: string }) {
    const days = filters.period === '7d' ? 7 : filters.period === '90d' ? 90 : 30;
    const since = new Date();
    since.setDate(since.getDate() - days);

    let qb = this.orderItemRepository
      .createQueryBuilder('item')
      .innerJoin('item.order', 'o')
      .select('item.productId', 'productId')
      .addSelect('item.productName', 'productName')
      .addSelect('SUM(item.quantity)', 'totalPurchased')
      .addSelect('SUM(item.totalPrice)', 'totalRevenue')
      .addSelect('SUM(CASE WHEN o.fulfillmentType = :delivery THEN item.quantity ELSE 0 END)', 'deliveryCount')
      .addSelect('SUM(CASE WHEN o.fulfillmentType IN (:pickup, :dineIn) THEN item.quantity ELSE 0 END)', 'onsiteCount')
      .where('o.createdAt >= :since', { since })
      .andWhere("o.status NOT IN (:...excluded)", {
        excluded: [OrderStatus.CANCELLED, OrderStatus.FAILED],
      })
      .setParameters({ delivery: FulfillmentType.DELIVERY, pickup: FulfillmentType.PICKUP, dineIn: FulfillmentType.DINE_IN });

    if (filters.businessId) {
      qb = qb.andWhere('o.businessId = :businessId', { businessId: filters.businessId });
    } else if (filters.brandId) {
      const branches = await this.businessRepository.find({ where: { brand: { id: filters.brandId } } });
      const branchIds = branches.map(b => b.id);
      if (branchIds.length > 0) {
        qb = qb.andWhere('o.businessId IN (:...branchIds)', { branchIds });
      }
    }

    const items = await qb
      .groupBy('item.productId')
      .addGroupBy('item.productName')
      .orderBy('totalPurchased', 'DESC')
      .getRawMany();

    const products = items.map(row => ({
      productId: row.productId,
      productName: row.productName,
      totalPurchased: Number(row.totalPurchased) || 0,
      totalRevenue: Number(row.totalRevenue) || 0,
      deliveryCount: Number(row.deliveryCount) || 0,
      onsiteCount: Number(row.onsiteCount) || 0,
    }));

    return {
      period: filters.period || '30d',
      totalProducts: products.length,
      totalItemsSold: products.reduce((s, p) => s + p.totalPurchased, 0),
      topProducts: products.slice(0, 10),
      worstProducts: products.slice(-10).reverse(),
      products,
    };
  }

  // ─── FLUX D'ARGENT COMPLET (Wallet Transactions) ──────────────────
  async getMoneyFlows(filters: { brandId?: string; businessId?: string; period?: string }) {
    const days = filters.period === '7d' ? 7 : filters.period === '90d' ? 90 : 30;
    const since = new Date();
    since.setDate(since.getDate() - days);

    let qb = this.walletTxRepository
      .createQueryBuilder('tx')
      .innerJoin('tx.wallet', 'w')
      .select('tx.reason', 'reason')
      .addSelect('tx.type', 'type')
      .addSelect('COUNT(tx.id)', 'count')
      .addSelect('SUM(tx.amount)', 'totalAmount')
      .addSelect("TO_CHAR(tx.createdAt AT TIME ZONE 'Africa/Ouagadougou', 'YYYY-MM-DD')", 'date')
      .where('tx.createdAt >= :since', { since })
      .andWhere('tx.status = :status', { status: 'COMPLETED' });

    if (filters.businessId) {
      const wallet = await this.walletRepository.findOne({ where: { userId: filters.businessId, userRole: 'MERCHANT' as any } });
      if (wallet) {
        qb = qb.andWhere('tx.walletId = :walletId', { walletId: wallet.id });
      }
    } else if (filters.brandId) {
      const branches = await this.businessRepository.find({ where: { brand: { id: filters.brandId } } });
      const branchIds = branches.map(b => b.id);
      if (branchIds.length > 0) {
        qb = qb.andWhere('(w.branchId IN (:...branchIds) OR w.branchId IS NULL)', { branchIds });
      }
    }

    const rows = await qb
      .groupBy('tx.reason')
      .addGroupBy('tx.type')
      .addGroupBy('date')
      .orderBy('date', 'ASC')
      .getRawMany();

    // Classification des flux
    const ENTRIES = [TransactionReason.ORDER_PAYMENT, TransactionReason.TOPUP, TransactionReason.REFERRAL_REWARD, TransactionReason.DELIVERY_FEE];
    const EXITS = [TransactionReason.WITHDRAWAL, TransactionReason.PAYOUT, TransactionReason.COMMISSION, TransactionReason.SERVICE_FEE, TransactionReason.DAILY_PASS_FEE, TransactionReason.SUBSCRIPTION_FEE];
    const REVERSALS = [TransactionReason.REFUND];

    const summary = {
      totalEntries: 0,
      totalExits: 0,
      totalReversals: 0,
      byReason: {} as Record<string, { count: number; amount: number; type: string }>,
    };

    const chartData: Record<string, any> = {};

    rows.forEach(row => {
      const reason = row.reason;
      const amount = Number(row.totalAmount) || 0;
      const count = Number(row.count) || 0;
      const date = row.date;

      if (!summary.byReason[reason]) {
        summary.byReason[reason] = { count: 0, amount: 0, type: row.type };
      }
      summary.byReason[reason].count += count;
      summary.byReason[reason].amount += amount;

      if (ENTRIES.includes(reason)) summary.totalEntries += amount;
      else if (EXITS.includes(reason)) summary.totalExits += amount;
      else if (REVERSALS.includes(reason)) summary.totalReversals += amount;

      if (!chartData[date]) {
        chartData[date] = { date, entries: 0, exits: 0, reversals: 0 };
      }
      if (ENTRIES.includes(reason)) chartData[date].entries += amount;
      else if (EXITS.includes(reason)) chartData[date].exits += amount;
      else if (REVERSALS.includes(reason)) chartData[date].reversals += amount;
    });

    return {
      period: filters.period || '30d',
      summary,
      chartData: Object.values(chartData),
    };
  }

  // ─── VUE PAR MARQUE / AGENCE ──────────────────────────────────────
  async getBrandBreakdown(period: string = '30d') {
    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const brands = await this.brandRepository.find({ relations: { businesses: true } as any });

    const breakdown = await Promise.all(brands.map(async (brand) => {
      const branchIds = (brand as any).businesses?.map(b => b.id) || [];
      if (branchIds.length === 0) return { brandId: brand.id, brandName: brand.name, branches: [], totals: { revenue: 0, orders: 0, commission: 0 } };

      const branchStats = await this.orderRepository
        .createQueryBuilder('o')
        .select('o.branchId', 'branchId')
        .addSelect('b.name', 'branchName')
        .addSelect('SUM(o.totalAmount)', 'revenue')
        .addSelect('SUM(o.platformCommission)', 'commission')
        .addSelect('SUM(o.serviceFee)', 'serviceFee')
        .addSelect('SUM(o.deliveryFee)', 'deliveryFee')
        .addSelect('COUNT(o.id)', 'orderCount')
        .innerJoin(Business, 'b', 'b.id = o.branchId')
        .where('o.branchId IN (:...branchIds)', { branchIds })
        .andWhere('o.createdAt >= :since', { since })
        .andWhere("o.status NOT IN (:...excluded)", {
          excluded: [OrderStatus.CANCELLED, OrderStatus.FAILED],
        })
        .groupBy('o.branchId')
        .addGroupBy('b.name')
        .getRawMany();

      const totals = branchStats.reduce((acc, r) => ({
        revenue: acc.revenue + (Number(r.revenue) || 0),
        orders: acc.orders + (Number(r.orderCount) || 0),
        commission: acc.commission + (Number(r.commission) || 0),
      }), { revenue: 0, orders: 0, commission: 0 });

      return {
        brandId: brand.id,
        brandName: brand.name,
        branches: branchStats.map(r => ({
          branchId: r.branchId,
          branchName: r.branchName,
          revenue: Number(r.revenue) || 0,
          commission: Number(r.commission) || 0,
          serviceFee: Number(r.serviceFee) || 0,
          deliveryFee: Number(r.deliveryFee) || 0,
          orderCount: Number(r.orderCount) || 0,
        })),
        totals,
      };
    }));

    return { period, brands: breakdown };
  }

  // ─── FINANCES PAR BUSINESS (pour BusinessAdmin) ───────────────────
  async getBusinessFinance(businessId: string, period: string = '30d') {
    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const overview = await this.getOverview(period);
    const productAnalytics = await this.getProductAnalytics({ businessId, period });
    const moneyFlows = await this.getMoneyFlows({ businessId, period });

    const business = await this.businessRepository.findOne({ where: { id: businessId } });

    return {
      business: business ? { id: business.id, name: business.name } : null,
      overview,
      products: productAnalytics,
      moneyFlows,
    };
  }
}
