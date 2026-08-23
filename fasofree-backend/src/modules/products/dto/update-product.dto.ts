import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class UpdateProductDto {
  @ApiPropertyOptional({ example: 'Poulet bicyclette' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional({ example: 'Poulet grillé accompagné de riz.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 2500, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsPositive()
  price?: number;

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

  @ApiPropertyOptional({ example: 'plat' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ example: 'PLT-001' })
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isAvailable?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  trackInventory?: boolean;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @ValidateIf((o) => o.trackInventory === true)
  stockQuantity?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  minStockAlert?: number;
}
