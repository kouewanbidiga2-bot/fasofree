import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { User } from '../../users/entities/user.entity';

export interface JwtPayload {
  sub: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
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

  // 🛡️ Exécuté automatiquement après validation mathématique du token.
  // Re-vérifie l'utilisateur en base : un compte banni ou désactivé est
  // immédiatement rejeté, même si son token n'a pas encore expiré.
  async validate(payload: JwtPayload) {
    if (!payload.sub) {
      throw new UnauthorizedException("Jeton d'accès invalide");
    }

    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
    });
    if (!user) {
      throw new UnauthorizedException('Compte introuvable');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Ce compte est désactivé');
    }

    // Le rôle renvoyé provient de la base (pas du token) : un changement de
    // rôle effectué par un SUPER_ADMIN est pris en compte immédiatement.
    return { userId: user.id, role: user.role };
  }
}
