import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsPositive,
  Max,
} from 'class-validator';

export class FindNearbyDto {
  @ApiProperty({ example: 12.3714 })
  @Type(() => Number)
  @IsLatitude()
  latitude: number;
  @ApiProperty({ example: -1.5197 })
  @Type(() => Number)
  @IsLongitude()
  longitude: number;
  @ApiPropertyOptional({
    example: 5,
    default: 5,
    description: 'Rayon de recherche, en kilomètres',
  })
  @IsOptional()
  @Type(() => Number)
  @IsPositive()
  @Max(50)
  radiusInKm?: number; // Par défaut : 5 km
}
