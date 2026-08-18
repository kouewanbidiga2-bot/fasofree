import { OrderType } from '../entities/order.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  ValidateNested,
  Min,
} from 'class-validator';
import { P2PLocationDto } from './p2p-location.dto';

/**
 * 💬 Requête de devis tarifaire.
 * Le backend calcule TOUS les montants (sous-total, livraison GPS, frais plateforme)
 * et les renvoie tels qu'ils seront verrouillés lors du POST /orders.
 */
export class QuoteOrderDto {
  @ApiProperty({
    description:
      "Type de commande à deviser : DELIVERY / MERCHANT (commerce) ou P2P_DELIVERY (course)",
    enum: OrderType,
    example: OrderType.DELIVERY,
  })
  @IsEnum(OrderType)
  orderType: OrderType;

  @ApiPropertyOptional({
    description:
      'Identifiant du boutique (optionnel si businessLatitude/businessLongitude fournis)',
    required: false,
  })
  @IsOptional()
  @IsString()
  businessId?: string;

  @ApiPropertyOptional({
    description: 'Coordonnée GPS Latitude de livraison',
    example: 12.3714,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  deliveryLatitude?: number;

  @ApiPropertyOptional({
    description: 'Coordonnée GPS Longitude de livraison',
    example: -1.5197,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  deliveryLongitude?: number;

  @ApiPropertyOptional({
    description:
      'Coordonnée GPS Latitude de la boutique (fallback si pas de businessId en base)',
    example: 12.3665,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  businessLatitude?: number;

  @ApiPropertyOptional({
    description:
      'Coordonnée GPS Longitude de la boutique (fallback si pas de businessId en base)',
    example: -1.4807,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  businessLongitude?: number;

  @ApiPropertyOptional({
    description:
      "Sous-total des articles en FCFA (0 pour une course P2P). Le backend utilise ce montant dans le devis mais recompte TOUJOURS au POST /orders.",
    example: 7500,
    minimum: 0,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  subtotal?: number;

  @ApiPropertyOptional({
    description: 'Lieu de ramassage (obligatoire pour P2P_DELIVERY)',
    type: P2PLocationDto,
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => P2PLocationDto)
  pickupLocation?: P2PLocationDto;

  @ApiPropertyOptional({
    description: 'Lieu de livraison (obligatoire pour P2P_DELIVERY)',
    type: P2PLocationDto,
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => P2PLocationDto)
  dropoffLocation?: P2PLocationDto;
}
