import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule, JwtModuleOptions, JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { User } from '../users/entities/user.entity';
import { JwtStrategy } from './strategies/jwt.strategy';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { KycModule } from '../kyc/kyc.module';
import { UsersModule } from '../users/users.module';

function normalizeExpiresIn(
  raw?: string,
): JwtSignOptions['expiresIn'] | undefined {
  if (!raw) {
    return undefined;
  }

  if (/^\d+$/.test(raw)) {
    return Number(raw);
  }

  if (/^\d+(ms|s|m|h|d|w)$/.test(raw)) {
    return raw as JwtSignOptions['expiresIn'];
  }

  return '7d';
}

@Module({
  imports: [
    // 1. Accès à la table User
    TypeOrmModule.forFeature([User]),

    // 2. Configuration de Passport JWT
    PassportModule.register({ defaultStrategy: 'jwt' }),

    // 3. Configuration Asynchrone JWT typée explicitement
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService): JwtModuleOptions => {
        let secret = configService.get<string>('JWT_SECRET');
        const isProd = configService.get<string>('NODE_ENV') === 'production';

        if (!secret || secret.length < 32) {
          if (isProd) {
            // En prod, générer un secret stable à partir du DATABASE_URL pour ne pas crasher
            const dbUrl = configService.get<string>('DATABASE_URL') || '';
            const fallback = require('crypto')
              .createHash('sha256')
              .update(dbUrl + 'fasofree-jwt-fallback-2024')
              .digest('hex');
            secret = fallback;
            console.warn(
              '⚠️  JWT_SECRET non défini — secret dérivé généré. Définissez JWT_SECRET pour la production.',
            );
          } else {
            secret = randomBytes(48).toString('hex');
            console.warn(
              '⚠️ JWT_SECRET non défini — clé temporaire pour dev local',
            );
          }
        }

        const expiresIn = normalizeExpiresIn(
          configService.get<string>('JWT_EXPIRES_IN'),
        );

        return {
          secret,
          signOptions: { expiresIn },
        };
      },
    }),
    SubscriptionsModule,
    KycModule,
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtModule, PassportModule],
})
export class AuthModule {}
