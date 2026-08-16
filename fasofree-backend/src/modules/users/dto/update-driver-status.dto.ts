import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * 🛵 Statut de disponibilité d'un livreur / coursier.
 * Position GPS + connexion (isOnline) + acceptation des courses (isAvailable)
 * + type de véhicule (utilisé par le dispatch pour préférer une moto/VTC en RIDE).
 */
export class UpdateDriverStatusDto {
  @ApiPropertyOptional({
    description: 'Le livreur est-il en ligne (prêt à recevoir des courses) ?',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isOnline?: boolean;

  @ApiPropertyOptional({
    description: 'Le livreur accepte-t-il les courses actuellement ?',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @ApiPropertyOptional({
    description: 'Coordonnée GPS Latitude',
    example: 12.3714,
  })
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional({
    description: 'Coordonnée GPS Longitude',
    example: -1.5197,
  })
  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  longitude?: number;

  @ApiPropertyOptional({
    description: "Type de véhicule : MOTO, SCOOTER, VTC, BICYCLE, FOOT",
    example: 'MOTO',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  vehicleType?: string;
}
