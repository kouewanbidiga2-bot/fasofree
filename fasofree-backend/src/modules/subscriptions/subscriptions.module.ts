import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Subscription } from './entities/subscription.entity';
import { SubscriptionPlanEntity } from './entities/subscription-plan.entity';
import { SubscriptionService } from './subscription.service';
import { SubscriptionsController } from './subscriptions.controller';
import { WalletModule } from '../wallets/wallet.module';
import { User } from '../users/entities/user.entity';
import { Business } from '../businesses/entities/business.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Subscription,
      SubscriptionPlanEntity,
      User,
      Business,
    ]),
    WalletModule,
  ],
  controllers: [SubscriptionsController],
  providers: [SubscriptionService],
  exports: [SubscriptionService],
})
export class SubscriptionsModule {}
