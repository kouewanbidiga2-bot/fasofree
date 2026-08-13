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

        // En production, exiger une vraie clé d'au moins 32 caractères.
        if (!secret || secret.length < 32) {
          if (configService.get<string>('NODE_ENV') === 'production') {
            throw new Error(
              'JWT_SECRET doit être défini et contenir au moins 32 caractères',
            );
          }

          // En développement/local, générer une clé robuste pour éviter l'arrêt du serveur.
          // Ne PAS committer cette clé — c'est uniquement pour faciliter le dev local.
          const fallback = randomBytes(48).toString('hex');

          console.warn(
            `⚠️ JWT_SECRET non défini ou trop court — génération d'une clé temporaire pour l'environnement local`,
          );
          secret = fallback;
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
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtModule, PassportModule],
})
export class AuthModule {}
