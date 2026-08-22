import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsNumber,
  IsObject,
  IsUUID,
} from 'class-validator';
import { BusinessCategory } from '../entities/business.entity';
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

  @ApiPropertyOptional({ description: 'Numero Mobile Money pour les retraits' })
  @IsString()
  @IsOptional()
  mobileMoneyNumber?: string;

  @ApiPropertyOptional({ enum: MobileMoneyProvider, description: 'Operateur Mobile Money' })
  @IsEnum(MobileMoneyProvider)
  @IsOptional()
  mobileMoneyProvider?: MobileMoneyProvider;
}
