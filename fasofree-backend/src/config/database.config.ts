// Ces deux lignes sont obligatoires tout en haut !
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

// Surcharge déployable : si la variable est définie on l'utilise, sinon on
// garde le comportement historique (synchronize en dev, migrations en prod).
const envBool = (configService: ConfigService, key: string) => {
  const raw = configService.get<string>(key);
  return raw === undefined ? undefined : raw === 'true';
};

export const getDatabaseConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => {
  const syncOverride = envBool(configService, 'DB_SYNCHRONIZE');
  const migrationsOverride = envBool(configService, 'DB_MIGRATIONS_RUN');
  return {
    type: 'postgres',
    url: configService.get<string>('DATABASE_URL'),
    autoLoadEntities: true,
    synchronize:
      syncOverride ?? configService.get<string>('NODE_ENV') !== 'production',
    migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
    migrationsRun:
      migrationsOverride ?? configService.get<string>('NODE_ENV') === 'production',
    ssl: true,
    logging: configService.get<string>('NODE_ENV') === 'development',
    extra: {
      max: 20, // Nombre maximum de connexions simultanées dans le pool
      connectionTimeoutMillis: 5000,
    },
  };
};
