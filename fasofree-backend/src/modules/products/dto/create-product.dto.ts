import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateProductDto {
  @ApiProperty({ example: 'Poulet bicyclette' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiPropertyOptional({ example: 'Poulet grillé accompagné de riz.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 2500, minimum: 0 })
  @Type(() => Number)
  @IsPositive()
  price: number;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/poulet.jpg',
    format: 'uri',
  })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ example: 'Plats' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: 'plat', description: 'Type de produit (plat, boisson, dessert...)' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ example: 'PLT-001', description: 'Référence SKU unique' })
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isAvailable?: boolean;

  @ApiPropertyOptional({ example: true, default: true, description: 'Activer la gestion du stock' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  trackInventory?: boolean;

  @ApiPropertyOptional({ example: 50, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @ValidateIf((o) => o.trackInventory === true)
  stockQuantity?: number;

  @ApiPropertyOptional({ example: 10, description: 'Seuil d\'alerte stock bas' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  minStockAlert?: number;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  businessId: string;
}
