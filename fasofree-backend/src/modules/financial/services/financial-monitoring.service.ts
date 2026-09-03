import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Wallet } from '../../wallets/entities/wallet.entity';
import { PayoutRequest, PayoutStatus } from '../entities/payout-request.entity';
import { Order, OrderStatus } from '../../orders/entities/order.entity';
import { LigdiCashService } from '../../payments/providers/ligdicash.service';
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
    @InjectRepository(PayoutRequest)
    private readonly payoutRepository: Repository<PayoutRequest>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly ligdiCashService: LigdiCashService,
    private readonly walletService: WalletService,
  ) {}

  async getDashboardSummary(): Promise<FinancialDashboardSummary> {
    try {
      // 1. Solde réel chez LigdiCash (Appel API) - garde des valeurs par défaut en cas d'échec
      const ligdiBalancesRaw = await this.ligdiCashService
        .getAccountBalances()
        .catch((err) => {
          this.logger.error(
            'Échec récupération soldes LigdiCash',
            err?.stack ?? err,
          );
          return null;
        });

      const ligdiBalances = {
        payinBalance: Number(ligdiBalancesRaw?.payinBalance ?? 0),
        payoutBalance: Number(ligdiBalancesRaw?.payoutBalance ?? 0),
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
      // Formula: Solde Payout Réel / Total Passifs Virtuels
      const payoutBalance = Number(ligdiBalances.payoutBalance) || 0;
      const coverageRatio =
        totalVirtualLiabilities > 0
          ? payoutBalance / totalVirtualLiabilities
          : 1.0;

      let status: 'GREEN' | 'ORANGE' | 'RED' = 'GREEN';
      if (coverageRatio < 0.5) {
        status = 'RED';
      } else if (coverageRatio < 1.0) {
        status = 'ORANGE';
      }

      return {
        ligdiCash: {
          payinBalance: ligdiBalances.payinBalance,
          payoutBalance: payoutBalance,
          totalRealCash: ligdiBalances.payinBalance + payoutBalance,
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
}
