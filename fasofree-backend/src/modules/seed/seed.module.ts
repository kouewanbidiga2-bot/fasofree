import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommandModule } from 'nestjs-command';

import { getDatabaseConfig } from '../../config/database.config';
import { UsersModule } from '../users/users.module';
import { User } from '../users/entities/user.entity';
import { WalletModule } from '../wallets/wallet.module';
import { Wallet } from '../wallets/entities/wallet.entity';
import { BusinessesModule } from '../businesses/businesses.module';
import { Business } from '../businesses/entities/business.entity';
import { BrandsModule } from '../brands/brands.module';
import { Brand } from '../brands/entities/brand.entity';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { Product } from '../products/entities/product.entity';
import { Order } from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { Transaction } from '../payments/entities/transaction.entity';
import { SeedCommand } from './seed.command';

/**
 * Module isolé pour la CLI de seeding (npm run command seed:test-data).
 * Ne boot pas le serveur HTTP ni Redis/Firebase : uniquement la base de données.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: getDatabaseConfig,
    }),
    TypeOrmModule.forFeature([
      User,
      Business,
      Brand,
      Subscription,
      Product,
      Wallet,
      Order,
      OrderItem,
      Transaction,
    ]),
    CommandModule,
    UsersModule,
    WalletModule,
    BusinessesModule,
    BrandsModule,
    SubscriptionsModule,
  ],
  providers: [SeedCommand],
})
export class SeedModule {}
