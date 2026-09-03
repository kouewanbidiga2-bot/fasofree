import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinancialController } from './financial.controller';
import { FinancialMonitoringService } from './services/financial-monitoring.service';
import { FinancialAlertsCron } from './crons/financial-alerts.cron';

// Entités requis pour les Repositories
import { PayoutRequest } from './entities/payout-request.entity';
import { Wallet } from '../wallets/entities/wallet.entity';
import { WalletTransaction } from '../wallets/entities/wallet-transaction.entity';
import { Order } from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { Business } from '../businesses/entities/business.entity';
import { Brand } from '../brands/entities/brand.entity';
import { Product } from '../products/entities/product.entity';

// Modules fournissant LigdiCashService et WalletService
import { WalletModule } from '../wallets/wallet.module';
import { LigdiCashModule } from '../payments/ligdicash.module';
import { ReceiptsModule } from '../receipts/receipts.module';

// Modèle financier hybride FasoFree (commissions ultra-basses / abonnements)
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { OrderPricingService } from './order-pricing.service';
import { DriverFinancialService } from './driver-financial.service';
import { MerchantFinancialService } from './merchant-financial.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PayoutRequest, Wallet, WalletTransaction, Order, OrderItem, Business, Brand, Product]),
    WalletModule,
    LigdiCashModule,
    SubscriptionsModule,
    ReceiptsModule,
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
