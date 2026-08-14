import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { Wallet } from './entities/wallet.entity';
import { WalletTransaction } from './entities/wallet-transaction.entity';
import { Order } from '../orders/entities/order.entity';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { PayoutsService } from './payouts.service';
import { CinetPayPayoutProvider } from './providers/cinetpay-payout.provider';

@Module({
  imports: [
    TypeOrmModule.forFeature([Wallet, WalletTransaction, Order]),
    ScheduleModule.forRoot(),
    ConfigModule,
  ],
  controllers: [WalletController],
  providers: [WalletService, PayoutsService, CinetPayPayoutProvider],
  exports: [WalletService, PayoutsService, TypeOrmModule], // Exporté pour être injecté
})
export class WalletModule {}
