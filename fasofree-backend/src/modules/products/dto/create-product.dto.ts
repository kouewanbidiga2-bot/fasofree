import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  IsUUID,
  MinLength,
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
  @IsUrl()
  imageUrl?: string;
  @ApiPropertyOptional({ example: 'Plats' })
  @IsOptional()
  @IsString()
  category?: string; // Ex: 'Plats', 'Boissons', 'Épicerie'
  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isAvailable?: boolean; // Par défaut true
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  businessId: string;
}
