import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  Min,
  Max,
  MaxLength,
  IsObject,
  ValidateNested,
} from 'class-validator';

export class PackageDimensionsDto {
  @ApiPropertyOptional({
    description: 'Longueur en cm',
    example: 30,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(200)
  length?: number;

  @ApiPropertyOptional({
    description: 'Largeur en cm',
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(200)
  width?: number;

  @ApiPropertyOptional({
    description: 'Hauteur en cm',
    example: 15,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(200)
  height?: number;
}

export class PackageDetailsDto {
  @ApiPropertyOptional({
    description: 'Description du colis',
    example: 'Clés et documents importants',
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description: 'Le colis est fragile',
    example: false,
  })
  @IsBoolean()
  @IsOptional()
  isFragile?: boolean;

  @ApiPropertyOptional({
    description: 'Poids du colis en kg',
    example: 0.5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(50)
  weight?: number;

  @ApiPropertyOptional({
    description: 'Dimensions du colis',
    type: PackageDimensionsDto,
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  dimensions?: PackageDimensionsDto;
}
