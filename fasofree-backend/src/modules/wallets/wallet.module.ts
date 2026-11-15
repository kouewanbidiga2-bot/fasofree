/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Wallet } from './entities/wallet.entity';
import { WalletTransaction } from './entities/wallet-transaction.entity';
import { Order } from '../orders/entities/order.entity';
import { Business } from '../businesses/entities/business.entity';
import { PayoutRequest } from '../financial/entities/payout-request.entity';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { PayoutsService } from './payouts.service';
import { SasPayPayoutProvider } from './providers/saspay-payout.provider';
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
  controllers: [WalletController],
  providers: [WalletService, PayoutsService, SasPayPayoutProvider],
  exports: [WalletService, PayoutsService, SasPayPayoutProvider, TypeOrmModule],
})
export class WalletModule {}
