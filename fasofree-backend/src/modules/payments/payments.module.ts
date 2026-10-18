import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PaymentsService } from './payments.service';
import { PayoutsService } from './payouts.service';
import { WebhooksService } from './webhooks.service';
import { PaymentsController } from './payments.controller';
import { GeniusPayService } from './providers/geniuspay.service';
import { GeniusPayController } from './geniuspay.controller';
import { PaydunyaModule } from './providers/paydunya.module';

import { MerchantPayout } from './entities/merchant-payout.entity';
import { Transaction } from './entities/transaction.entity';
import { FinancialLedger } from './entities/financial-ledger.entity';
import { Order } from '../orders/entities/order.entity';
import { Business } from '../businesses/entities/business.entity';
import { OrdersModule } from '../orders/orders.module';
import { WalletModule } from '../wallets/wallet.module';
import { RedisModule } from '../../core/redis/redis.module';

@Module({
  imports: [
    RedisModule,
    forwardRef(() => OrdersModule),
    // 💳 Nécessaire au crédit des RECHARGES (top-up) depuis le webhook GeniusPay :
    // une recharge ne crée pas de commande, c'est WalletService.creditWallet qui
    // applique le crédit (idempotent par référence).
    WalletModule,
    // 💳 PayDunya (Payin + Payout PER) — Lot 4
    PaydunyaModule,
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
  exports: [PaymentsService, PayoutsService, WebhooksService, GeniusPayService, TypeOrmModule, PaydunyaModule],
})
export class PaymentsModule {}
