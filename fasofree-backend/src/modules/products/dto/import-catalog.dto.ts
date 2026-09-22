import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

// ─── Structure retournée par Gemini ──────────────────────────────────────────

export class ImportProductDto {
  @ApiProperty({ example: 'Tiep djené' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Riz brun avec sauce gombo' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 1500 })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  @Max(100000)
  price: number;

  @ApiPropertyOptional({ example: 'Plats principaux' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: 'plat' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/tiep.jpg' })
  @IsOptional()
  @IsString()
  imageUrl?: string;
}

export class ImportCategoryDto {
  @ApiProperty({ example: 'Plats principaux' })
  @IsString()
  name: string;

  @ApiProperty({ type: [ImportProductDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportProductDto)
  products: ImportProductDto[];
}

export class CatalogImportResultDto {
  @ApiProperty({ example: 'Chez Tanti' })
  @IsString()
  businessName: string;

  @ApiProperty({ type: [ImportCategoryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportCategoryDto)
  categories: ImportCategoryDto[];

  @ApiPropertyOptional({ example: 'https://cdn.example.com/logo.png' })
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiProperty({ example: 12 })
  @IsNumber()
  totalProducts: number;
}

// ─── DTO pour confirmer l'import ─────────────────────────────────────────────

export class ConfirmImportDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  businessId: string;

  @ApiProperty({ type: [ImportCategoryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportCategoryDto)
  categories: ImportCategoryDto[];

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  setAvailable?: boolean;
}
