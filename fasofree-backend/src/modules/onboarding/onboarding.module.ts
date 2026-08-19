import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { BusinessesModule } from '../businesses/businesses.module';
import { WalletModule } from '../wallets/wallet.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { KycModule } from '../kyc/kyc.module';
import { OnboardingService } from './onboarding.service';
import { OnboardingController } from './onboarding.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    BusinessesModule,
    WalletModule,
    NotificationsModule,
    KycModule,
  ],
  controllers: [OnboardingController],
  providers: [OnboardingService],
  exports: [OnboardingService],
})
export class OnboardingModule {}
