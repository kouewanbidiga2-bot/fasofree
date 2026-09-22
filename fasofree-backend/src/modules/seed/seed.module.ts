import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Business } from '../businesses/entities/business.entity';
import { Product } from '../products/entities/product.entity';
import { Brand } from '../brands/entities/brand.entity';
import { Wallet } from '../wallets/entities/wallet.entity';
import { WalletTransaction } from '../wallets/entities/wallet-transaction.entity';
import { SeedService } from './seed.service';
import { SeedController } from './seed.controller';
import { ResetSuperAdminCommand } from './reset-super-admin.command';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Business, Product, Brand, Wallet, WalletTransaction]),
  ],
  controllers: [SeedController],
  providers: [SeedService, ResetSuperAdminCommand],
})
export class SeedModule {}
