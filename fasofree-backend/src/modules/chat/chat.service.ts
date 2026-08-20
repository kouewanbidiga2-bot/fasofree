import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  OrderChatMessage,
  ChatChannel,
} from './entities/order-chat-message.entity';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { BusinessesService } from '../businesses/businesses.service';
import { UserRole } from '../users/entities/user-role.enum';

/**
 * 🔒 Statuts terminaux : le canal de discussion est désactivé/archivé.
 */
export const TERMINAL_STATUSES: OrderStatus[] = [
  OrderStatus.COMPLETED,
  OrderStatus.CANCELLED,
  OrderStatus.FAILED,
  OrderStatus.DISPUTED,
  OrderStatus.REFUNDED,
];

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @InjectRepository(OrderChatMessage)
    private readonly chatRepository: Repository<OrderChatMessage>,
    private readonly businessesService: BusinessesService,
  ) {}

  /**
   * 💬 Le chat éphémère n'est actif que tant que la commande n'est pas terminée
   * (IN_PROGRESS -> PAID/IN_PREPARATION, IN_TRANSIT -> PROCESSING).
   */
  isChatActive(status: OrderStatus): boolean {
    return !TERMINAL_STATUSES.includes(status);
  }

  /**
   * 👥 Vérifie que l'utilisateur est un participant légitime du canal.
   * - CLIENT : peut discuter sur les deux canaux (avec le marchand et le livreur)
   * - MARCHAND : propriétaire/manager du commerce (canal MERCHANT)
   * - LIVREUR : seul le coursier assigné (canal DRIVER)
   * - SUPER_ADMIN : modération (tous canaux)
   */
  async canAccessChannel(
    order: Order | null,
    userId: string,
    role: string,
    channel: ChatChannel,
  ): Promise<boolean> {
    if (!order) return false;
    if (order.clientId === userId) return true;

    const normalizedRole = role?.toLowerCase();
    if (normalizedRole === UserRole.SUPER_ADMIN) return true;
    if (normalizedRole === UserRole.ADMIN) return true;
    if (normalizedRole === UserRole.SUPPORT) return true;

    if (channel === ChatChannel.MERCHANT) {
      if (!order.businessId) return false;
      try {
        await this.businessesService.assertManagedBy(
          order.businessId,
          userId,
          normalizedRole as UserRole,
        );
        return true;
      } catch {
        return false;
      }
    }

    // DRIVER : seul le livreur assigné (ou le client) peut discuter
    return order.driverId === userId;
  }

  /**
   * 📜 Historique / archive du canal (chargé au join du salon).
   */
  async getHistory(
    orderId: string,
    channel: ChatChannel,
    limit = 50,
  ): Promise<OrderChatMessage[]> {
    return this.chatRepository.find({
      where: { orderId, channel },
      order: { createdAt: 'ASC' },
      take: Math.min(Math.max(limit, 1), 200),
    });
  }

  /**
   * 💾 Persistance d'un message (archivage de la discussion).
   */
  async saveMessage(
    orderId: string,
    senderId: string,
    senderRole: string,
    channel: ChatChannel,
    message: string,
  ): Promise<OrderChatMessage> {
    const entity = this.chatRepository.create({
      orderId,
      senderId,
      senderRole,
      channel,
      message,
    });
    const saved = await this.chatRepository.save(entity);
    this.logger.debug(
      `[Chat Stored] Commande ${orderId} | canal ${channel} | ${senderId}`,
    );
    return saved;
  }

  /**
   * 📋 Commandes ayant des messages de chat (pour inbox admin/support).
   * Retourne les 50 commandes les plus récentes avec au moins un message.
   */
  async getActiveConversations(): Promise<{ orderId: string; lastMessage: string; lastAt: Date; channel: string }[]> {
    const result = await this.chatRepository
      .createQueryBuilder('msg')
      .select('msg.orderId', 'orderId')
      .addSelect('MAX(msg.createdAt)', 'lastAt')
      .addSelect(
        `(SELECT m2.message FROM order_chat_messages m2 WHERE m2.orderId = msg.orderId ORDER BY m2.createdAt DESC LIMIT 1)`,
        'lastMessage',
      )
      .addSelect(
        `(SELECT m2.channel FROM order_chat_messages m2 WHERE m2.orderId = msg.orderId ORDER BY m2.createdAt DESC LIMIT 1)`,
        'channel',
      )
      .groupBy('msg.orderId')
      .orderBy('MAX(msg.createdAt)', 'DESC')
      .limit(50)
      .getRawMany();

    return result.map((r) => ({
      orderId: r.orderId,
      lastMessage: r.lastMessage,
      lastAt: r.lastAt,
      channel: r.channel,
    }));
  }
}
