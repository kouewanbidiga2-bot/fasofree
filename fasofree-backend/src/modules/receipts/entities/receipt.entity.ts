import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum ReceiptType {
  TOPUP = 'TOPUP', // Recharge de portefeuille
  ORDER_PAYMENT = 'ORDER_PAYMENT', // Paiement de commande
  DELIVERY_FEE = 'DELIVERY_FEE', // Gain de livraison (prestataire)
  PAYOUT = 'PAYOUT', // Retrait / virement
}

export enum ReceiptStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

/**
 * 🧾 Reçu de transaction FasoFree.
 * Généré automatiquement pour le client (acheteur) et le prestataire
 * (marchand / livreur) à chaque mouvement financier validé.
 */
@Entity('receipts')
export class Receipt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 40, unique: true })
  @Index()
  receiptNumber: string;

  @Column({ type: 'enum', enum: ReceiptType })
  type: ReceiptType;

  @Column({
    type: 'enum',
    enum: ReceiptStatus,
    default: ReceiptStatus.COMPLETED,
  })
  status: ReceiptStatus;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: { to: (v) => v, from: (v) => parseFloat(v) },
  })
  amount: number;

  @Column({ type: 'varchar', nullable: true })
  @Index()
  reference: string; // MOCK-TX-... / paymentTransactionRef / orderId

  @Column({ type: 'text', nullable: true })
  description: string;

  // 🧑 Bénéficiaires / parties impliquées
  @Column({ type: 'uuid', nullable: true })
  @Index()
  clientUserId: string | null;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  merchantUserId: string | null;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  driverUserId: string | null;

  @Column({ type: 'uuid', nullable: true })
  businessId: string | null;

  @Column({ type: 'uuid', nullable: true })
  walletTransactionId: string | null;

  @Column({ type: 'uuid', nullable: true })
  orderId: string | null;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: { to: (v) => v, from: (v) => (v === null ? null : parseFloat(v)) },
  })
  balanceAfter: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
