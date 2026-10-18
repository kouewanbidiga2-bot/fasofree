import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * 🏢 Agence de livraison partenaire (Niveau 2 du dispatch multi-niveaux).
 *
 * Une agence est une flotte locale partenaire : FasoFree lui route les
 * courses que son pool interne ne peut pas traiter (aucun livreur
 * disponible). L'agence assigne la course à SES chauffeurs depuis son
 * espace dédié, puis le déroulé habituel s'applique (le chauffeur est
 * un utilisateur DRIVER classique — validation livraison, PIN, paiements
 * inchangés).
 *
 * Commission : pourcentage configurable retenu sur les frais de livraison
 * (enregistré sur la commande dans `agencyCommissionXof` — l'intégration
 * dans le settlement marchand est une étape ultérieure documentée).
 */
@Entity('delivery_agencies')
export class DeliveryAgency {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  /** Contact téléphonique principal (WhatsApp/SMS) */
  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  email: string | null;

  // ─── 🎨 Identité visuelle (Lot 1) ──────────────────────────────
  // Ces champs servent à faire RECONNAÎTRE la société par le client et le
  // marchand : sans eux, une course livrée par une société tierce apparaissait
  // comme « une agence partenaire » anonyme, et FasoFree en récoltait le mérite.

  /** Logo de la société (URL). Affiché au client et au marchand. */
  @Column({ type: 'varchar', length: 500, nullable: true })
  logoUrl: string | null;

  /** Présentation libre de la société (services, zone, engagement…). */
  @Column({ type: 'text', nullable: true })
  description: string | null;

  /** Couleur de marque au format #RRGGBB (habillage des écrans d'attribution). */
  @Column({ type: 'varchar', length: 9, nullable: true })
  brandColor: string | null;

  /** Site web / vitrine de la société. */
  @Column({ type: 'varchar', length: 255, nullable: true })
  website: string | null;

  /** Société vérifiée par FasoFree — badge de confiance côté client. */
  @Column({ type: 'boolean', default: false })
  isVerified: boolean;

  /**
   * Villes couvertes (ex. ['Ouagadougou']).
   * null / tableau vide = couverture nationale.
   * Le matching se fait sur les adresses de ramassage/livraison.
   */
  @Column({ type: 'jsonb', nullable: true })
  zones: string[] | null;

  /** Commission de l'agence en % des frais de livraison (défaut 10 %) */
  @Column({ type: 'numeric', precision: 5, scale: 2, default: 10 })
  commissionPct: number;

  /** Courses simultanées max (0 = illimité) */
  @Column({ type: 'int', default: 0 })
  maxConcurrentDeliveries: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  /** Compte utilisateur AGENCY lié (optionnel — accès espace agence) */
  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
