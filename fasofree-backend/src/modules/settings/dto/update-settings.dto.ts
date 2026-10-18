import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsNumber, Min, Max, IsArray, IsIn, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ALL_CATEGORY_VALUES } from '../../businesses/constants/business-catalog';

export class DeliveryTierDto {
  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  minKm?: number;

  @ApiPropertyOptional({ example: 15, description: 'null pour le dernier palier (illimite)' })
  @IsOptional()
  maxKm?: number | null;

  @ApiPropertyOptional({ example: 1750, description: 'Prix fixe du palier en FCFA' })
  @IsInt()
  @Min(0)
  price: number;

  @ApiPropertyOptional({ example: '0-15 km' })
  @IsOptional()
  label?: string;
}

/**
 * 💳 Grille tarifaire des campagnes push auto-service (FCFA PAR ENVOI).
 *
 * `ALL_CLIENTS` vise toute la base client FasoFree : volontairement bien plus
 * cher que les audiences de proximité, pour que le spam ne soit pas rentable.
 * Géré par le Super Admin depuis « Paramètres de la plateforme ».
 */
export class PushCampaignPricingDto {
  @ApiPropertyOptional({
    example: 100,
    description: 'Campagne vers MES clients (FCFA par envoi)',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  OWN_CLIENTS?: number;

  @ApiPropertyOptional({
    example: 100,
    description: 'Campagne vers MES livreurs (FCFA par envoi)',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  OWN_DRIVERS?: number;

  @ApiPropertyOptional({
    example: 2500,
    description: 'Campagne vers TOUS les clients FasoFree (FCFA par envoi)',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  ALL_CLIENTS?: number;
}

export class UpdateSettingsDto {
  @ApiPropertyOptional({ example: 100, description: 'Frais de plateforme (FCFA)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  platformFee?: number;

  @ApiPropertyOptional({ description: 'Tarifs livraison par véhicule (legacy, obsolète)' })
  @IsOptional()
  deliveryPricing?: Record<string, { baseFee: number; ratePerKm: number }>;

  @ApiPropertyOptional({ description: 'Tranches tarifaires livraison (paliers de distance)', type: [DeliveryTierDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DeliveryTierDto)
  deliveryTiers?: DeliveryTierDto[];

  @ApiPropertyOptional({ description: 'Tarifs FasoFree Ride par confort (JSON)' })
  @IsOptional()
  fasoRidePricing?: Record<string, { minFare: number; pricePerKm: number }>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enableScheduling?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enableBulkOrders?: boolean;

  @ApiPropertyOptional({ example: 15 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxDeliveryRadius?: number;

  @ApiPropertyOptional({ example: false, description: 'Activer les frais de retrait' })
  @IsOptional()
  @IsBoolean()
  isPayoutFeeActive?: boolean;

  @ApiPropertyOptional({ example: 1.5, description: 'Pourcentage de frais de retrait (0-100)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  payoutFeePercentage?: number;

  @ApiPropertyOptional({ example: 20000, description: 'Seuil en dessous duquel les frais sont gratuits (FCFA)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  payoutFreeThreshold?: number;

  @ApiPropertyOptional({ example: 1000, description: 'Montant minimum de retrait en FCFA' })
  @IsOptional()
  @IsInt()
  @Min(1)
  minWithdrawalAmountXof?: number;

  @ApiPropertyOptional({ example: false, description: 'Activer le Pass Stories (forfait 5000 FCFA/30j) — collaboration, suspendu par défaut' })
  @IsOptional()
  @IsBoolean()
  storiesPassEnabled?: boolean;

  @ApiPropertyOptional({
    example: ['RESTAURANT', 'SUPERMARKET', 'BAKERY', 'RETAIL', 'SERVICES'],
    description:
      'Verticales de commerces actives (catalogue 2 niveaux). Retirer une valeur l\'éteint partout : client, formulaires, filtres. Ex. retirer PHARMACY tant qu\'elle n\'est pas ouverte.',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsIn(ALL_CATEGORY_VALUES, { each: true })
  enabledBusinessCategories?: string[];

  @ApiPropertyOptional({
    description:
      'Tarifs des campagnes push auto-service (FCFA par envoi), par audience. ALL_CLIENTS (toute la base) doit rester nettement plus cher que les audiences de proximité.',
    type: PushCampaignPricingDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => PushCampaignPricingDto)
  pushCampaignPricing?: PushCampaignPricingDto;
}
