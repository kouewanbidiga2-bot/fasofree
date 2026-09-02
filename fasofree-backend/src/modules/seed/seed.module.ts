import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Business } from '../businesses/entities/business.entity';
import { Product } from '../products/entities/product.entity';
import { SeedService } from './seed.service';
import { SeedCommand } from './seed.command';
import { SeedController } from './seed.controller';
import { BrandsModule } from '../brands/brands.module';
import { WalletModule } from '../wallets/wallet.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Business, Product]),
    BrandsModule,
    WalletModule,
    SubscriptionsModule,
  ],
  providers: [SeedService, SeedCommand],
  controllers: [SeedController],
  exports: [SeedCommand],
})
export class SeedModule {}
