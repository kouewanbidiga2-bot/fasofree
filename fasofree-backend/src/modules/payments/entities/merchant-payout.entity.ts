import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Order } from '../../orders/entities/order.entity';

export enum PayoutStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  BLOCKED = 'BLOCKED',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

export enum PayoutProvider {
  ORANGE_MONEY = 'ORANGE_MONEY',
  MOOV_MONEY = 'MOOV_MONEY',
  WAVE = 'WAVE',
}

@Entity('merchant_payouts')
export class MerchantPayout {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // 🔒 Garantit l'idempotence au niveau de la base de données
  @Column({ unique: true })
  @Index()
  orderId: string;

  @Column()
  businessId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'enum', enum: PayoutStatus, default: PayoutStatus.PENDING })
  status: PayoutStatus;

  @Column({ type: 'enum', enum: PayoutProvider })
  provider: PayoutProvider;

  @Column()
  recipientPhoneNumber: string;

  @Column({ nullable: true })
  providerTransactionRef?: string;

  @Column({ type: 'text', nullable: true })
  failureReason?: string;

  @OneToOne(() => Order)
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
