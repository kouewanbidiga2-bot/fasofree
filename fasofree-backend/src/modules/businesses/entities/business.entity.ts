import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import type { Point } from 'typeorm'; // 💡 'import type' résout l'erreur TS1272
import { Product } from '../../products/entities/product.entity';
import { Brand } from '../../brands/entities/brand.entity';
import { User } from '../../users/entities/user.entity';
import { MobileMoneyProvider } from '../../users/entities/user.entity';

/**
 * 🏪 Catégories de commerces (Multi-Secteurs)
 */
export enum BusinessCategory {
  RESTAURANT = 'RESTAURANT',
  SUPERMARKET = 'SUPERMARKET',
  PHARMACY = 'PHARMACY',
  RETAIL = 'RETAIL',
  BAKERY = 'BAKERY',
  SERVICES = 'SERVICES',
}

// ─── 🕐 Horaires d'ouverture (bloc H) ──────────────────────────────────

/** Clés des jours de la semaine, en minuscules (format `Intl.DateTimeFormat`). */
export type BusinessOpeningDay =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

/** Horaires d'un jour : `null` (ou jour absent) = fermé ce jour-là. */
export interface BusinessDayHours {
  /** "HH:MM" (24 h) */
  open: string;
  /** "HH:MM" (24 h) — peut être < `open` pour un service de nuit. */
  close: string;
}

/**
 * Horaires récurrents hebdomadaires. Un jour absent = fermé.
 * L'ordre des clés n'a pas d'importance.
 */
export type BusinessOpeningHours = Partial<
  Record<BusinessOpeningDay, BusinessDayHours>
>;

/** Jours dans l'ordre d'affichage (lundi → dimanche). */
export const BUSINESS_OPENING_DAYS: { key: BusinessOpeningDay; label: string }[] = [
  { key: 'monday', label: 'Lundi' },
  { key: 'tuesday', label: 'Mardi' },
  { key: 'wednesday', label: 'Mercredi' },
  { key: 'thursday', label: 'Jeudi' },
  { key: 'friday', label: 'Vendredi' },
  { key: 'saturday', label: 'Samedi' },
  { key: 'sunday', label: 'Dimanche' },
];

// ─── 📅 Commandes à l'avance (bloc H) ─────────────────────────────────

export interface BusinessAdvanceOrderConfig {
  /** Interdire (`false`) ou autoriser la commande à l'avance. */
  enabled: boolean;
  /** Délai minimum en heures entre la commande et la livraison (ex. 2). */
  minHoursAhead: number;
  /** Délai maximum en jours (ex. 7). */
  maxDaysAhead: number;
}

@Entity('businesses')
export class Business {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'varchar', length: 255 })
  address: string;

  @Column({ type: 'varchar', length: 20 })
  phone: string;

  // 💰 NUMERO MOBILE MONEY DEDIE AUX PAIEMENTS MARCHANDS (retraits)
  @Column({ type: 'varchar', length: 20, nullable: true })
  mobileMoneyNumber?: string | null;

  @Column({
    type: 'enum',
    enum: MobileMoneyProvider,
    nullable: true,
  })
  mobileMoneyProvider?: MobileMoneyProvider | null;

  @Column({ type: 'uuid', nullable: true })
  ownerId: string | null;

  // 🔗 Clé étrangère vers le compte utilisateur propriétaire
  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'ownerId' })
  owner: User;

  // 🏷️ Catégorie du commerce (Multi-Secteurs)
  @Column({
    type: 'enum',
    enum: BusinessCategory,
    default: BusinessCategory.RESTAURANT,
  })
  category: BusinessCategory;

  // 🏷️ Sous-catégorie (niveau 2) : « Fast-Food », « Cuisine Locale », « Épicerie »…
  //    Voir BUSINESS_CATALOG (constants/business-catalog.ts) pour la liste valide.
  @Column({ type: 'varchar', length: 60, nullable: true })
  subCategory?: string | null;

  // ⚙️ Configuration des modes de commande
  @Column({ type: 'boolean', default: true })
  enableDelivery: boolean; // Livraison

  @Column({ type: 'boolean', default: true })
  enablePickup: boolean; // Click & Collect (À emporter)

  @Column({ type: 'boolean', default: false })
  enableDineIn: boolean; // Consommation sur place / Réservations

  @Column({ type: 'boolean', default: false })
  hasOwnDrivers: boolean; // Utilise ses propres livreurs (pas de dispatch FasoFree)

  // 🌍 MOTEUR SPATIAL (PostGIS)
  @Column({
    type: 'geometry',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  location: Point;

  // 📍 Coordonnées GPS simples (utilisées par le Dispatch)
  @Column({ type: 'double precision', nullable: true })
  latitude?: number;

  @Column({ type: 'double precision', nullable: true })
  longitude?: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  logo: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  coverImage: string | null;

  @Column({ type: 'boolean', default: true })
  isOpen: boolean;

  /**
   * 🕐 Horaires d'ouverture récurrents (bloc H), par jour de la semaine.
   *
   * Pourquoi jsonb et non 14 colonnes : les horaires sont une donnée
   * pilotée par le marchand, qui peut ne rien renseigner (le commerce
   * reste alors piloté par le seul `isOpen`, comme avant). Un schéma
   * rigide aurait imposé 14 colonnes NOT NULL sans apporter la souplesse
   * nécessaire (jour fermé, horaires différents le week-end).
   *
   * `null` = horaires non renseignés → `isOpen` décide seul (rétro-compatible).
   */
  @Column({ type: 'jsonb', nullable: true })
  openingHours?: BusinessOpeningHours | null;

  /**
   * 📅 Configuration des commandes à l'avance (bloc H).
   * `null` = fonctionnalité non configurée → commande à l'avance refusée.
   */
  @Column({ type: 'jsonb', nullable: true })
  advanceOrderConfig?: BusinessAdvanceOrderConfig | null;

  // 🏷️ Raccordement multi-agences : marque (Brand) à laquelle appartient l'agence
  @Column({ type: 'uuid', nullable: true })
  brandId: string | null;

  @ManyToOne(() => Brand, (brand) => brand.businesses, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'brandId' })
  brand: Brand;

  // Relation : Un Business possède plusieurs Produits
  @OneToMany(() => Product, (product) => product.business)
  products: Product[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
