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
  REFUNDED = 'REFUNDED',
}

export enum OrderType {
  MERCHANT = 'MERCHANT', // Commande chez un marchand (panier d'articles)
  P2P_DELIVERY = 'P2P_DELIVERY', // Course à la demande (Point A vers Point B)
  DELIVERY = 'DELIVERY', // Legacy - pour compatibilité
  PICKUP = 'PICKUP', // Add for AnalyticsService
  RIDE = 'RIDE',
  EXPRESS = 'EXPRESS',
}

/**
 * 🚗 Options de confort pour FasoFree Ride
 */
export enum RideOption {
  ECONOMY = 'ECONOMY',       // Moto — tarif de base
  COMFORT = 'COMFORT',       // Moto premium / climatisé
  PREMIUM = 'PREMIUM',       // VTC / Berline — climatisé, espace
}

/**
 * 📦 Type de fulfillment (mode de retrait)
 */
export enum FulfillmentType {
  DELIVERY = 'DELIVERY', // Livraison à domicile
  PICKUP = 'PICKUP', // Click & Collect (À emporter)
  DINE_IN = 'DINE_IN', // Consommation sur place / Réservation
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

  @Column({ type: 'enum', enum: OrderType, default: OrderType.MERCHANT })
  orderType: OrderType;

  @Column({
    type: 'enum',
    enum: FulfillmentType,
    default: FulfillmentType.DELIVERY,
  })
  fulfillmentType: FulfillmentType;

  // 🚗 Option de confort FasoFree Ride (ECONOMY / COMFORT / PREMIUM)
  // Nullable pour les commandes non-RIDE (MERCHANT, P2P_DELIVERY)
  @Column({ type: 'varchar', length: 20, nullable: true })
  rideOption?: RideOption | null;

  @Column({ type: 'jsonb', nullable: true })
  fulfillmentDetails?: {
    tableNumber?: string;
    reservationTime?: string;
    numberOfGuests?: number;
    notes?: string;
  };

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

  // --- 🧾 VENTILATION FINANCIÈRE (Modèle hybride FasoFree) ---
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: { to: (v) => v, from: (v) => parseFloat(v) },
  })
  itemsTotal: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: { to: (v) => v, from: (v) => parseFloat(v) },
  })
  serviceFee: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: { to: (v) => v, from: (v) => parseFloat(v) },
  })
  merchantCommissionAmount: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: { to: (v) => v, from: (v) => parseFloat(v) },
  })
  driverCommissionAmount: number;

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

  // --- 🚚 P2P DELIVERY FIELDS (Course à la demande) ---
  @Column({ type: 'jsonb', nullable: true })
  pickupLocation?: {
    address: string;
    latitude: number;
    longitude: number;
    contactName: string;
    contactPhone: string;
    instructions?: string;
  };

  @Column({ type: 'jsonb', nullable: true })
  dropoffLocation?: {
    address: string;
    latitude: number;
    longitude: number;
    contactName: string;
    contactPhone: string;
    instructions?: string;
  };

  @Column({ type: 'jsonb', nullable: true })
  packageDetails?: {
    description?: string;
    isFragile?: boolean;
    weight?: number; // en kg
    dimensions?: {
      length?: number;
      width?: number;
      height?: number;
    };
  };

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

  // --- 📨 TRACKING DISPATCH ---
  @Column({ type: 'jsonb', nullable: true })
  dispatchCandidates?: Array<{
    driverId: string;
    score: number;
    notifiedAt: Date;
  }>;

  @Column({ type: 'timestamp', nullable: true })
  dispatchedAt: Date | null;

  // --- 🎫 QR CODE (PICKUP / DINE_IN) ---
  @Column({ type: 'varchar', length: 32, nullable: true, unique: true })
  qrCode: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
