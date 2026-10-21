/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PushCampaign } from './entities/push-campaign.entity';
import { PushCampaignService } from './push-campaign.service';
import { PushCampaignController } from './push-campaign.controller';
import {
  AgencyPushCampaignController,
  MerchantPushCampaignController,
} from './push-campaign-self-service.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { User } from '../users/entities/user.entity';
import { Business } from '../businesses/entities/business.entity';
import { DeliveryAgency } from '../dispatch/entities/delivery-agency.entity';
import { WalletModule } from '../wallets/wallet.module';

/**
 * 📣 Campagnes push.
 *
 * Contrôleurs :
 *  - `admin/push-campaigns`    (SUPER_ADMIN / ADMIN) — historique, gratuit ;
 *  - `merchant/push-campaigns` (BUSINESS_ADMIN)      — auto-service payant ;
 *  - `agency/push-campaigns`   (AGENCY)              — auto-service payant.
 *
 * `WalletModule` est importé pour débiter le compte payeur (Lot 3) ;
 * `Business` et `DeliveryAgency` servent à résoudre les audiences anti-spam
 * (clients d'un marchand, livreurs d'une agence).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([PushCampaign, User, Business, DeliveryAgency]),
    ConfigModule,
    NotificationsModule,
    UsersModule,
    WalletModule,
  ],
  controllers: [
    PushCampaignController,
    MerchantPushCampaignController,
    AgencyPushCampaignController,
  ],
  providers: [PushCampaignService],
  exports: [PushCampaignService],
})
export class PushCampaignModule {}
