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
}

@Entity('wallets')
@Index(['userId', 'userRole'], { unique: true })
export class Wallet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  userId: string;

  @Column({ type: 'enum', enum: UserRole })
  userRole: UserRole;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  balance: number;

  @Column({ type: 'varchar', length: 3, default: 'XOF' })
  currency: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany(() => WalletTransaction, (transaction) => transaction.wallet)
  transactions: WalletTransaction[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
