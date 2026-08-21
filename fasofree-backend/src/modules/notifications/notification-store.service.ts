import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationType } from './entities/notification.entity';

@Injectable()
export class NotificationStoreService {
  private readonly logger = new Logger(NotificationStoreService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly repo: Repository<Notification>,
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
    return this.repo.save(notif);
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
}
