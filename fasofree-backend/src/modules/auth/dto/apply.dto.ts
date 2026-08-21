import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsIn,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { NotificationChannel, VehicleCategory } from '../../users/entities/user.entity';
import { IsBurkinaPhone } from '../validators/is-burkina-phone.validator';
import { IsDisposableEmail } from '../validators/disposable-email.validator';

export const APPLICANT_ROLES = ['MERCHANT', 'DRIVER'] as const;

/**
 * 🚦 Candidature publique à un compte Marchand (MERCHANT) ou Livreur (DRIVER).
 * Endpoint : POST /auth/apply (multipart/form-data).
 * Les fichiers KYC (pièce d'identité, permis, carte grise) sont envoyés
 * séparément dans les mêmes champs que les documents : identityCard,
 * driverLicense, vehicleRegistration.
 */
export class ApplyDto {
  @ApiProperty({ example: 'Aminata Ouédraogo' })
  @IsString()
  @MinLength(2)
  fullName: string;

  @ApiProperty({ example: 'marchand@fasofree.bf' })
  @IsEmail({}, { message: 'Adresse email invalide' })
  @IsDisposableEmail({ message: 'Les adresses email temporaires ne sont pas autorisées' })
  email: string;

  @ApiProperty({ example: '+22670000000' })
  @IsBurkinaPhone({ message: 'Numéro de téléphone Burkina Faso invalide. Format: +226XXXXXXXX ou 8 chiffres' })
  phone: string;

  @ApiProperty({ example: 'MotDePasseFort123!' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ enum: APPLICANT_ROLES, example: 'MERCHANT' })
  @IsIn(APPLICANT_ROLES)
  role: 'MERCHANT' | 'DRIVER';

  // ─── Profil COMMERCE (obligatoire pour MERCHANT) ────────────────────────
  @ApiPropertyOptional({ example: 'Restaurant Faso Délices' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  businessName?: string;

  @ApiPropertyOptional({ example: 'Avenue Kwame Nkrumah, Ouagadougou' })
  @IsOptional()
  @IsString()
  @MinLength(5)
  businessAddress?: string;

  @ApiPropertyOptional({
    enum: ['RESTAURANT', 'SUPERMARKET', 'PHARMACY', 'RETAIL', 'BAKERY', 'SERVICES'],
    example: 'RESTAURANT',
  })
  @IsOptional()
  @IsIn(['RESTAURANT', 'SUPERMARKET', 'PHARMACY', 'RETAIL', 'BAKERY', 'SERVICES'])
  businessCategory?: string;

  @ApiPropertyOptional({ example: 12.3714 })
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional({ example: -1.5197 })
  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  longitude?: number;

  // ─── Profil LIVREUR ─────────────────────────────────────────────────────
  @ApiPropertyOptional({ example: 'MOTO' })
  @IsOptional()
  @IsString()
  vehicleType?: string;

  @ApiPropertyOptional({ example: 'BF123456' })
  @IsOptional()
  @IsString()
  driverLicenseNumber?: string;

  @ApiPropertyOptional({ example: true, description: 'Véhicule climatisé (pour FasoFree Ride)' })
  @IsOptional()
  hasAirConditioning?: boolean;

  @ApiPropertyOptional({ enum: Object.values(VehicleCategory), example: 'BERLINE', description: 'Catégorie du véhicule (BERLINE / SUV / PREMIUM)' })
  @IsOptional()
  @IsString()
  vehicleCategory?: string;

  @ApiPropertyOptional({ example: 'AMINATA-7F3A' })
  @IsOptional()
  @IsString()
  referralCode?: string;

  @ApiPropertyOptional({ enum: NotificationChannel, example: 'EMAIL', description: 'Canal de notification préféré' })
  @IsOptional()
  @IsEnum(NotificationChannel)
  preferredNotificationChannel?: NotificationChannel;
}
