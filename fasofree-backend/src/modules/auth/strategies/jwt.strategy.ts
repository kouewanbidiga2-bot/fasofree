import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes, createHash } from 'crypto';
import { User } from '../../users/entities/user.entity';

export interface JwtPayload {
  sub: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private static resolveSecret(configService: ConfigService): string {
    let secret = configService.get<string>('JWT_SECRET');
    if (secret && secret.length >= 32) return secret;

    const isProd = configService.get<string>('NODE_ENV') === 'production';
    const logger = new Logger('JwtStrategy');

    if (isProd) {
      const dbUrl = configService.get<string>('DATABASE_URL') || '';
      secret = createHash('sha256')
        .update(dbUrl + 'fasofree-jwt-fallback-2024')
        .digest('hex');
      logger.warn('⚠️  JWT_SECRET non défini — secret dérivé de DATABASE_URL (JwtStrategy)');
    } else {
      secret = randomBytes(48).toString('hex');
      logger.warn('⚠️ JWT_SECRET absent — clé temporaire dev (JwtStrategy)');
    }
    return secret;
  }

  constructor(
    configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
    const secret = JwtStrategy.resolveSecret(configService);
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

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

    return { userId: user.id, role: user.role };
  }
}
