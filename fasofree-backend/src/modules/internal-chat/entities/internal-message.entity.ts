import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum InternalChannel {
  GENERAL = 'general',
  OPERATIONS = 'operations',
  SUPPORT = 'support',
  FINANCE = 'finance',
}

@Entity('internal_chat_messages')
export class InternalMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 30 })
  channel: InternalChannel;

  @Column({ type: 'uuid', nullable: true })
  recipientId?: string | null;

  @ManyToOne(() => User, { eager: true, nullable: true })
  @JoinColumn({ name: 'recipientId' })
  recipient?: User | null;

  @Column({ type: 'uuid' })
  senderId: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'senderId' })
  sender: User;

  @Column({ type: 'text' })
  message: string;

  @CreateDateColumn()
  createdAt: Date;
}
