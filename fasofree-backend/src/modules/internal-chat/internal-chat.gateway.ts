import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import {
  InternalChatService,
  InternalChannel,
} from './internal-chat.service';

type InternalSocket = Socket & { data: { user?: JwtPayload } };

const DM_PREFIX = 'dm:';
const isDmChannel = (ch: string) => ch.startsWith(DM_PREFIX);
const dmRoom = (u1: string, u2: string) => {
  const sorted = [u1, u2].sort();
  return `dm_${sorted[0]}_${sorted[1]}`;
};

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/internal-chat',
})
@UsePipes(new ValidationPipe({ transform: true }))
export class InternalChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(InternalChatGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly internalChatService: InternalChatService,
  ) {}

  afterInit() {
    this.logger.log('[InternalChat Gateway] Initialisé (namespace /internal-chat)');
  }

  handleConnection(client: InternalSocket) {
    try {
      const token =
        client.handshake.headers.authorization?.split(' ')[1] ||
        (client.handshake.query.token as string) ||
        (client.handshake.auth?.token as string);

      if (!token) {
        this.logger.warn(`[InternalChat Auth] Rejeté (token absent): ${client.id}`);
        client.disconnect();
        return;
      }

      const secret = this.configService.get<string>('JWT_SECRET', 'SUPER_SECRET_KEY_CHANGEME');
      const payload = this.jwtService.verify<JwtPayload>(token, { secret });

      this.internalChatService.assertTeamAccess(payload.role);
      client.data.user = payload;
      this.logger.log(
        `[InternalChat Connected] Socket: ${client.id} | User: ${payload.sub} (${payload.role})`,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`[InternalChat Auth Error] Socket ${client.id}: ${msg}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: InternalSocket) {
    this.logger.log(`[InternalChat Disconnected] ${client.id}`);
  }

  /**
   * 🚪 Rejoindre un canal général
   */
  @SubscribeMessage('joinChannel')
  async handleJoinChannel(
    @ConnectedSocket() client: InternalSocket,
    @MessageBody() payload: { channel: string },
  ) {
    const user = client.data.user;
    if (!user) return { status: 'error', message: 'Non authentifié' };

    const channel = payload?.channel;
    if (!channel || isDmChannel(channel)) {
      return { status: 'error', message: 'Canal invalide' };
    }

    const roomName = `internal_${channel}`;
    client.join(roomName);

    const history = await this.internalChatService.getHistory(
      channel as InternalChannel,
    );

    this.logger.log(`[InternalChat] ${user.sub} a rejoint ${roomName}`);
    return { status: 'ok', room: roomName, channel, history };
  }

  /**
   * 💬 Envoyer un message dans un canal général
   */
  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: InternalSocket,
    @MessageBody() payload: { channel: string; message: string },
  ) {
    const user = client.data.user;
    if (!user) return { status: 'error', message: 'Non authentifié' };

    const { channel, message } = payload || {};
    if (!channel || !message?.trim() || isDmChannel(channel)) {
      return { status: 'error', message: 'Payload invalide' };
    }

    const saved = await this.internalChatService.saveMessage(
      channel as InternalChannel,
      user.sub,
      message.trim(),
    );

    const packet = {
      id: saved.id,
      channel,
      senderId: user.sub,
      senderRole: user.role,
      message: message.trim(),
      timestamp: saved.createdAt.toISOString(),
    };

    const roomName = `internal_${channel}`;
    this.server.to(roomName).emit('newMessage', packet);

    return { status: 'sent', data: packet };
  }

  /**
   * 📩 Rejoindre un DM (message direct)
   */
  @SubscribeMessage('joinDm')
  async handleJoinDm(
    @ConnectedSocket() client: InternalSocket,
    @MessageBody() payload: { recipientId: string },
  ) {
    const user = client.data.user;
    if (!user) return { status: 'error', message: 'Non authentifié' };

    const { recipientId } = payload || {};
    if (!recipientId || recipientId === user.sub) {
      return { status: 'error', message: 'Destinataire invalide' };
    }

    const roomName = dmRoom(user.sub, recipientId);
    client.join(roomName);

    const history = await this.internalChatService.getDms(user.sub, recipientId);

    this.logger.log(`[InternalChat DM] ${user.sub} → ${recipientId}`);
    return { status: 'ok', room: roomName, history };
  }

  /**
   * 📩 Envoyer un DM
   */
  @SubscribeMessage('sendDm')
  async handleSendDm(
    @ConnectedSocket() client: InternalSocket,
    @MessageBody() payload: { recipientId: string; message: string },
  ) {
    const user = client.data.user;
    if (!user) return { status: 'error', message: 'Non authentifié' };

    const { recipientId, message } = payload || {};
    if (!recipientId || !message?.trim() || recipientId === user.sub) {
      return { status: 'error', message: 'Payload invalide' };
    }

    const saved = await this.internalChatService.saveMessage(
      'dm' as InternalChannel,
      user.sub,
      message.trim(),
      recipientId,
    );

    const packet = {
      id: saved.id,
      channel: 'dm',
      senderId: user.sub,
      senderRole: user.role,
      recipientId,
      message: message.trim(),
      timestamp: saved.createdAt.toISOString(),
    };

    const roomName = dmRoom(user.sub, recipientId);
    this.server.to(roomName).emit('newMessage', packet);

    return { status: 'sent', data: packet };
  }

  /**
   * 🧹 Quitter un salon
   */
  @SubscribeMessage('leaveChannel')
  handleLeave(
    @ConnectedSocket() client: InternalSocket,
    @MessageBody() payload: { channel: string },
  ) {
    if (!payload?.channel) return;
    const roomName = isDmChannel(payload.channel)
      ? dmRoom(client.data.user?.sub || '', payload.channel.slice(3))
      : `internal_${payload.channel}`;
    client.leave(roomName);
    return { status: 'ok' };
  }
}
