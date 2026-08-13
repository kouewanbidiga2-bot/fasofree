import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';

type ChatSocket = Socket & { data: { user?: JwtPayload } };

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/chat',
})
@UsePipes(new ValidationPipe({ transform: true }))
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 🔒 1. Authentification Zero-Trust du WebSocket Chat
   */
  handleConnection(client: ChatSocket) {
    try {
      const token =
        client.handshake.headers.authorization?.split(' ')[1] ||
        (client.handshake.query.token as string) ||
        (client.handshake.auth?.token as string);

      if (!token) {
        this.logger.warn(
          `[Chat Auth Failed] Connexion rejetée (Token absent) : ${client.id}`,
        );
        client.disconnect();
        return;
      }

      const secret = this.configService.get<string>(
        'JWT_SECRET',
        'SUPER_SECRET_KEY_CHANGEME',
      );
      const payload = this.jwtService.verify<JwtPayload>(token, { secret });

      client.data.user = payload;
      this.logger.log(
        `[Chat Connected] Socket: ${client.id} | User: ${payload?.sub} (${payload?.role})`,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`[Chat Auth Error] Socket ${client.id} : ${msg}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: ChatSocket) {
    const userId = client.data?.user?.sub || 'Inconnu';
    this.logger.log(
      `[Chat Disconnected] Socket: ${client.id} | User: ${userId}`,
    );
  }

  /**
   * 🚪 2. Rejoindre le salon éphémère d'une commande spécifique
   */
  @SubscribeMessage('joinOrderChat')
  handleJoinOrderChat(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody('orderId') orderId: string,
  ) {
    if (!orderId) {
      return { status: 'error', message: 'ID de commande requis.' };
    }

    const user = client.data.user;
    if (!user) {
      return { status: 'error', message: 'Utilisateur non authentifié.' };
    }

    const roomName = `order_chat_${orderId}`;
    client.join(roomName);

    this.logger.log(
      `[Chat Room] User ${user.sub} a rejoint le salon ${roomName}`,
    );
    return { status: 'ok', event: 'joinedChatRoom', room: roomName };
  }

  /**
   * 💬 3. Envoi et diffusion instantanée d'un message dans la course
   */
  @SubscribeMessage('sendOrderMessage')
  handleSendMessage(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody() payload: { orderId: string; message: string },
  ) {
    const user = client.data.user;

    if (!user) {
      return { status: 'error', message: 'Utilisateur non authentifié.' };
    }

    if (!payload.orderId || !payload.message) {
      return { status: 'error', message: 'Payload incomplet.' };
    }

    const roomName = `order_chat_${payload.orderId}`;

    const messagePacket = {
      senderId: user.sub,
      senderRole: user.role,
      message: payload.message.trim(),
      timestamp: new Date().toISOString(),
    };

    // Diffusion du message à tous les participants du salon (Client + Livreur)
    this.server.to(roomName).emit('newOrderMessage', messagePacket);

    this.logger.log(
      `[Chat Message] Commande ${payload.orderId} | De ${user.sub} (${user.role})`,
    );

    return { status: 'sent', data: messagePacket };
  }

  /**
   * 🧹 4. Destruction / Sortie du salon (Fin de course)
   */
  @SubscribeMessage('leaveOrderChat')
  handleLeaveOrderChat(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody('orderId') orderId: string,
  ) {
    if (!orderId) return;

    const user = client.data.user;
    if (!user) {
      return { status: 'error', message: 'Utilisateur non authentifié.' };
    }

    const roomName = `order_chat_${orderId}`;
    client.leave(roomName);

    this.logger.log(
      `[Chat Room] User ${user.sub} a quitté le salon ${roomName}`,
    );
    return { status: 'ok', room: roomName };
  }
}
