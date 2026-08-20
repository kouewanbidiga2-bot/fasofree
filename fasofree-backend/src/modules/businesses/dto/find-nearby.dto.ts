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

  @ApiPropertyOptional({
    example: 5,
    default: 5,
    description: 'Rayon de recherche, en kilomètres',
  })
  @IsOptional()
  @Transform(({ obj }) => obj.radius ?? obj.radiusInKm)
  @IsPositive()
  @Max(50)
  radiusInKm?: number; // Par défaut : 5 km
}
