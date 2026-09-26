import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { DisputesService } from './disputes.service';
import { DisputeStatus } from './entities/dispute.entity';
import { User } from '../users/entities/user.entity';
import { resolveJwtSecret } from '../../config/jwt.config';
import { originAllowed } from '../../config/cors.config';

type DisputeSocket = Socket & { data: { user?: JwtPayload } };

export const disputeRoom = (disputeId: string) => `dispute_${disputeId}`;

/** Statut terminal : le litige ne peut plus recevoir de message. */
const isTerminalStatus = (status: DisputeStatus) =>
  status === DisputeStatus.APPROVED ||
  status === DisputeStatus.REJECTED ||
  status === DisputeStatus.CLOSED;

/**
 * 💬 Chat support des litiges (namespace /support).
 *
 * Le client, le support / admin / super admin et le gérant du commerce
 * rejoignent le même salon et échangent en temps réel. L'accès est contrôlé
 * côté serveur (canAccessDispute) : jamais de dépendance au client.
 */
@WebSocketGateway({
  cors: {
    origin: (origin, callback) => {
      if (!origin || originAllowed(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  },
  namespace: '/support',
})
@UsePipes(new ValidationPipe({ transform: true }))
export class DisputesGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(DisputesGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly disputesService: DisputesService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  afterInit(server: Server) {
    this.server = server;
    this.logger.log('[Disputes Gateway] Initialisé (namespace /support)');
  }

  async handleConnection(client: DisputeSocket) {
    try {
      const token =
        client.handshake.headers.authorization?.split(' ')[1] ||
        (client.handshake.query.token as string) ||
        (client.handshake.auth?.token as string);

      if (!token) {
        client.disconnect();
        return;
      }

      const secret = resolveJwtSecret(this.configService);
      const payload = this.jwtService.verify<JwtPayload>(token, { secret });

      // Comptes désactivés / bannis : pas d'accès au chat support.
      // Le rôle est rechargé depuis la base (source de vérité) : un agent
      // rétrogradé perd immédiatement ses droits staff, sans attendre
      // l'expiration du token.
      try {
        const dbUser = await this.userRepository.findOne({
          where: { id: payload.sub },
          select: { id: true, isActive: true, role: true },
        });
        if (!dbUser || !dbUser.isActive) {
          client.disconnect();
          return;
        }
        client.data.user = { sub: dbUser.id, role: dbUser.role };
      } catch (dbErr) {
        this.logger.error(
          `[Disputes Auth] Contrôle isActive impossible (DB) pour ${payload.sub} : ${dbErr instanceof Error ? dbErr.message : String(dbErr)}`,
        );
        client.disconnect();
        return;
      }

      client.data.user = payload;
      this.logger.log(
        `[Disputes Connected] Socket: ${client.id} | User: ${payload?.sub} (${payload?.role})`,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`[Disputes Auth Error] Socket ${client.id} : ${msg}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: DisputeSocket) {
    const userId = client.data?.user?.sub || 'Inconnu';
    this.logger.log(
      `[Disputes Disconnected] Socket: ${client.id} | User: ${userId}`,
    );
  }

  /**
   * Normalise l'échec d'un handler : le process doit SURVIVRE à toute entrée
   * malveillante ou à toute panne DB (un try/catch manquant ferait crasher
   * Nest via le WsProxy → process.exit(1)).
   */
  private fail(client: DisputeSocket, message: string, err?: unknown) {
    this.logger.warn(
      `[Disputes] ${message} (${client.id}) : ${err instanceof Error ? err.message : String(err)}`,
    );
    return { status: 'error', message };
  }

  /**
   * 🚪 Rejoindre le salon d'un litige (avec historique, lecture seule si le
   * litige est clôturé).
   */
  @SubscribeMessage('joinDispute')
  async handleJoinDispute(
    @ConnectedSocket() client: DisputeSocket,
    @MessageBody() payload: { disputeId: string },
  ) {
    try {
      const user = client.data.user;
      if (!user) {
        return { status: 'error', message: 'Utilisateur non authentifié.' };
      }
      if (typeof payload?.disputeId !== 'string') {
        return { status: 'error', message: 'ID de litige requis.' };
      }

      const dispute = await this.disputesService.getForParticipant(
        payload.disputeId,
        user.role,
        user.sub,
      );

      const roomName = disputeRoom(payload.disputeId);
      client.join(roomName);

      const history = await this.disputesService.listMessages(
        payload.disputeId,
        user.role,
        user.sub,
      );

      this.logger.log(
        `[Disputes Room] User ${user.sub} a rejoint le salon ${roomName}`,
      );
      return {
        status: 'ok',
        room: roomName,
        disputeId: payload.disputeId,
        closed: isTerminalStatus(dispute.status),
        history,
      };
    } catch (err) {
      return this.fail(
        client,
        err instanceof Error
          ? err.message
          : 'Impossible de rejoindre le litige.',
        err,
      );
    }
  }

  /**
   * 💬 Envoi et diffusion instantanée d'un message dans le litige.
   * Refusé sur un litige clôturé (APPROVED / REJECTED / CLOSED).
   */
  @SubscribeMessage('sendDisputeMessage')
  async handleSendMessage(
    @ConnectedSocket() client: DisputeSocket,
    @MessageBody()
    payload: { disputeId: string; message: string },
  ) {
    try {
      const user = client.data.user;
      if (!user) {
        return { status: 'error', message: 'Utilisateur non authentifié.' };
      }
      if (
        typeof payload?.disputeId !== 'string' ||
        typeof payload?.message !== 'string'
      ) {
        return { status: 'error', message: 'Payload invalide.' };
      }
      if (payload.message.length > 2000) {
        return {
          status: 'error',
          message: 'Message trop long (2000 caractères max).',
        };
      }

      const dispute = await this.disputesService.getForParticipant(
        payload.disputeId,
        user.role,
        user.sub,
      );
      if (isTerminalStatus(dispute.status)) {
        return {
          status: 'closed',
          message: 'Ce litige est clôturé, aucun nouveau message.',
        };
      }

      const saved = await this.disputesService.addMessage(
        payload.disputeId,
        user.role,
        user.sub,
        payload.message,
      );

      const packet = {
        id: saved.id,
        disputeId: saved.disputeId,
        senderId: saved.senderId,
        senderRole: saved.senderRole,
        senderName: saved.senderName,
        message: saved.message,
        createdAt: saved.createdAt,
      };

      const roomName = disputeRoom(payload.disputeId);
      this.server.to(roomName).emit('newDisputeMessage', packet);

      return { status: 'sent', data: packet };
    } catch (err) {
      return this.fail(
        client,
        err instanceof Error ? err.message : 'Message non envoyé.',
        err,
      );
    }
  }

  /**
   * 🧹 Sortie du salon.
   */
  @SubscribeMessage('leaveDispute')
  handleLeaveDispute(
    @ConnectedSocket() client: DisputeSocket,
    @MessageBody() payload: { disputeId: string },
  ) {
    if (!payload?.disputeId) return;
    const roomName = disputeRoom(payload.disputeId);
    client.leave(roomName);
    return { status: 'ok', room: roomName };
  }
}
