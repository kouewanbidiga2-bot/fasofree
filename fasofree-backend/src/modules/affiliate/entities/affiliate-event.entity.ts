import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum AffiliateEventType {
  CLICK = 'CLICK',
  SIGNUP = 'SIGNUP',
  ORDER = 'ORDER',
}

/**
 * 📊 Événement de suivi affilié.
 *
 * Chaque passage par un lien de suivi génère un événement :
 * - CLICk : le lien court a été ouvert
 * - SIGNUP : un client s'est inscrit via le lien
 * - ORDER  : un client issu du lien a commandé chez le commerce
 *
 * C'est la source du funnel (clics → clients → commandes → revenus).
 */
@Entity('affiliate_events')
@Index(['businessId', 'type'])
@Index(['linkId', 'type'])
export class AffiliateEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  linkId: string | null;

  @Column({ type: 'uuid' })
  @Index()
  businessId: string;

  @Column({ type: 'enum', enum: AffiliateEventType })
  type: AffiliateEventType;

  // Client concerné (null pour un simple clic anonyme)
  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ type: 'uuid', nullable: true })
  orderId: string | null;

  // Montant de la commande pour un événement ORDER
  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  amount: number | null;

  @CreateDateColumn()
  createdAt: Date;
}
