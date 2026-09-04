import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum LoyaltySource {
  ORDER = 'ORDER',
  REFERRAL = 'REFERRAL',
  STREAK = 'STREAK',
  BONUS = 'BONUS',
  REDEMPTION = 'REDEMPTION',
}

@Entity('loyalty_points')
@Index(['userId', 'source'])
export class LoyaltyPoint {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'int' })
  points: number;

  @Column({ type: 'varchar', length: 20, default: LoyaltySource.ORDER })
  source: LoyaltySource;

  @Column({ type: 'uuid', nullable: true })
  orderId: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  description: string;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
