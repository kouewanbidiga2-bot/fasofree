import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsNumber,
  IsObject,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { BusinessCategory } from '../entities/business.entity';
import {
  BusinessAdvanceOrderConfig,
  BusinessOpeningHours,
} from '../entities/business.entity';
import { MobileMoneyProvider } from '../../users/entities/user.entity';

export class UpdateBusinessDto {
  @ApiPropertyOptional({ description: 'Nom du commerce' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Adresse' })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({ description: 'Téléphone' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({
    enum: BusinessCategory,
    description: 'Catégorie du commerce',
  })
  @IsEnum(BusinessCategory)
  @IsOptional()
  category?: BusinessCategory;

  @ApiPropertyOptional({
    description:
      'Sous-catégorie (niveau 2) : Fast-Food, Cuisine Locale, Épicerie…',
    example: 'Fast-Food',
  })
  @IsString()
  @MaxLength(60)
  @IsOptional()
  subCategory?: string;

  @ApiPropertyOptional({ description: 'Activer la livraison' })
  @IsBoolean()
  @IsOptional()
  enableDelivery?: boolean;

  @ApiPropertyOptional({ description: 'Activer Click & Collect' })
  @IsBoolean()
  @IsOptional()
  enablePickup?: boolean;

  @ApiPropertyOptional({ description: 'Activer consommation sur place' })
  @IsBoolean()
  @IsOptional()
  enableDineIn?: boolean;

  @ApiPropertyOptional({ description: 'Utiliser ses propres livreurs' })
  @IsBoolean()
  @IsOptional()
  hasOwnDrivers?: boolean;

  @ApiPropertyOptional({ description: "Statut d'ouverture" })
  @IsBoolean()
  @IsOptional()
  isOpen?: boolean;

  // 🕐 Bloc H — horaires récurrents hebdomadaires.
  // `null` (ou absence) = non renseigné → `isOpen` décide seul, comme avant.
  // Un jour absent de l'objet = fermé ce jour-là.
  @ApiPropertyOptional({
    description:
      'Horaires d\u2019ouverture récurrents. Un jour absent = fermé. close < open = service de nuit.',
    example: {
      monday: { open: '08:00', close: '22:00' },
      saturday: { open: '09:00', close: '14:00' },
    },
  })
  @IsOptional()
  @IsObject()
  openingHours?: BusinessOpeningHours | null;

  // 📅 Bloc H — commandes à l'avance, pilotées par le commerce.
  @ApiPropertyOptional({
    description:
      'Configuration des commandes à l\u2019avance. null = fonctionnalité non configurée (refusée).',
    example: { enabled: true, minHoursAhead: 2, maxDaysAhead: 7 },
  })
  @IsOptional()
  @IsObject()
  advanceOrderConfig?: BusinessAdvanceOrderConfig | null;

  @ApiPropertyOptional({ description: 'Latitude' })
  @IsNumber()
  @IsOptional()
  latitude?: number;

  @ApiPropertyOptional({ description: 'Longitude' })
  @IsNumber()
  @IsOptional()
  longitude?: number;

  @ApiPropertyOptional({ description: 'Marque (Brand) de rattachement' })
  @IsUUID()
  @IsOptional()
  brandId?: string;

  @ApiPropertyOptional({ description: 'URL du logo du commerce' })
  @IsString()
  @IsOptional()
  logo?: string;

  @ApiPropertyOptional({ description: "URL de l'image de couverture" })
  @IsString()
  @IsOptional()
  coverImage?: string;

  @ApiPropertyOptional({ description: 'Numero Mobile Money pour les retraits' })
  @IsString()
  @IsOptional()
  mobileMoneyNumber?: string;

  @ApiPropertyOptional({ enum: MobileMoneyProvider, description: 'Operateur Mobile Money' })
  @IsEnum(MobileMoneyProvider)
  @IsOptional()
  mobileMoneyProvider?: MobileMoneyProvider;
}
