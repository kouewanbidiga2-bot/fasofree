import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { LigdiCashService } from './providers/ligdicash.service';
import { MockPaymentService } from './providers/mock-payment.service';
import { LigdiCashController } from './ligdicash.controller';
import { OrdersModule } from '../orders/orders.module';
import { WalletModule } from '../wallets/wallet.module';
import { ReceiptsModule } from '../receipts/receipts.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../orders/entities/order.entity';

@Module({
  imports: [
    ConfigModule,
    HttpModule,
    TypeOrmModule.forFeature([Order]),
    forwardRef(() => OrdersModule), // Protects against circular imports with Orders
    WalletModule,
    ReceiptsModule,
  ],
  controllers: [LigdiCashController],
  providers: [LigdiCashService, MockPaymentService],
  exports: [LigdiCashService, MockPaymentService],
})
export class LigdiCashModule {}
