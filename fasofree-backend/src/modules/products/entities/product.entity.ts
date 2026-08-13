import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Business } from '../../businesses/entities/business.entity';

@Entity('products')
export class Product {
  // 🔑 IDENTIFIANTS
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  businessId: string;

  @ManyToOne(() => Business, (business) => business.products, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'businessId' })
  business: Business;

  // 📝 INFORMATIONS DE BASE
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'varchar', length: 100, default: 'GÉNÉRAL' })
  category: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  imageUrl: string;

  // ⚙️ ÉTAT ET DISPONIBILITÉ
  @Column({ type: 'boolean', default: true })
  isAvailable: boolean;

  // 📦 GESTION DU STOCK (Module Analytics & Inventaire)
  @Column({ type: 'boolean', default: true })
  trackStock: boolean;

  @Column({ type: 'int', default: 0 })
  stockQuantity: number;

  // ⏱️ HORODATAGE
  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;
}
