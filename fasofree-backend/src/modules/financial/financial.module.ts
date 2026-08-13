import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinancialController } from './financial.controller';
import { FinancialMonitoringService } from './services/financial-monitoring.service';
import { FinancialAlertsCron } from './crons/financial-alerts.cron';

// Entités requis pour les Repositories (index [0] et [1])
import { PayoutRequest } from './entities/payout-request.entity';
import { Wallet } from '../wallets/entities/wallet.entity';

// Modules fournissant LigdiCashService et WalletService (index [2] et [3])
import { WalletModule } from '../wallets/wallet.module';
import { LigdiCashModule } from '../payments/ligdicash.module'; // ou PaymentsModule selon ton arborescence

@Module({
  imports: [
    TypeOrmModule.forFeature([PayoutRequest, Wallet]),
    WalletModule, // 👈 Fournit WalletService
    LigdiCashModule, // 👈 Fournit LigdiCashService
  ],
  controllers: [FinancialController],
  providers: [FinancialMonitoringService, FinancialAlertsCron],
  exports: [FinancialMonitoringService],
})
export class FinancialModule {}
