import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { GeoDispatchService } from './dispatch.service';
import { DeliveryPricingService } from './delivery-pricing.service';
import { QrCodeService } from './qr-code.service';
import { DistanceCalculatorService } from './services/distance-calculator.service';
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

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, Transaction]),
    ScheduleModule.forRoot(),
    forwardRef(() => DispatchModule),
    forwardRef(() => AnalyticsModule),
    forwardRef(() => PaymentsModule),
    BusinessesModule,
    RedisModule,
    forwardRef(() => DisputesModule),
    PromotionsModule,
    NotificationsModule,
    UsersModule,
  ],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    GeoDispatchService,
    DeliveryPricingService,
    QrCodeService,
    DistanceCalculatorService,
  ],
  exports: [
    OrdersService,
    GeoDispatchService,
    DeliveryPricingService,
    QrCodeService,
    DistanceCalculatorService,
  ],
})
export class OrdersModule {}
