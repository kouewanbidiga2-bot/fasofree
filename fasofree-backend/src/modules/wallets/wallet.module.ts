import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Wallet } from './entities/wallet.entity';
import { WalletTransaction } from './entities/wallet-transaction.entity';
import { Order } from '../orders/entities/order.entity';
import { Business } from '../businesses/entities/business.entity';
import { PayoutRequest } from '../financial/entities/payout-request.entity';
import { WalletService } from './wallet.service';
import { WalletController, WalletWebhookController } from './wallet.controller';
import { PayoutsService } from './payouts.service';
import { GeniusPayPayoutProvider } from './providers/geniuspay-payout.provider';
import { SettingsModule } from '../settings/settings.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BusinessesModule } from '../businesses/businesses.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Wallet, WalletTransaction, Order, Business, PayoutRequest]),
    ConfigModule,
    SettingsModule,
    NotificationsModule,
    BusinessesModule,
  ],
  controllers: [WalletController, WalletWebhookController],
  providers: [WalletService, PayoutsService, GeniusPayPayoutProvider],
  exports: [WalletService, PayoutsService, TypeOrmModule],
})
export class WalletModule {}
