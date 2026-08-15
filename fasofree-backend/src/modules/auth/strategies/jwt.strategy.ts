import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';

export interface JwtPayload {
  sub: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    let secret = configService.get<string>('JWT_SECRET');
    if (!secret || secret.length < 32) {
      if (configService.get<string>('NODE_ENV') === 'production') {
        throw new Error(
          'JWT_SECRET doit être défini et contenir au moins 32 caractères',
        );
      }

      const fallback = randomBytes(48).toString('hex');

      console.warn(
        `⚠️ JWT_SECRET absent ou trop court — génération d'une clé temporaire pour le dev`,
      );
      secret = fallback;
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  // 🛡️ Exécuté automatiquement après validation mathématique du token
  validate(payload: JwtPayload) {
    if (!payload.sub) {
      throw new UnauthorizedException("Jeton d'accès invalide");
    }
    // L'objet retourné est directement injecté dans req.user
    return { userId: payload.sub, role: payload.role };
  }
}
