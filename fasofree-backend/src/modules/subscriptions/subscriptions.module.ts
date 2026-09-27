import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Subscription } from './entities/subscription.entity';
import { SubscriptionPlanEntity } from './entities/subscription-plan.entity';
import { SubscriptionService } from './subscription.service';
import { SubscriptionsController } from './subscriptions.controller';
import { WalletModule } from '../wallets/wallet.module';
import { User } from '../users/entities/user.entity';
import { Business } from '../businesses/entities/business.entity';
// Brand requis : SubscriptionService injecte @InjectRepository(Brand) (Pass
// Stories / stats marchand). Sans Brand dans forFeature, le boot échoue en
// UnknownDependenciesException ("BrandRepository at index [4]").
import { Brand } from '../brands/entities/brand.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Subscription,
      SubscriptionPlanEntity,
      User,
      Business,
      Brand,
    ]),
    WalletModule,
  ],
  controllers: [SubscriptionsController],
  providers: [SubscriptionService],
  exports: [SubscriptionService],
})
export class SubscriptionsModule {}
