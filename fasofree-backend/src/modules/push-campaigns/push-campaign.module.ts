import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PushCampaign } from './entities/push-campaign.entity';
import { PushCampaignService } from './push-campaign.service';
import { PushCampaignController } from './push-campaign.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([PushCampaign, User]),
    NotificationsModule,
    UsersModule,
  ],
  controllers: [PushCampaignController],
  providers: [PushCampaignService],
  exports: [PushCampaignService],
})
export class PushCampaignModule {}
