import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { GeoDispatchService } from './dispatch.service';
import { DeliveryPricingService } from './delivery-pricing.service';
import { QrCodeService } from './qr-code.service';
import { DistanceCalculatorService } from './services/distance-calculator.service';
import { RidePricingService } from './services/ride-pricing.service';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { Transaction } from '../payments/entities/transaction.entity';
import { DispatchModule } from '../dispatch/dispatch.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { PaymentsModule } from '../payments/payments.module';
import { BusinessesModule } from '../businesses/businesses.module';
import { RedisModule } from '../../core/redis/redis.module';
import { DisputesModule } from '../disputes/disputes.module';
import { PromotionsModule } from '../promotions/promotions.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { FinancialModule } from '../financial/financial.module';
import { ReceiptsModule } from '../receipts/receipts.module';
import { WalletModule } from '../wallets/wallet.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, Transaction]),
    forwardRef(() => DispatchModule),
    forwardRef(() => AnalyticsModule),
    forwardRef(() => PaymentsModule),
    forwardRef(() => FinancialModule),
    BusinessesModule,
    RedisModule,
    forwardRef(() => DisputesModule),
    PromotionsModule,
    NotificationsModule,
    UsersModule,
    ReceiptsModule,
    WalletModule,
    SubscriptionsModule,
  ],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    GeoDispatchService,
    DeliveryPricingService,
    QrCodeService,
    DistanceCalculatorService,
    RidePricingService,
  ],
  exports: [
    OrdersService,
    GeoDispatchService,
    DeliveryPricingService,
    QrCodeService,
    DistanceCalculatorService,
    RidePricingService,
  ],
})
export class OrdersModule {}
