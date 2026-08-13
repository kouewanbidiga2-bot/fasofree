// Ces deux lignes sont obligatoires tout en haut !
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

export const getDatabaseConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => ({
  type: 'postgres',
  url: configService.get<string>('DATABASE_URL'),
  autoLoadEntities: true,
  synchronize: configService.get<string>('NODE_ENV') !== 'production',
  migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
  migrationsRun: configService.get<string>('NODE_ENV') === 'production',
  ssl: true,
  logging: configService.get<string>('NODE_ENV') === 'development',
  extra: {
    max: 20, // Nombre maximum de connexions simultanées dans le pool
    connectionTimeoutMillis: 5000,
  },
});
