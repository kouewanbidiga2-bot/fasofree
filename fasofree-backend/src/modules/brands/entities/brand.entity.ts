import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Business } from '../../businesses/entities/business.entity';

/**
 * 🏷️ Marque (Brand) : regroupe plusieurs agences (Business) sous une même enseigne.
 * Permet le routage des commandes vers l'agence la plus proche du client.
 */
@Entity('brands')
export class Brand {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  logoUrl: string | null;

  @Column({ type: 'uuid', nullable: true })
  ownerId: string | null;

  // Relation : une marque possède plusieurs agences (Business)
  @OneToMany(() => Business, (business) => business.brand)
  businesses: Business[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
