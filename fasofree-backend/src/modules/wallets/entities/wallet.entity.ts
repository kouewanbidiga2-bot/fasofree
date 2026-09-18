import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { WalletTransaction } from './wallet-transaction.entity';

export enum UserRole {
  DRIVER = 'DRIVER',
  COURIER = 'COURIER',
  MERCHANT = 'MERCHANT',
  CUSTOMER = 'CUSTOMER',
  SUPER_ADMIN = 'SUPER_ADMIN',
}

const decimalTransformer = {
  to: (value: number) => value,
  from: (value: string) => parseFloat(value),
};

@Entity('wallets')
@Index(['userId', 'userRole', 'branchId'], { unique: true })
export class Wallet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  userId: string;

  @Column({ type: 'enum', enum: UserRole })
  userRole: UserRole;

  @Column({ type: 'uuid', nullable: true })
  branchId: string | null;

  @Column({ type: 'varchar', length: 3, default: 'XOF' })
  currency: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  /**
   * Solde total = availableBalance + heldBalance.
   * Conservé pour compatibilité — les nouvelles lectures doivent utiliser
   * availableBalance (retraits) ou balance (solde affiché).
   */
  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: decimalTransformer,
  })
  balance: number;

  /**
   * Solde disponible au retrait (balance − fonds en cours de traitement).
   * Crédit → availableBalance += montant.
   * Hold   → availableBalance -= montant, heldBalance += montant.
   * Confirm → heldBalance -= montant, balance -= montant.
   * Release → heldBalance -= montant, availableBalance += montant.
   */
  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: decimalTransformer,
  })
  availableBalance: number;

  /**
   * Fonds en attente de confirmation (retrait en cours GeniusPay).
   * Bloqués jusqu'au webhook cashout.completed ou cashout.failed.
   */
  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: decimalTransformer,
  })
  heldBalance: number;

  @OneToMany(() => WalletTransaction, (transaction) => transaction.wallet)
  transactions: WalletTransaction[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
