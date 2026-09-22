import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule, JwtModuleOptions, JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { User } from '../users/entities/user.entity';
import { Brand } from '../brands/entities/brand.entity';
import { Business } from '../businesses/entities/business.entity';
import { JwtStrategy } from './strategies/jwt.strategy';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { KycModule } from '../kyc/kyc.module';
import { UsersModule } from '../users/users.module';
import { OtpModule } from '../otp/otp.module';
import { VerifiedGuard } from './guards/verified.guard';
import { resolveJwtSecret } from '../../config/jwt.config';

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
    // 1. Accès aux tables User, Brand, Business
    TypeOrmModule.forFeature([User, Brand, Business]),

    // 2. Configuration de Passport JWT
    PassportModule.register({ defaultStrategy: 'jwt' }),

    // 3. Configuration Asynchrone JWT typée explicitement
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService): JwtModuleOptions => {
        const secret = resolveJwtSecret(configService);

        const expiresIn = normalizeExpiresIn(
          configService.get<string>('JWT_EXPIRES_IN'),
        );

        return {
          secret,
          ...(expiresIn !== undefined ? { signOptions: { expiresIn } } : {}),
        };
      },
    }),
    SubscriptionsModule,
    KycModule,
    UsersModule,
    OtpModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, VerifiedGuard],
  exports: [AuthService, JwtModule, PassportModule, VerifiedGuard],
})
export class AuthModule {}
