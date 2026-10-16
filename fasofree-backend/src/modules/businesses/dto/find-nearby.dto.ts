import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsPositive,
  Max,
} from 'class-validator';

export class FindNearbyDto {
  @ApiProperty({ example: 12.3714, description: 'Latitude (ou "lat")' })
  @Transform(({ obj }) => obj.lat ?? obj.latitude)
  @IsLatitude()
  latitude: number;

  @ApiProperty({ example: -1.5197, description: 'Longitude (ou "lng")' })
  @Transform(({ obj }) => obj.lng ?? obj.longitude)
  @IsLongitude()
  longitude: number;

  @ApiPropertyOptional({ example: 5, default: 5 })
  @IsOptional()
  @Transform(({ obj }) => obj.radius ?? obj.radiusInKm)
  @IsPositive()
  @Max(50)
  radiusInKm?: number; // Par défaut : 5 km

  @ApiPropertyOptional({
    example: 'RESTAURANT',
    description: 'Filtrer par verticale (niveau 1)',
  })
  @IsOptional()
  category?: string;

  @ApiPropertyOptional({
    example: 'Fast-Food',
    description: 'Filtrer par sous-catégorie (niveau 2)',
  })
  @IsOptional()
  subCategory?: string;
}
