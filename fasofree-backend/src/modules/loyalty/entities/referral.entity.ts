import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('referrals')
@Unique(['referredUserId'])
export class Referral {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  referrerUserId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'referrerUserId' })
  referrerUser: User;

  @Column({ type: 'uuid' })
  referredUserId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'referredUserId' })
  referredUser: User;

  @Column({ type: 'int', default: 0 })
  referrerBonus: number;

  @Column({ type: 'int', default: 0 })
  referredBonus: number;

  @Column({ type: 'boolean', default: false })
  firstOrderCompleted: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
