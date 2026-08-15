import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum SubscriptionSubjectType {
  CUSTOMER = 'CUSTOMER', // Client FasoFree VIP
  MERCHANT = 'MERCHANT', // Commerçant Boost Pro
}

export enum SubscriptionPlan {
  VIP = 'VIP', // 1500 FCFA / mois - Frais de service offerts
  BOOST_PRO = 'BOOST_PRO', // 5000 FCFA / mois - Commission réduite (1.5%)
}

export const SUBSCRIPTION_PRICES: Record<SubscriptionPlan, number> = {
  [SubscriptionPlan.VIP]: 1500,
  [SubscriptionPlan.BOOST_PRO]: 5000,
};

@Entity('subscriptions')
@Index(['subjectType', 'subjectId'])
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: SubscriptionSubjectType })
  subjectType: SubscriptionSubjectType;

  @Column({ type: 'varchar' })
  subjectId: string;

  @Column({ type: 'enum', enum: SubscriptionPlan })
  plan: SubscriptionPlan;

  @Column({ type: 'timestamp' })
  startDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  endDate: Date | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: true })
  autoRenew: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
