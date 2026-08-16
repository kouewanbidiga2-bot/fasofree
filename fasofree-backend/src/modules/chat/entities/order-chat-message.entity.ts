import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * 💬 Canal de discussion d'une commande
 * - MERCHANT : Client <-> Marchand
 * - DRIVER   : Client <-> Livreur
 */
export enum ChatChannel {
  MERCHANT = 'merchant',
  DRIVER = 'driver',
}

@Entity('order_chat_messages')
export class OrderChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar' })
  orderId: string;

  @Index()
  @Column({ type: 'varchar' })
  senderId: string;

  @Column({ type: 'varchar' })
  senderRole: string;

  @Column({ type: 'enum', enum: ChatChannel })
  channel: ChatChannel;

  @Column({ type: 'text' })
  message: string;

  @CreateDateColumn()
  createdAt: Date;
}
