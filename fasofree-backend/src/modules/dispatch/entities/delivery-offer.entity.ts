import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';

/**
 * 📣 États d'une offre d'appel d'offres (bloc A4).
 *
 * - PENDING  : l'agence a été notifiée, elle n'a pas encore répondu
 * - ACCEPTED : l'agence a accepté — « premier qui accepte gagne »
 * - REFUSED  : l'agence a explicitement refusé cette course
 * - EXPIRED  : la fenêtre de 5 min s'est écoulée sans réponse
 * - LOST     : une AUTRE agence a accepté avant (offre clôturée)
 */
export enum DeliveryOfferStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REFUSED = 'REFUSED',
  EXPIRED = 'EXPIRED',
  LOST = 'LOST',
}

/**
 * 📣 Appel d'offres multi-agences (Niveau 2 du dispatch).
 *
 * À T+0, FasoFree diffuse la course à **toutes** les agences éligibles
 * (au lieu d'en choisir une seule). La première agence qui accepte prend
 * la course : les offres concurrentes passent en `LOST`.
 *
 * La table est la source de vérité de l'appel d'offres ; la commande ne
 * porte que la fenêtre courante (`dispatchOfferExpiresAt`) et le tour
 * (`dispatchOfferRound`), ce qui garde le cron idempotent.
 *
 * Contrainte d'unicité (orderId, agencyId) : la re-diffusion du tour 2
 * (T+5) met à jour l'offre existante au lieu d'en créer une seconde.
 */
@Entity('delivery_offers')
@Unique('UQ_delivery_offers_order_agency', ['orderId', 'agencyId'])
export class DeliveryOffer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Commande faisant l'objet de l'appel d'offres */
  @Column({ type: 'uuid' })
  @Index()
  orderId: string;

  /** Agence destinataire de l'offre */
  @Column({ type: 'uuid' })
  @Index()
  agencyId: string;

  @Column({
    type: 'varchar',
    length: 16,
    default: DeliveryOfferStatus.PENDING,
  })
  status: DeliveryOfferStatus;

  /** Commission de l'agence au moment de l'offre (%) */
  @Column({ type: 'numeric', precision: 5, scale: 2, default: 10 })
  commissionPct: number;

  /** Montant de la commission pour cette course (FCFA) */
  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  agencyCommissionXof: number | null;

  /** Tour d'appel d'offres : 1 = T+0, 2 = re-diffusion (T+5) */
  @Column({ type: 'int', default: 1 })
  round: number;

  /** Fin de la fenêtre d'acceptation de cette offre */
  @Column({ type: 'timestamp' })
  expiresAt: Date;

  /** Horodatage de la réponse (acceptation ou refus) */
  @Column({ type: 'timestamp', nullable: true })
  respondedAt: Date | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
