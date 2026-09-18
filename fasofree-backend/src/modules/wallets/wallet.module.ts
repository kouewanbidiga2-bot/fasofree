import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { Wallet } from './entities/wallet.entity';
import { WalletTransaction } from './entities/wallet-transaction.entity';
import { Order } from '../orders/entities/order.entity';
import { Business } from '../businesses/entities/business.entity';
import { PayoutRequest } from '../financial/entities/payout-request.entity';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { PayoutsService } from './payouts.service';
import { GeniusPayPayoutProvider } from './providers/geniuspay-payout.provider';
import { SettingsModule } from '../settings/settings.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Wallet, WalletTransaction, Order, Business, PayoutRequest]),
    ScheduleModule.forRoot(),
    ConfigModule,
    SettingsModule,
    NotificationsModule,
  ],
  controllers: [WalletController],
  providers: [WalletService, PayoutsService, GeniusPayPayoutProvider],
  exports: [WalletService, PayoutsService, TypeOrmModule],
})
export class WalletModule {}
