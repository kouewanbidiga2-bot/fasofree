import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsLatitude,
  IsLongitude,
  IsOptional,
  MaxLength,
  Matches,
} from 'class-validator';

export class P2PLocationDto {
  @ApiProperty({
    description: 'Adresse complète',
    example: '123 Rue Principale, Ouagadougou',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  address: string;

  @ApiProperty({
    description: 'Coordonnée GPS Latitude',
    example: 12.3714,
  })
  @Type(() => Number)
  @IsLatitude()
  latitude: number;

  @ApiProperty({
    description: 'Coordonnée GPS Longitude',
    example: -1.5197,
  })
  @Type(() => Number)
  @IsLongitude()
  longitude: number;

  @ApiProperty({
    description: 'Nom du contact',
    example: 'Jean Dupont',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  contactName: string;

  @ApiProperty({
    description: 'Téléphone du contact',
    example: '+22670123456',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+?[0-9]{10,15}$/)
  contactPhone: string;

  @ApiProperty({
    description: 'Instructions spécifiques',
    example: 'Sonnette à gauche',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(300)
  instructions?: string;
}
