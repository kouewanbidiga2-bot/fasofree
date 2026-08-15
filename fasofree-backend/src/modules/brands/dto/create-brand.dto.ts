import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateBrandDto {
  @ApiProperty({ example: 'Faso Délices' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiPropertyOptional({ example: 'Restaurants & livraison à Ouagadougou' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 'https://cdn.fasofree.com/logos/logo.png' })
  @IsString()
  @IsOptional()
  logoUrl?: string;

  @ApiPropertyOptional({
    description: 'Propriétaire de la marque (optionnel, défaut : créateur)',
  })
  @IsUUID()
  @IsOptional()
  ownerId?: string;
}
