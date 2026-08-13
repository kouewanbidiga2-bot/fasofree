import { Module, Global, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

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

        let client: Redis;

        if (redisUrl) {
          // 🚀 Méthode recommandée pour Upstash : Utilisation de l'URL rediss://
          client = new Redis(redisUrl, {
            connectTimeout: 10000, // 10 secondes de délai de connexion
            maxRetriesPerRequest: 3,
            tls: {
              rejectUnauthorized: false, // Évite les blocages de certificats TLS en dev local
            },
          });
        } else {
          // 🔄 Fallback sur les variables hôte / port / mot de passe
          client = new Redis({
            host,
            port: Number(configService.get<number>('REDIS_PORT')) || 6379,
            password: configService.get<string>('REDIS_PASSWORD'),
            connectTimeout: 10000,
            maxRetriesPerRequest: 3,
            tls: isTls
              ? {
                  servername: host, // 👈 Obligatoire pour le SNI d'Upstash Cloud
                  rejectUnauthorized: false,
                }
              : undefined,
          });
        }

        client.on('connect', () =>
          logger.log('⚡ Connexion Redis établie avec succès'),
        );
        client.on('error', (err) =>
          logger.error('❌ Erreur Redis :', err.message),
        );

        return client;
      },
      inject: [ConfigService],
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
