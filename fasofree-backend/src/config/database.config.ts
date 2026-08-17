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
  const isProd = configService.get<string>('NODE_ENV') === 'production';

  // synchronize et migrationsRun sont mutuellement exclusifs :
  // synchronize=true → migrationsRun=false (TypeORM gère le schema)
  // synchronize=false → migrationsRun=true en prod (les migrations gèrent le schema)
  const synchronize = syncOverride ?? !isProd;
  const migrationsRun = synchronize ? false : (migrationsOverride ?? isProd);

  return {
    type: 'postgres',
    url: configService.get<string>('DATABASE_URL'),
    autoLoadEntities: true,
    synchronize,
    migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
    migrationsRun,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : true,
    logging: configService.get<string>('NODE_ENV') === 'development',
    extra: {
      max: 20,
      connectionTimeoutMillis: 5000,
    },
  };
};
