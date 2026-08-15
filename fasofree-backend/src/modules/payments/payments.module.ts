import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios'; // 👈 Injection du module Axios pour HttpService

import { PaymentsService } from './payments.service';
import { PayoutsService } from './payouts.service';
import { WebhooksService } from './webhooks.service';
import { PaymentsController } from './payments.controller';

// Entités TypeORM
import { MerchantPayout } from './entities/merchant-payout.entity';
import { Transaction } from './entities/transaction.entity';
import { FinancialLedger } from './entities/financial-ledger.entity';
import { Order } from '../orders/entities/order.entity';
import { Business } from '../businesses/entities/business.entity';
import { RedisModule } from '../../core/redis/redis.module';
import { OrdersModule } from '../orders/orders.module';
import { LigdiCashModule } from './ligdicash.module';

@Module({
  imports: [
    RedisModule,
    HttpModule, // 👈 Règle l'erreur 'HttpService at index [3]'
    forwardRef(() => OrdersModule),
    forwardRef(() => LigdiCashModule),
    TypeOrmModule.forFeature([
      MerchantPayout,
      Transaction,
      FinancialLedger,
      Order,
      Business,
    ]),
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, PayoutsService, WebhooksService],
  exports: [PaymentsService, PayoutsService, WebhooksService, TypeOrmModule],
})
export class PaymentsModule {}
