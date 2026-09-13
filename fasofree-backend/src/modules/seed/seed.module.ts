import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Business } from '../businesses/entities/business.entity';
import { Product } from '../products/entities/product.entity';
import { Brand } from '../brands/entities/brand.entity';
import { Wallet } from '../wallets/entities/wallet.entity';
import { SeedService } from './seed.service';
import { SeedController } from './seed.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User, Business, Product, Brand, Wallet])],
  controllers: [SeedController],
  providers: [SeedService],
})
export class SeedModule {}
