import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * ⚖️ Niveaux de pénalité qualité (bloc C — échelle à 3 crans).
 *
 * 1. WARNING            → avertissement (trace, aucune conséquence technique)
 * 2. PRIORITY_DOWNGRADE → baisse de priorité au dispatch (le livreur / l'agence
 *                         est servi après les autres, sans être exclu)
 * 3. SUSPENSION         → suspension temporaire (exclu du dispatch jusqu'à
 *                         `effectiveUntil`)
 *
 * Les niveaux sont **cumulatifs dans le temps** : un avertissement non suivi
 * d'amélioration est escaladé manuellement par l'administration.
 */
export enum DeliveryPenaltyLevel {
  WARNING = 'WARNING',
  PRIORITY_DOWNGRADE = 'PRIORITY_DOWNGRADE',
  SUSPENSION = 'SUSPENSION',
}

/** Cible de la sanction : un livreur, ou une société de livraison. */
export enum DeliveryPenaltyTarget {
  DRIVER = 'DRIVER',
  AGENCY = 'AGENCY',
}

/**
 * ⚖️ Pénalité qualité (bloc C).
 *
 * Une pénalité est **datée et réversible** : rien n'est supprimé de
 * l'historique, on désactive (`active = false`) ou on borne dans le temps
 * (`effectiveUntil`). C'est volontaire : un livreur ou une société doit
 * pouvoir contester et l'administration doit pouvoir revenir en arrière.
 *
 * Le niveau WARNING est créé **automatiquement** à chaque livraison en retard
 * (une seule fois par commande), les niveaux supérieurs restent une décision
 * humaine — « note + litige » ne suffisent pas à suspendre quelqu'un.
 */
@Entity('delivery_penalties')
export class DeliveryPenalty {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** DRIVER (livreur interne) ou AGENCY (société de livraison) */
  @Column({ type: 'varchar', length: 16 })
  targetType: DeliveryPenaltyTarget;

  /** Livreur sanctionné (si targetType = DRIVER) */
  @Column({ type: 'uuid', nullable: true })
  @Index()
  driverId: string | null;

  /** Société sanctionnée (si targetType = AGENCY) */
  @Column({ type: 'uuid', nullable: true })
  @Index()
  agencyId: string | null;

  /** Commande à l'origine de la sanction (traçabilité) */
  @Column({ type: 'uuid', nullable: true })
  orderId: string | null;

  @Column({ type: 'varchar', length: 24 })
  level: DeliveryPenaltyLevel;

  /** Motif lisible (jamais de contenu client confidentiel) */
  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ type: 'timestamp', default: () => 'now()' })
  effectiveFrom: Date;

  /** null = jusqu'à révocation explicite (valable pour WARNING) */
  @Column({ type: 'timestamp', nullable: true })
  effectiveUntil: Date | null;

  /** false = révoquée / purgée (conservée pour l'historique) */
  @Column({ type: 'boolean', default: true })
  @Index()
  active: boolean;

  /** Compte administrateur auteur de la décision (null = automatique) */
  @Column({ type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
