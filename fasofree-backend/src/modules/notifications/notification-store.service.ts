import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Notification, NotificationType } from './entities/notification.entity';
import { NotificationsService } from './notifications.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class NotificationStoreService {
  private readonly logger = new Logger(NotificationStoreService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly repo: Repository<Notification>,
    private readonly notificationsService: NotificationsService,
    private readonly usersService: UsersService,
  ) {}

  async create(params: {
    userId: string;
    type?: NotificationType;
    title: string;
    body: string;
    orderId?: string;
    actionUrl?: string;
  }): Promise<Notification> {
    const notif = this.repo.create({
      userId: params.userId,
      type: params.type ?? NotificationType.SYSTEM,
      title: params.title,
      body: params.body,
      orderId: params.orderId ?? null,
      actionUrl: params.actionUrl ?? null,
    });
    const saved = await this.repo.save(notif);

    // Push FCM complémentaire (non bloquant) — jamais d'e-mail/SMS/WhatsApp.
    // Le flux in-app (cette ligne en base) reste la source de vérité, la cloche
    // du back-office / de l'app client la relaie.
    this.pushToUsers([params.userId], params.title, params.body, {
      type: 'IN_APP_NOTIFICATION',
      actionUrl: params.actionUrl ?? '/',
    }).catch(() => {});

    return saved;
  }

  /**
   * Push FCM UNIQUEMENT (jamais d'e-mail / SMS / WhatsApp) vers une liste
   * d'utilisateurs. Utilisé par `create` et `sendToUsers` : la notification
   * in-app est déposée en base, puis poussée si un token FCM existe.
   */
  async pushToUsers(
    userIds: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    try {
      const users = await this.usersService.findNotificationRecipients(userIds);
      await Promise.allSettled(
        users
          .filter((user) => !!user.fcmToken)
          .map((user) =>
            this.notificationsService.sendToDevice(user.fcmToken as string, {
              title,
              body,
              data,
            }),
          ),
      );
    } catch (err) {
      this.logger.warn(`[pushToUsers] Échec push FCM: ${err}`);
    }
  }

  async findAllByUser(
    userId: string,
    opts?: { limit?: number; unreadOnly?: boolean },
  ): Promise<{ items: Notification[]; unreadCount: number }> {
    const limit = opts?.limit ?? 30;
    const qb = this.repo.createQueryBuilder('n')
      .where('n.userId = :userId', { userId })
      .orderBy('n.createdAt', 'DESC')
      .take(limit);
    if (opts?.unreadOnly) {
      qb.andWhere('n.isRead = false');
    }
    const items = await qb.getMany();
    const unreadCount = await this.repo.count({ where: { userId, isRead: false } });
    return { items, unreadCount };
  }

  async markAsRead(id: string, userId: string): Promise<void> {
    await this.repo.update({ id, userId }, { isRead: true });
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.repo.update({ userId, isRead: false }, { isRead: true });
  }

  /**
   * Envoyer une notification à un ou plusieurs utilisateurs (DB + FCM push)
   */
  async sendToUsers(
    userIds: string[],
    title: string,
    body: string,
    type: NotificationType = NotificationType.SYSTEM,
    actionUrl?: string,
  ): Promise<number> {
    const MAX_RECIPIENTS = 500;
    const safeUserIds = userIds.slice(0, MAX_RECIPIENTS);
    if (userIds.length > MAX_RECIPIENTS) {
      this.logger.warn(
        `[sendToUsers] Tronqué de ${userIds.length} à ${MAX_RECIPIENTS} destinataires`,
      );
    }

    const notifications = safeUserIds.map((userId) =>
      this.repo.create({
        userId,
        type,
        title,
        body,
        actionUrl: actionUrl ?? null,
      }),
    );
    await this.repo.save(notifications);

    // 2. Push FCM (non bloquant) — jamais d'e-mail/SMS/WhatsApp.
    await this.pushToUsers(safeUserIds, title, body, {
      type: 'SYSTEM_NOTIFICATION',
      actionUrl: actionUrl ?? '/',
    });

    return notifications.length;
  }

  /**
   * Broadcast à tous les utilisateurs d'un rôle donné
   */
  async broadcastToRole(
    role: string,
    title: string,
    body: string,
    type: NotificationType = NotificationType.SYSTEM,
    actionUrl?: string,
  ): Promise<number> {
    // On ne notifie que les utilisateurs ACTIFS de ce rôle.
    // Requête directe puisque User est dans un module séparé.
    const result = await this.repo.manager
      .createQueryBuilder()
      .select('id')
      .from('users', 'u')
      .where('u.role = :role', { role })
      .andWhere('u."isActive" = true')
      .getRawMany();

    const userIds = result.map((r: any) => r.id);
    if (userIds.length === 0) return 0;

    return this.sendToUsers(userIds, title, body, type, actionUrl);
  }

  /**
   * Retourne les IDs des clients ayant passé au moins une commande dans les businesses donnés.
   * Utilisé pour la vérification ownership des notifications BUSINESS_ADMIN.
   */
  async findClientsOfBusinesses(businessIds: string[]): Promise<string[]> {
    if (!businessIds.length) return [];
    const result = await this.repo.manager
      .createQueryBuilder()
      .select('DISTINCT o."clientId"', 'clientId')
      .from('orders', 'o')
      .where('o."businessId" IN (:...businessIds)', { businessIds })
      .andWhere('o."clientId" IS NOT NULL')
      .andWhere('o.status NOT IN (:...excluded)', {
        excluded: ['CANCELLED', 'FAILED'],
      })
      .getRawMany();
    return result.map((r: any) => r.clientId).filter(Boolean);
  }
}
