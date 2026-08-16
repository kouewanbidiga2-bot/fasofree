import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserRole } from './user-role.enum';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  fullName: string;

  @Column({ type: 'varchar', unique: true, length: 150 })
  email: string;

  @Column({ type: 'varchar', unique: true, length: 20 })
  phone: string;

  @Column({ nullable: true })
  fcmToken?: string;

  @Column({ type: 'varchar', length: 16, unique: true, nullable: true })
  referralCode: string | null;

  // 🛡️ SÉCURITÉ : select: false empêche le mot de passe hashé de fuiter dans les réponses JSON
  @Column({ type: 'varchar', select: false })
  passwordHash: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.CLIENT,
  })
  role: UserRole;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  // 🚚 CHAMPS LIVREUR / COURSIER (DISPATCH)
  @Column({ type: 'float', nullable: true })
  latitude?: number;

  @Column({ type: 'float', nullable: true })
  longitude?: number;

  @Column({ type: 'boolean', default: false })
  isOnline: boolean;

  @Column({ type: 'boolean', default: true })
  isAvailable: boolean;

  @Column({ type: 'float', nullable: true })
  averageRating?: number;

  // 🏍️ Type de véhicule du livreur (MOTO, SCOOTER, VTC, BICYCLE, FOOT, ...)
  // Utilisé par le dispatch pour préférer une moto/VTC sur les courses FasoFree Ride.
  @Column({ type: 'varchar', length: 20, nullable: true })
  vehicleType?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
