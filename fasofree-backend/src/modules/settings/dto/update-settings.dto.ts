import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsNumber, Min, Max, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

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
}
