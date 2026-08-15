import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinancialController } from './financial.controller';
import { FinancialMonitoringService } from './services/financial-monitoring.service';
import { FinancialAlertsCron } from './crons/financial-alerts.cron';

// Entités requis pour les Repositories
import { PayoutRequest } from './entities/payout-request.entity';
import { Wallet } from '../wallets/entities/wallet.entity';
import { Order } from '../orders/entities/order.entity';

// Modules fournissant LigdiCashService et WalletService
import { WalletModule } from '../wallets/wallet.module';
import { LigdiCashModule } from '../payments/ligdicash.module';

// Modèle financier hybride FasoFree (commissions ultra-basses / abonnements)
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { OrderPricingService } from './order-pricing.service';
import { DriverFinancialService } from './driver-financial.service';
import { MerchantFinancialService } from './merchant-financial.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PayoutRequest, Wallet, Order]),
    WalletModule,
    LigdiCashModule,
    SubscriptionsModule,
  ],
  controllers: [FinancialController],
  providers: [
    FinancialMonitoringService,
    FinancialAlertsCron,
    OrderPricingService,
    DriverFinancialService,
    MerchantFinancialService,
  ],
  exports: [FinancialMonitoringService, OrderPricingService],
})
export class FinancialModule {}
