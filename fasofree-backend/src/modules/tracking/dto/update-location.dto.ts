import {
  IsNumber,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateLocationDto {
  @ApiProperty({
    example: 12.3714,
    description: 'Latitude GPS actuelle du livreur',
  })
  @IsNumber()
  @IsLatitude()
  latitude: number;

  @ApiProperty({
    example: -1.5197,
    description: 'Longitude GPS actuelle du livreur',
  })
  @IsNumber()
  @IsLongitude()
  longitude: number;

  @ApiProperty({
    example: 'order-123-uuid',
    description: 'ID de la commande associée (optionnel)',
  })
  @IsOptional()
  @IsString()
  orderId?: string;
}
