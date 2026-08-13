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

  // 🌍 MOTEUR SPATIAL (PostGIS)
  @Column({
    type: 'geometry',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  location: Point;

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
