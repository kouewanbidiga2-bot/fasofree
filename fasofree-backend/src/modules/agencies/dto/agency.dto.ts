import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

/**
 * 🏢 Création d'une agence partenaire (Niveau 2 du dispatch).
 */
export class CreateAgencyDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  /** Villes couvertes (vide = national) */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  zones?: string[];

  /** Commission en % des frais de livraison (défaut 10) */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  commissionPct?: number;

  /** Courses simultanées max (0 = illimité) */
  @IsOptional()
  @IsInt()
  @Min(0)
  maxConcurrentDeliveries?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** Compte utilisateur AGENCY lié (optionnel) */
  @IsOptional()
  @IsUUID()
  userId?: string;
}

/**
 * ✏️ Mise à jour d'une agence (partielle).
 */
export class UpdateAgencyDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  zones?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  commissionPct?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxConcurrentDeliveries?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsUUID()
  userId?: string;
}
