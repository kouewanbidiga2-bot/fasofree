import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import type { Point } from 'typeorm'; // 💡 'import type' résout l'erreur TS1272
import { Product } from '../../products/entities/product.entity';

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

  @Column({ type: 'uuid', nullable: true })
  ownerId: string | null;

  // 🏷️ Catégorie du commerce (Multi-Secteurs)
  @Column({
    type: 'enum',
    enum: BusinessCategory,
    default: BusinessCategory.RESTAURANT,
  })
  category: BusinessCategory;

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
  @Column({ type: 'float', nullable: true })
  latitude?: number;

  @Column({ type: 'float', nullable: true })
  longitude?: number;

  @Column({ type: 'boolean', default: true })
  isOpen: boolean;

  // Relation : Un Business possède plusieurs Produits
  @OneToMany(() => Product, (product) => product.business)
  products: Product[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
