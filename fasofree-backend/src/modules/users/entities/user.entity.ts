import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserRole } from './user-role.enum';

export enum NotificationChannel {
  EMAIL = 'EMAIL',
  WHATSAPP = 'WHATSAPP',
  SMS = 'SMS',
  PUSH = 'PUSH',
}

export enum VehicleType {
  BICYCLE = 'BICYCLE',
  MOTORCYCLE = 'MOTORCYCLE',
  CAR = 'CAR',
}

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

  @Column({ type: 'varchar', length: 500, nullable: true })
  avatarUrl?: string | null;

  @Column({
    type: 'enum',
    enum: NotificationChannel,
    default: NotificationChannel.EMAIL,
  })
  preferredNotificationChannel: NotificationChannel;

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

  // 🚦 ONBOARDING MARCHANDS & LIVREURS
  // Compte candidat créé via POST /auth/apply puis examiné par l'administration.
  @Column({ type: 'varchar', length: 20, nullable: true })
  applicationStatus?: string | null; // PENDING_APPROVAL | APPROVED | REJECTED

  @Column({ type: 'varchar', length: 20, nullable: true })
  applicationType?: string | null; // MERCHANT | DRIVER

  // 📦 Données de candidature (profil commerce / véhicule) au format JSON
  @Column({ type: 'jsonb', nullable: true })
  applicationData?: Record<string, any> | null;

  @Column({ type: 'uuid', nullable: true })
  reviewedBy?: string | null;

  @Column({ type: 'timestamp', nullable: true })
  reviewedAt?: Date | null;

  @Column({ type: 'text', nullable: true })
  rejectionReason?: string | null;

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

  // 🏍️ Type de véhicule du livreur (BICYCLE, MOTORCYCLE, CAR)
  // Utilisé par le dispatch pour préférer une moto/VTC sur les courses FasoFree Ride.
  @Column({ type: 'varchar', length: 20, nullable: true })
  vehicleType?: VehicleType | string;

  // 🔑 RÉINITIALISATION MOT DE PASSE
  @Column({ type: 'varchar', nullable: true, select: false })
  passwordResetToken?: string | null;

  @Column({ type: 'timestamp', nullable: true, select: false })
  passwordResetExpires?: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
