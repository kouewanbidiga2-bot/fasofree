import { OrderType } from '../entities/order.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  IsUUID,
} from 'class-validator';

export class CreateOrderDto {
  @ApiProperty({
    description: 'Identifiant UUID unique de la boutique / du commerce',
    format: 'uuid',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  @IsUUID()
  businessId: string;

  @ApiProperty({
    description: 'Montant total de la commande en FCFA (XOF)',
    example: 5000,
    minimum: 0,
  })
  @Type(() => Number)
  @IsPositive()
  totalAmount: number;

  @ApiPropertyOptional({
    description: 'Coordonnée GPS Latitude de livraison à Ouagadougou',
    example: 12.3714,
  })
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  deliveryLatitude?: number;

  @ApiPropertyOptional({
    description: 'Coordonnée GPS Longitude de livraison à Ouagadougou',
    example: -1.5197,
  })
  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  deliveryLongitude?: number;

  @ApiProperty({
    description: 'Type de commande (ex: LIVRAISON, EMPORTER)',
    enum: OrderType,
  })
  @IsEnum(OrderType)
  orderType: OrderType;

  @ApiPropertyOptional({
    description: 'Frais de livraison appliqués en FCFA (XOF)',
    example: 1000,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsPositive()
  deliveryFee?: number;

  @ApiPropertyOptional({
    description: 'Code promotionnel contextuel appliqué à la commande',
    example: 'BIENVENUE10',
  })
  @IsOptional()
  @IsString()
  @Length(2, 32)
  promoCode?: string;
}
