import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

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
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [
    forwardRef(() => OrdersModule),
    TypeOrmModule.forFeature([
      MerchantPayout,
      Transaction,
      FinancialLedger,
      Order,
      Business,
    ]),
  ],
  controllers: [PaymentsController, GeniusPayController],
  providers: [PaymentsService, PayoutsService, WebhooksService, GeniusPayService],
  exports: [PaymentsService, PayoutsService, WebhooksService, GeniusPayService, TypeOrmModule],
})
export class PaymentsModule {}
