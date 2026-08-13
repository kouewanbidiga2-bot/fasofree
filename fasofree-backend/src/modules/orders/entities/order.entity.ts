import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
  OneToOne,
} from 'typeorm';
import { OrderItem } from './order-item.entity';
import { Transaction } from '../../payments/entities/transaction.entity';

export enum OrderStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  IN_PREPARATION = 'IN_PREPARATION', // Add for PaymentsService
  PROCESSING = 'PROCESSING',
  DELIVERED_PENDING_CONFIRMATION = 'DELIVERED_PENDING_CONFIRMATION',
  DELIVERED = 'DELIVERED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  FAILED = 'FAILED',
  DISPUTED = 'DISPUTED',
}

export enum OrderType {
  DELIVERY = 'DELIVERY',
  PICKUP = 'PICKUP', // Add for AnalyticsService
  RIDE = 'RIDE',
  EXPRESS = 'EXPRESS',
}

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar' })
  clientId: string;

  @Index()
  @Column({ type: 'varchar', nullable: true })
  businessId: string;

  @Column({ type: 'enum', enum: OrderType, default: OrderType.DELIVERY })
  orderType: OrderType;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PENDING })
  status: OrderStatus;

  // --- 💰 COLONNES FINANCIÈRES ---
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: { to: (v) => v, from: (v) => parseFloat(v) },
  })
  productsSubtotal: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: { to: (v) => v, from: (v) => parseFloat(v) },
  })
  deliveryFee: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: { to: (v) => v, from: (v) => parseFloat(v) },
  })
  totalAmount: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: { to: (v) => v, from: (v) => parseFloat(v) },
  })
  platformCommission: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: { to: (v) => v, from: (v) => parseFloat(v) },
  })
  merchantPayoutAmount: number;

  @Column({ type: 'varchar', length: 32, nullable: true })
  promotionCode: string | null;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: { to: (v) => v, from: (v) => parseFloat(v) },
  })
  promotionDiscount: number;

  @Column({ type: 'varchar', default: 'CLIENT' })
  commissionPayer: string;

  @Column({ type: 'varchar', nullable: true })
  paymentMethod?: string; // Add for PaymentsService

  // --- 📍 GPS & TRANSACTIONS ---
  @Column({ type: 'jsonb', nullable: true })
  deliveryLocation?: { latitude: number; longitude: number };

  @Column({ type: 'varchar', nullable: true })
  paymentTransactionRef: string | null;

  // --- 🔗 RELATIONS REQUISES PAR ORDER-ITEM ET TRANSACTION ---
  @OneToMany(() => OrderItem, (item) => item.order)
  items: OrderItem[];

  @OneToOne(() => Transaction, (transaction) => transaction.order)
  transaction: Transaction;

  // --- 📌 CODE PIN DE LIVRAISON ---
  @Column({ type: 'varchar', length: 4, nullable: true })
  deliveryPinCode: string | null;

  // --- ✅ DOUBLE VALIDATION ---
  @Column({ type: 'timestamp', nullable: true })
  driverValidatedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  clientValidatedAt: Date | null;

  // --- 🚚 ASSIGNATION LIVREUR/COURSIER ---
  @Column({ type: 'varchar', nullable: true })
  @Index()
  driverId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
