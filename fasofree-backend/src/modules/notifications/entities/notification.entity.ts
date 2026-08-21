import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum NotificationType {
  ORDER_UPDATE = 'ORDER_UPDATE',
  DELIVERY = 'DELIVERY',
  PROMOTION = 'PROMOTION',
  ACCOUNT = 'ACCOUNT',
  SYSTEM = 'SYSTEM',
}

@Entity('notifications')
@Index(['userId', 'isRead'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  userId: string;

  @Column({ type: 'varchar', length: 30, default: NotificationType.SYSTEM })
  type: NotificationType;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'varchar', nullable: true })
  orderId?: string | null;

  @Column({ type: 'varchar', nullable: true })
  actionUrl?: string | null;

  @Column({ type: 'boolean', default: false })
  isRead: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
