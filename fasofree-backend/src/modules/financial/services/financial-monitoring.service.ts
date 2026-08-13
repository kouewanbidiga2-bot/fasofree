import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Wallet } from '../../wallets/entities/wallet.entity';
import { PayoutRequest, PayoutStatus } from '../entities/payout-request.entity';
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
        .select('wallet.ownerType', 'ownerType')
        .addSelect('SUM(wallet.balance)', 'total')
        .groupBy('wallet.ownerType')
        .getRawMany();

      let driversTotal = 0;
      let merchantsTotal = 0;

      liabilities.forEach((item: any) => {
        const ownerType = item.ownerType;
        const total = Number(item.total) || 0;
        if (ownerType === 'DRIVER') driversTotal = total;
        if (ownerType === 'MERCHANT') merchantsTotal = total;
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
}
