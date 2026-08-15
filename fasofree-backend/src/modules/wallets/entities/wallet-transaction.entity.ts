import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Wallet } from './wallet.entity';

export enum TransactionType {
  CREDIT = 'CREDIT', // Rechargement, gain de course, vente
  DEBIT = 'DEBIT', // Retrait (Payout), commission, paiement commande
  DEPOSIT = 'DEPOSIT', // Recharge de portefeuille (Mobile Money / Mock)
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum TransactionReason {
  ORDER_PAYMENT = 'ORDER_PAYMENT',
  DELIVERY_FEE = 'DELIVERY_FEE',
  COMMISSION = 'COMMISSION',
  WITHDRAWAL = 'WITHDRAWAL',
  TOPUP = 'TOPUP',
  REFUND = 'REFUND',
  REFERRAL_REWARD = 'REFERRAL_REWARD',
  PAYOUT = 'PAYOUT',
  DAILY_PASS_FEE = 'DAILY_PASS_FEE',
  SERVICE_FEE = 'SERVICE_FEE',
}

@Entity('wallet_transactions')
export class WalletTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  walletId: string;

  @ManyToOne(() => Wallet, (wallet) => wallet.transactions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'walletId' })
  wallet: Wallet;

  @Column({ type: 'enum', enum: TransactionType })
  type: TransactionType;

  @Column({ type: 'enum', enum: TransactionStatus, default: TransactionStatus.COMPLETED })
  status: TransactionStatus;

  @Column({ type: 'enum', enum: TransactionReason })
  reason: TransactionReason;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  amount: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  balanceAfter: number;

  @Column({ type: 'varchar', nullable: true })
  @Index()
  reference: string; // ID de commande ou ID de transaction LigdiCash

  @Column({ type: 'text', nullable: true })
  description: string;

  @CreateDateColumn()
  createdAt: Date;
}
