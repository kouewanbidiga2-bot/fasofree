import { Module, Global, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

function createNoopRedis(logger: Logger): Redis {
  logger.warn('⚠️  Aucune variable REDIS/REDIS_HOST definie — Redis desactive (fonctionnement sans cache)');
  const noop = async () => null;
  const noopPipeline = () => ({
    set: noop, get: noop, del: noop, expire: noop, ttl: noop,
    lrange: async () => [], rpush: noop, lpush: noop, ltrim: noop,
    geosearch: async () => [], geoadd: noop, zadd: noop, zrem: noop,
    zrange: async () => [], smembers: async () => [], sadd: noop,
    hset: noop, hget: async () => null, hgetall: async () => ({}),
    exec: async () => [],
  });
  return { set: noop, get: noop, del: noop, expire: noop, ttl: noop,
    pipeline: noopPipeline, disconnect: noop, quit: noop,
    on: () => ({} as any),
  } as unknown as Redis;
}

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (configService: ConfigService) => {
        const logger = new Logger('RedisModule');
        const redisUrl = configService.get<string>('REDIS_URL');
        const host = configService.get<string>('REDIS_HOST');
        const isTls = configService.get<string>('REDIS_TLS') === 'true';

        if (!redisUrl && !host) {
          return createNoopRedis(logger);
        }

        try {
          let client: Redis;

          if (redisUrl) {
            client = new Redis(redisUrl, {
              connectTimeout: 5000,
              maxRetriesPerRequest: 0,
              enableOfflineQueue: false,
              retryStrategy: () => null,
              tls: { rejectUnauthorized: false },
            });
          } else {
            client = new Redis({
              host,
              port: Number(configService.get<number>('REDIS_PORT')) || 6379,
              password: configService.get<string>('REDIS_PASSWORD'),
              connectTimeout: 5000,
              maxRetriesPerRequest: 0,
              enableOfflineQueue: false,
              retryStrategy: () => null,
              tls: isTls
                ? { servername: host, rejectUnauthorized: false }
                : undefined,
            });
          }

          client.on('connect', () =>
            logger.log('⚡ Connexion Redis etablie avec succes'),
          );
          client.on('error', (err) => {
            logger.warn(`Redis indisponible (${(err as any).code || err.message}) — fallback noop`);
            try { client.disconnect(); } catch {}
          });

          return client;
        } catch (err) {
          logger.warn(`Redis impossible a creer — fallback noop: ${err.message}`);
          return createNoopRedis(logger);
        }
      },
      inject: [ConfigService],
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
