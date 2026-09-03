import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';

import { PaymentsService } from './payments.service';
import { PayoutsService } from './payouts.service';
import { WebhooksService } from './webhooks.service';
import { PaymentsController } from './payments.controller';
import { GeniusPayService } from './providers/geniuspay.service';
import { GeniusPayController } from './geniuspay.controller';

import { MerchantPayout } from './entities/merchant-payout.entity';
import { Transaction } from './entities/transaction.entity';
import { FinancialLedger } from './entities/financial-ledger.entity';
import { Order } from '../orders/entities/order.entity';
import { Business } from '../businesses/entities/business.entity';
import { RedisModule } from '../../core/redis/redis.module';
import { OrdersModule } from '../orders/orders.module';
import { LigdiCashModule } from './ligdicash.module';
import { YengaPayService } from './providers/yengapay.service';
import { PayDunyaService } from './providers/paydunya.service';

@Module({
  imports: [
    RedisModule,
    HttpModule,
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
  controllers: [PaymentsController, GeniusPayController],
  providers: [PaymentsService, PayoutsService, WebhooksService, YengaPayService, PayDunyaService, GeniusPayService],
  exports: [PaymentsService, PayoutsService, WebhooksService, YengaPayService, PayDunyaService, GeniusPayService, TypeOrmModule],
})
export class PaymentsModule {}
