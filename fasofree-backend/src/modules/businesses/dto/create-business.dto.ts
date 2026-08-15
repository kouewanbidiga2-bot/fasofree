import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MinLength,
} from 'class-validator';

export class CreateBusinessDto {
  @ApiProperty({ example: 'Restaurant Faso Délices' })
  @IsString()
  @MinLength(2)
  name: string;
  @ApiProperty({ example: '1200, Ouagadougou' })
  @IsString()
  @MinLength(5)
  address: string;
  @ApiProperty({ example: '+22670000001' })
  @Matches(/^\+?[0-9]{8,20}$/)
  phone: string;
  @ApiProperty({ example: 12.3714 })
  @Type(() => Number)
  @IsLatitude()
  latitude: number;
  @ApiProperty({ example: -1.5197 })
  @Type(() => Number)
  @IsLongitude()
  longitude: number;

  @ApiPropertyOptional({
    description: 'Marque (Brand) à laquelle rattacher cette agence',
  })
  @IsUUID()
  @IsOptional()
  brandId?: string;
}
