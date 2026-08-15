import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { WalletModule } from '../wallets/wallet.module';
import { Promotion } from './entities/promotion.entity';
import { Referral } from './entities/referral.entity';
import { PromotionsController } from './promotions.controller';
import { PromotionsService } from './promotions.service';
@Module({
  imports: [
    TypeOrmModule.forFeature([Promotion, Referral, User]),
    WalletModule,
  ],
  controllers: [PromotionsController],
  providers: [PromotionsService],
  exports: [PromotionsService],
})
export class PromotionsModule {}
