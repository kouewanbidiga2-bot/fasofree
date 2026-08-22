import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsNumber, Min, Max } from 'class-validator';

export class UpdateSettingsDto {
  @ApiPropertyOptional({ example: 100, description: 'Frais de plateforme (FCFA)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  platformFee?: number;

  @ApiPropertyOptional({ description: 'Tarifs livraison par véhicule (JSON)' })
  @IsOptional()
  deliveryPricing?: Record<string, { baseFee: number; ratePerKm: number }>;

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
