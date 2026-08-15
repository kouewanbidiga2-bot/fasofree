import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { LigdiCashService } from './providers/ligdicash.service';
import { LigdiCashController } from './ligdicash.controller';
import { OrdersModule } from '../orders/orders.module';
import { WalletModule } from '../wallets/wallet.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../orders/entities/order.entity';

@Module({
  imports: [
    ConfigModule,
    HttpModule,
    TypeOrmModule.forFeature([Order]),
    forwardRef(() => OrdersModule), // Protects against circular imports with Orders
    WalletModule,
  ],
  controllers: [LigdiCashController],
  providers: [LigdiCashService],
  exports: [LigdiCashService],
})
export class LigdiCashModule {}
