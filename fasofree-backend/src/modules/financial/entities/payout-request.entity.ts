import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum PayoutStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  EXECUTED = 'EXECUTED',
  FAILED = 'FAILED',
  REJECTED = 'REJECTED',
}

export enum UserRole {
  DRIVER = 'DRIVER',
  COURIER = 'COURIER',
  MERCHANT = 'MERCHANT',
  SUPER_ADMIN = 'SUPER_ADMIN',
}

@Entity('payout_requests')
export class PayoutRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  userId: string;

  @Column({ type: 'varchar' })
  userRole: UserRole;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  walletId: string | null;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  branchId: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  fees: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  netAmount: number;

  @Column({ type: 'varchar' })
  phoneNumber: string;

  @Column({ type: 'varchar', nullable: true })
  provider: string | null;

  @Column({ type: 'varchar', default: PayoutStatus.PENDING })
  @Index()
  status: PayoutStatus;

  @Column({ type: 'varchar', nullable: true })
  transactionReference: string | null;

  @Column({ type: 'varchar', nullable: true })
  providerReference: string | null;

  @Column({ type: 'varchar', nullable: true })
  failureReason: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
