import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

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
}
