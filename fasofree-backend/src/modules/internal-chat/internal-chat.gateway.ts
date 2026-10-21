/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

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
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import {
  InternalChatService,
  InternalChannel,
} from './internal-chat.service';
import { User } from '../users/entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationStoreService } from '../notifications/notification-store.service';
import { NotificationType } from '../notifications/entities/notification.entity';
import { resolveJwtSecret } from '../../config/jwt.config';
import { originAllowed } from '../../config/cors.config';

type InternalSocket = Socket & { data: { user?: JwtPayload } };

/** Suivi des utilisateurs en ligne par salon (room -> Set<userId>) */
const onlineUsersByRoom = new Map<string, Set<string>>();

const DM_PREFIX = 'dm:';
const isDmChannel = (ch: string) => ch.startsWith(DM_PREFIX);
const dmRoom = (u1: string, u2: string) => {
  const sorted = [u1, u2].sort();
  return `dm_${sorted[0]}_${sorted[1]}`;
};

@WebSocketGateway({
  cors: {
    // Politique CORS partagée HTTP/WS (config/cors.config.ts) : plus
    // d'allow-all en développement, apex fasofree.site couvert en prod.
    origin: (origin, callback) => {
      if (!origin || originAllowed(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  },
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
    private readonly notificationsService: NotificationsService,
    private readonly notificationStoreService: NotificationStoreService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  afterInit() {
    this.logger.log('[InternalChat Gateway] Initialisé (namespace /internal-chat)');
  }

  async handleConnection(client: InternalSocket) {
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

      const secret = resolveJwtSecret(this.configService);
      const payload = this.jwtService.verify<JwtPayload>(token, { secret });

      // 🔒 Comptes désactivés/bannis : pas d'accès au chat interne.
      // Contrôle isolé : une panne DB est loggée distinctement (fail-closed).
      try {
        const dbUser = await this.userRepository.findOne({
          where: { id: payload.sub },
          select: { id: true, isActive: true },
        });
        if (!dbUser || !dbUser.isActive) {
          this.logger.warn(
            `[InternalChat Auth] Connexion refusée — compte inactif ou introuvable : ${payload.sub}`,
          );
          client.disconnect();
          return;
        }
      } catch (dbErr) {
        this.logger.error(
          `[InternalChat Auth] Contrôle isActive impossible (DB) pour ${payload.sub} : ${dbErr instanceof Error ? dbErr.message : String(dbErr)}`,
        );
        client.disconnect();
        return;
      }

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
    const userId = client.data.user?.sub;
    this.logger.log(`[InternalChat Disconnected] ${client.id} (user: ${userId})`);
    // Remove from all rooms tracking
    for (const [roomName, roomUsers] of onlineUsersByRoom.entries()) {
      if (roomUsers.has(userId)) {
        roomUsers.delete(userId);
        if (roomUsers.size === 0) onlineUsersByRoom.delete(roomName);
      }
    }
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

    // Track online user in this room
    const roomUsers = onlineUsersByRoom.get(roomName) || new Set();
    roomUsers.add(user.sub);
    onlineUsersByRoom.set(roomName, roomUsers);

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

    // 🔔 Push notification pour les membres OFFLINE du canal
    this.notifyOfflineUsers(roomName, user.sub, channel, message.trim()).catch((err) => {
      this.logger.warn(`[InternalChat] notifyOfflineUsers error: ${err instanceof Error ? err.message : String(err)}`);
    });

    return { status: 'sent', data: packet };
  }

  /**
   * 🔔 Envoie une push notification aux membres de l'équipe absents du salon.
   * Ne notifie pas l'expéditeur, ni les utilisateurs déjà connectés dans la room.
   */
  private async notifyOfflineUsers(
    roomName: string,
    senderId: string,
    channel: string,
    message: string,
  ): Promise<void> {
    const onlineInRoom = onlineUsersByRoom.get(roomName) || new Set();
    // Récupère tous les utilisateurs autorisés (team) pour ce canal
    const teamUsers = await this.userRepository.find({
      where: { isActive: true },
      select: { id: true, fcmToken: true, preferredNotificationChannel: true, email: true, phone: true, fullName: true },
    });

    for (const u of teamUsers) {
      if (u.id === senderId) continue; // pas de notification à soi-même
      if (onlineInRoom.has(u.id)) continue; // déjà connecté → WebSocket suffit

      const title = `[#${channel}] Nouveau message`;
      const body = `${message.slice(0, 120)}${message.length > 120 ? '…' : ''}`;

      // 🔔 Notification IN-APP (persistée, visible dans le centre de notifications).
      // On passe par NotificationStoreService.create : in-app + push FCM
      // uniquement, jamais d'e-mail/SMS/WhatsApp (règle plateforme). C'est le
      // même chemin que partout ailleurs.
      // ⚠️ create() pousse déjà le FCM via pushToUsers() — pas de 2e sendToDevice
      // pour éviter le double push (problème #8).
      this.notificationStoreService
        .create({
          userId: u.id,
          type: NotificationType.SYSTEM,
          title,
          body,
          actionUrl: `/internal-chat?channel=${channel}`,
        })
        .catch((err) =>
          this.logger.warn(
            `[InternalChat] Création notif in-app échouée pour ${u.id}: ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
    }
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

    const recipient = await this.userRepository.findOne({ where: { id: recipientId } });
    if (!recipient) {
      return { status: 'error', message: 'Destinataire introuvable' };
    }

    const teamRoles = ['super_admin', 'admin', 'support'];
    if (!teamRoles.includes(recipient.role)) {
      return { status: 'error', message: 'Destinataire non autorisé' };
    }

    const roomName = dmRoom(user.sub, recipientId);
    client.join(roomName);

    // Track online users in DM room
    const roomUsers = onlineUsersByRoom.get(roomName) || new Set();
    roomUsers.add(user.sub);
    onlineUsersByRoom.set(roomName, roomUsers);

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

    const recipient = await this.userRepository.findOne({ where: { id: recipientId } });
    if (!recipient) {
      return { status: 'error', message: 'Destinataire introuvable' };
    }

    const teamRoles = ['super_admin', 'admin', 'support'];
    if (!teamRoles.includes(recipient.role)) {
      return { status: 'error', message: 'Destinataire non autorisé' };
    }

    const sanitizedMessage = message.trim().slice(0, 2000).replace(/<[^>]*>/g, '');

    const saved = await this.internalChatService.saveMessage(
      'dm' as InternalChannel,
      user.sub,
      sanitizedMessage,
      recipientId,
    );

    const packet = {
      id: saved.id,
      channel: 'dm',
      senderId: user.sub,
      senderRole: user.role,
      recipientId,
      message: sanitizedMessage,
      timestamp: saved.createdAt.toISOString(),
    };

    const roomName = dmRoom(user.sub, recipientId);
    this.server.to(roomName).emit('newMessage', packet);

    // 🔔 Push notification si le destinataire est OFFLINE
    if (!onlineUsersByRoom.get(roomName)?.has(recipientId)) {
      const title = `💬 Message direct de ${user.role}`;
      const body = `${sanitizedMessage.slice(0, 120)}${sanitizedMessage.length > 120 ? '…' : ''}`;

      // 🔔 Notification IN-APP + push FCM uniquement (pas d'email pour le chat).
      this.notificationStoreService
        .create({
          userId: recipientId,
          type: NotificationType.SYSTEM,
          title,
          body,
          actionUrl: `/internal-chat?dm=${recipientId}`,
        })
        .catch((err) =>
          this.logger.warn(
            `[InternalChat] Création notif in-app DM échouée pour ${recipientId}: ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
    }

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
    const userId = client.data.user?.sub;
    const roomName = isDmChannel(payload.channel)
      ? dmRoom(userId || '', payload.channel.slice(3))
      : `internal_${payload.channel}`;
    client.leave(roomName);
    // Cleanup online tracking
    const roomUsers = onlineUsersByRoom.get(roomName);
    if (roomUsers) {
      roomUsers.delete(userId);
      if (roomUsers.size === 0) onlineUsersByRoom.delete(roomName);
    }
    return { status: 'ok' };
  }

  }
