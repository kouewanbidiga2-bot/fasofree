import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum ReferralStatus {
  REWARDED = 'REWARDED',
}

@Entity('referrals')
export class Referral {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'uuid' }) referrerId: string;
  @Index({ unique: true }) @Column({ type: 'uuid' }) refereeId: string;
  @Column({ type: 'enum', enum: ReferralStatus }) status: ReferralStatus;
  @Column({ type: 'decimal', precision: 10, scale: 2 }) rewardAmount: number;
  @CreateDateColumn() createdAt: Date;
}
