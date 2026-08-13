import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  MinLength,
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
  @IsUrl()
  imageUrl?: string;
  @ApiPropertyOptional({ example: 'Plats' })
  @IsOptional()
  @IsString()
  category?: string;
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isAvailable?: boolean;
}
