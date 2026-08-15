import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { JwtPayload } from '../../auth/strategies/jwt.strategy';

interface AuthUser {
  userId: string;
  role: string;
}

@Injectable()
export class WsJwtGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtGuard.name);

  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const client: Socket = context.switchToWs().getClient();

    const authHeader = client.handshake.headers.authorization;
    const queryToken =
      client.handshake.query &&
      (client.handshake.query.token as string | undefined);
    const token = authHeader?.split(' ')[1] || queryToken;

    if (!token) {
      this.logger.error(
        `Accès WS refusé : aucun token fourni pour la socket ${client.id}`,
      );
      return false;
    }

    try {
      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET,
      });

      // On attache l'utilisateur authentifié (format identique à JwtStrategy.validate)
      const user: AuthUser = { userId: payload.sub, role: payload.role };
      client.data.user = user;
      return true;
    } catch (err) {
      this.logger.error(
        `Accès WS refusé : token invalide sur la socket ${client.id}`,
      );
      return false;
    }
  }
}
