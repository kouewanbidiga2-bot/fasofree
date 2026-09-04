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
import {
  Logger,
  UsePipes,
  ValidationPipe,
  Injectable,
} from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { ChatService, TERMINAL_STATUSES } from './chat.service';
import { ChatChannel } from './entities/order-chat-message.entity';
import { OrdersService } from '../orders/orders.service';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { resolveJwtSecret } from '../../config/jwt.config';

type ChatSocket = Socket & { data: { user?: JwtPayload } };

export const chatRoom = (orderId: string, channel: ChatChannel) =>
  `order_chat_${orderId}:${channel}`;

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/chat',
})
@UsePipes(new ValidationPipe({ transform: true }))
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly chatService: ChatService,
    private readonly ordersService: OrdersService,
  ) {}

  afterInit(server: Server) {
    this.server = server;
    this.logger.log('[Chat Gateway] Initialisé (namespace /chat)');
  }

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

      const secret = resolveJwtSecret(this.configService);
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
   * 👥 Vérifie que l'utilisateur est un participant légitime du canal.
   */
  private canAccessChannel(
    order: Order | null,
    userId: string,
    role: string,
    channel: ChatChannel,
  ): Promise<boolean> {
    return this.chatService.canAccessChannel(order, userId, role, channel);
  }

  private isTerminal(order: Order | null): boolean {
    return !!order && TERMINAL_STATUSES.includes(order.status);
  }

  /**
   * 🚪 2. Rejoindre le salon éphémère d'un canal de commande
   */
  @SubscribeMessage('joinOrderChat')
  async handleJoinOrderChat(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody()
    payload: { orderId: string; channel?: ChatChannel },
  ) {
    const user = client.data.user;
    if (!user) {
      return { status: 'error', message: 'Utilisateur non authentifié.' };
    }

    const orderId = payload?.orderId;
    if (!orderId) {
      return { status: 'error', message: 'ID de commande requis.' };
    }

    const channel: ChatChannel =
      payload?.channel === ChatChannel.MERCHANT
        ? ChatChannel.MERCHANT
        : ChatChannel.DRIVER;

    let order: Order | null = null;
    try {
      order = await this.ordersService.findOne(orderId);
    } catch {
      order = null;
    }

    if (this.isTerminal(order)) {
      this.logger.log(
        `[Chat Room] Canal fermé (commande ${orderId} = ${order?.status})`,
      );
      return { status: 'closed', message: 'Canal de discussion archivé.' };
    }

    if (!(await this.canAccessChannel(order, user.sub, user.role, channel))) {
      this.logger.warn(
        `[Chat Room] Accès refusé : ${user.sub} n'est pas participant du canal ${channel} de ${orderId}`,
      );
      return {
        status: 'error',
        message: 'Vous ne participez pas à ce canal de discussion.',
      };
    }

    const roomName = chatRoom(orderId, channel);
    client.join(roomName);

    // 📜 Historique du canal (archive consultable)
    const history = await this.chatService.getHistory(orderId, channel);

    this.logger.log(
      `[Chat Room] User ${user.sub} a rejoint le salon ${roomName}`,
    );
    return {
      status: 'ok',
      room: roomName,
      channel,
      active: true,
      history,
    };
  }

  /**
   * 💬 4. Envoi et diffusion instantanée d'un message dans le canal
   */
  @SubscribeMessage('sendOrderMessage')
  async handleSendMessage(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody()
    payload: { orderId: string; message: string; channel?: ChatChannel },
  ) {
    const user = client.data.user;
    if (!user) {
      return { status: 'error', message: 'Utilisateur non authentifié.' };
    }

    if (!payload?.orderId || !payload?.message) {
      return { status: 'error', message: 'Payload incomplet.' };
    }

    const channel: ChatChannel =
      payload?.channel === ChatChannel.MERCHANT
        ? ChatChannel.MERCHANT
        : ChatChannel.DRIVER;

    let order: Order | null = null;
    try {
      order = await this.ordersService.findOne(payload.orderId);
    } catch {
      order = null;
    }

    if (this.isTerminal(order)) {
      this.logger.warn(
        `[Chat Message] Refusé : commande ${payload.orderId} archivée (${order?.status})`,
      );
      return {
        status: 'closed',
        message: 'Le canal de discussion est fermé.',
      };
    }

    if (!(await this.canAccessChannel(order, user.sub, user.role, channel))) {
      return {
        status: 'error',
        message: 'Vous ne participez pas à ce canal de discussion.',
      };
    }

    const roomName = chatRoom(payload.orderId, channel);

    const messagePacket = {
      orderId: payload.orderId,
      channel,
      senderId: user.sub,
      senderRole: user.role,
      message: payload.message.trim(),
      timestamp: new Date().toISOString(),
    };

    // 💾 Persistance (archive de la discussion)
    await this.chatService.saveMessage(
      payload.orderId,
      user.sub,
      user.role,
      channel,
      messagePacket.message,
    );

    // 📡 Diffusion à tous les participants du salon
    this.server.to(roomName).emit('newOrderMessage', messagePacket);

    this.logger.log(
      `[Chat Message] Commande ${payload.orderId} [${channel}] | De ${user.sub} (${user.role})`,
    );

    return { status: 'sent', data: messagePacket };
  }

  /**
   * 🧹 5. Sortie du salon
   */
  @SubscribeMessage('leaveOrderChat')
  handleLeaveOrderChat(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody() payload: { orderId: string; channel?: ChatChannel },
  ) {
    if (!payload?.orderId) return;

    const channel: ChatChannel =
      payload?.channel === ChatChannel.MERCHANT
        ? ChatChannel.MERCHANT
        : ChatChannel.DRIVER;

    const roomName = chatRoom(payload.orderId, channel);
    client.leave(roomName);

    this.logger.log(
      `[Chat Room] User ${client.data?.user?.sub} a quitté le salon ${roomName}`,
    );
    return { status: 'ok', room: roomName };
  }

  /**
   * 🔒 6. Archivage : fermeture proactive du canal dès COMPLETED
   * (ou tout autre statut terminal).
   */
  closeOrderChat(orderId: string, status?: OrderStatus): void {
    if (!this.server) return;
    [ChatChannel.MERCHANT, ChatChannel.DRIVER].forEach((channel) => {
      this.server
        .to(chatRoom(orderId, channel))
        .emit('chatClosed', { orderId, channel, status });
    });
    this.logger.log(
      `[Chat Archived] Canal de la commande ${orderId} fermé (${status ?? 'terminal'}).`,
    );
  }

  @OnEvent('order.completed')
  handleOrderCompleted(order: Order) {
    this.closeOrderChat(order.id, OrderStatus.COMPLETED);
  }

  @OnEvent('order.chat.closed')
  handleOrderChatClosed(payload: { orderId: string; status: OrderStatus }) {
    if (payload?.orderId) {
      this.closeOrderChat(payload.orderId, payload.status);
    }
  }
}
