import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

export enum BanRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

@Entity('ban_requests')
export class BanRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  targetUserId: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'targetUserId' })
  targetUser: User;

  @Column({ type: 'uuid' })
  requestedBy: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'requestedBy' })
  requester: User;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'varchar', length: 20, default: BanRequestStatus.PENDING })
  status: BanRequestStatus;

  @Column({ type: 'uuid', nullable: true })
  reviewedBy?: string | null;

  @ManyToOne(() => User, { nullable: true, eager: true })
  @JoinColumn({ name: 'reviewedBy' })
  reviewer?: User | null;

  @Column({ type: 'text', nullable: true })
  reviewNote?: string | null;

  @Column({ type: 'timestamp', nullable: true })
  reviewedAt?: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
