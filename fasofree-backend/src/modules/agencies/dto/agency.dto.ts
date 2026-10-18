import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Regex des couleurs hexadécimales acceptées (#RGB ou #RRGGBB).
 * Volontairement stricte : une valeur libre finirait injectée dans un style
 * CSS côté client, mieux vaut la refuser à l'entrée (400 explicite).
 * La chaîne vide est ACCEPTÉE (groupe optionnel) : c'est ainsi qu'un admin
 * efface une couleur déjà définie — `cleanText` la convertit ensuite en null.
 * Sans cela, `@IsOptional()` ne sauterait pas la validation (il ne couvre que
 * null/undefined) et un formulaire vidé renverrait une erreur 400.
 */
const HEX_COLOR = /^(#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6})?$/;

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

  // ─── 🎨 Identité visuelle (Lot 1) — faire reconnaître la société ──
  /** Logo de la société (URL). 500 = longueur de la colonne. */
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'logoUrl ne peut pas dépasser 500 caractères.' })
  logoUrl?: string;

  /** Présentation libre de la société. */
  @IsOptional()
  @IsString()
  @MaxLength(2000, {
    message: 'description ne peut pas dépasser 2000 caractères.',
  })
  description?: string;

  /** Couleur de marque (#RGB ou #RRGGBB). */
  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR, {
    message: 'brandColor doit être une couleur hexadécimale (ex. #C1652E).',
  })
  brandColor?: string;

  /** Site web / vitrine de la société. 255 = longueur de la colonne. */
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'website ne peut pas dépasser 255 caractères.' })
  website?: string;

  /** Société vérifiée par FasoFree (badge de confiance). */
  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;

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

  // ─── 🎨 Identité visuelle (Lot 1) ─────────────────────────────
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'logoUrl ne peut pas dépasser 500 caractères.' })
  logoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000, {
    message: 'description ne peut pas dépasser 2000 caractères.',
  })
  description?: string;

  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR, {
    message: 'brandColor doit être une couleur hexadécimale (ex. #C1652E).',
  })
  brandColor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'website ne peut pas dépasser 255 caractères.' })
  website?: string;

  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;

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
