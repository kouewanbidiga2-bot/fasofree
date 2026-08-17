import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';

import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';

// Entités
import { Order } from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { Product } from '../products/entities/product.entity';
import { Transaction } from '../payments/entities/transaction.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, Product, Transaction]),

    // Cache: Redis si configuré, sinon in-memory (par défaut)
    ...(process.env.REDIS_URL || process.env.REDIS_HOST
      ? [
          CacheModule.registerAsync({
            useFactory: async () => {
              try {
                const redisUrl =
                  process.env.REDIS_URL ||
                  (process.env.REDIS_PASSWORD
                    ? `rediss://default:${process.env.REDIS_PASSWORD}@${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`
                    : undefined);

                const store = await redisStore(
                  redisUrl
                    ? { url: redisUrl }
                    : {
                        socket: {
                          host: process.env.REDIS_HOST || 'localhost',
                          port: parseInt(process.env.REDIS_PORT || '6379', 10),
                        },
                      },
                );
                return { store };
              } catch {
                return {};
              }
            },
          }),
        ]
      : []),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
