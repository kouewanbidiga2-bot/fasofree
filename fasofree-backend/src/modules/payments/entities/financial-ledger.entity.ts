import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum LedgerEntryType {
  DEBIT = 'DEBIT',
  CREDIT = 'CREDIT',
}

@Entity('financial_ledger')
export class FinancialLedger {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  transactionRef: string;

  @Column()
  @Index()
  accountOwnerId: string; // ID Marchand, ID Client ou 'PLATFORM_FASOFREE'

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'enum', enum: LedgerEntryType })
  entryType: LedgerEntryType;

  @Column()
  description: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn({ update: false }) // Immuable : Interdiction absolue de modification après écriture
  createdAt: Date;
}
