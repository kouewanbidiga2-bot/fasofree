import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import { getDatabaseConfig } from './config/database.config';
import { RedisModule } from './core/redis/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { BusinessesModule } from './modules/businesses/businesses.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ProductsModule } from './modules/products/products.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { DispatchModule } from './modules/dispatch/dispatch.module';
import { HealthModule } from './modules/health/health.module'; // 👈 Import
import { FinancialModule } from './modules/financial/financial.module';
import { WalletModule } from './modules/wallets/wallet.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { ChatModule } from './modules/chat/chat.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { TrackingModule } from './modules/tracking/tracking.module';
import { UploadModule } from './modules/upload/upload.module';
import { AppController } from './app.controller';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DisputesModule } from './modules/disputes/disputes.module';
import { KycModule } from './modules/kyc/kyc.module';
import { PromotionsModule } from './modules/promotions/promotions.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { BrandsModule } from './modules/brands/brands.module';
import { ReceiptsModule } from './modules/receipts/receipts.module';
import { CommandModule } from 'nestjs-command'; // 👈 1. Importer ceci

@Module({
  imports: [
    // ⚙️ Configuration Globale
    ConfigModule.forRoot({
      isGlobal: true,
      // Load .env.local first for local developer overrides (kept out of VCS), then fallback to .env
      envFilePath: ['.env.local', '.env'],
    }),

    // 🗄️ Base de données relationnelle (PostgreSQL / Neon)
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: getDatabaseConfig,
    }),

    // ⚡ Cache & Pub/Sub (Redis / Upstash)
    RedisModule,
    EventEmitterModule.forRoot(),

    // 🛡️ Protection Anti-Spam / Rate Limiting (100 requêtes / minute par IP)
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // Fenêtre de 60 secondes (en millisecondes)
        limit: 100, // Limite de 100 requêtes
      },
    ]),

    // 📦 Modules Métier (Domaines Fonctionnels)
    UsersModule,
    AuthModule,
    BusinessesModule,
    ProductsModule,
    OrdersModule,
    PaymentsModule,
    DispatchModule,
    AnalyticsModule,
    HealthModule, // 👈 Ajout du module Health
    FinancialModule, // 👈 Ajout du module Financial
    WalletModule, // 👈 Ajout du module Wallet
    ReviewsModule, // 👈 Ajout du module Reviews (Notation & Pourboires)
    ChatModule,
    NotificationsModule,
    TrackingModule,
    UploadModule,
    DisputesModule,
    KycModule,
    PromotionsModule,
    SubscriptionsModule,
    BrandsModule,
    ReceiptsModule,
    CommandModule, // 👈 2. Ajouter le module Command
  ],
  controllers: [AppController],
  providers: [
    // 🛡️ Activation globale du Throttler Guard sur toutes les routes de l'API
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
