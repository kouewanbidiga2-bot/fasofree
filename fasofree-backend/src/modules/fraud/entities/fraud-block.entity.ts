import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * 🚫 Blocage anti-fraude (temporaire).
 *
 * Enregistre une règle qui a bloqué un compte : qui, quand, pourquoi,
 * combien de commandes sur quelle fenêtre, et jusqu'à quand.
 * Levée manuelle possible par le Super Admin (releasedAt/releasedBy).
 */
@Entity('fraud_blocks')
@Index(['blockedUntil'])
export class FraudBlock {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // 🔑 Compte bloqué (varchar : aligné sur orders.clientId / wallets.userId)
  @Column({ type: 'varchar', nullable: true })
  @Index()
  userId: string | null;

  // 📞 Numéro du compte au moment du blocage (traçabilité / revue manuelle)
  @Column({ type: 'varchar', nullable: true })
  @Index()
  phone: string | null;

  // Ex. 'ORDERS_BURST', 'MULTI_ACCOUNT'
  @Column({ type: 'varchar' })
  rule: string;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ type: 'int', nullable: true })
  orderCount: number | null;

  @Column({ type: 'int', nullable: true })
  windowMinutes: number | null;

  @Column({ type: 'timestamp' })
  blockedUntil: Date;

  @Column({ type: 'timestamp', nullable: true })
  releasedAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  releasedBy: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
