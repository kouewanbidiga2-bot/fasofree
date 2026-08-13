import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { DispatchService } from './dispatch.service';
import { DeliveryPricingService } from './delivery-pricing.service'; // 👈 Déclaré ici
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { Transaction } from '../payments/entities/transaction.entity';
import { DispatchModule } from '../dispatch/dispatch.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { PaymentsModule } from '../payments/payments.module';
import { BusinessesModule } from '../businesses/businesses.module';
import { RedisModule } from '../../core/redis/redis.module'; // 👈 Import de Redis pour fournir le REDIS_CLIENT
import { DisputesModule } from '../disputes/disputes.module';
import { PromotionsModule } from '../promotions/promotions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, Transaction]),
    ScheduleModule.forRoot(), // 👈 Cron auto-complétion 24h
    forwardRef(() => DispatchModule),
    forwardRef(() => AnalyticsModule),
    forwardRef(() => PaymentsModule),
    BusinessesModule,
    RedisModule, // 👈 Ajouté aux imports pour résoudre l'index [0]
    forwardRef(() => DisputesModule),
    PromotionsModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService, DispatchService, DeliveryPricingService], // 👈 Ajout du PricingService pour résoudre l'index [3]
  exports: [OrdersService, DispatchService, DeliveryPricingService],
})
export class OrdersModule {}
