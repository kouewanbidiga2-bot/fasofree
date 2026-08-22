import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Order } from '../../orders/entities/order.entity';

export enum PaymentMethod {
  ORANGE_MONEY = 'orange_money',
  MOOV_MONEY = 'moov_money',
  TELECEL_MONEY = 'telecel_money',
  CARD = 'card',
  CASH = 'cash',
}

export enum TransactionStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
  REFUND_PENDING = 'refund_pending',
  REFUNDED = 'refunded',
}

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // 🆔 Référence unique générée par notre système pour l'agrégateur
  @Column({ type: 'varchar', unique: true })
  reference: string;

  // 🆔 Identifiant fourni en retour par l'agrégateur (ex: CinetPay/LigdiCash)
  @Column({ type: 'varchar', nullable: true })
  paymentGatewayId: string;

  // 💳 Mode de paiement utilisé
  @Column({
    type: 'enum',
    enum: PaymentMethod,
    default: PaymentMethod.ORANGE_MONEY,
  })
  paymentMethod: PaymentMethod;

  // 💰 Montant brut réglé
  @Column({ type: 'numeric', precision: 10, scale: 2 })
  amount: number;

  // 💵 Commission FasoFree (1.5%)
  @Column({ type: 'numeric', precision: 10, scale: 2 })
  commissionAmount: number;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.PENDING,
  })
  status: TransactionStatus;

  @OneToOne(() => Order, (order) => order.transaction)
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column({ type: 'uuid' })
  orderId: string;

  @CreateDateColumn()
  processedAt: Date;
}
