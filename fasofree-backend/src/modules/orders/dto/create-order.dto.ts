import { OrderType, FulfillmentType } from '../entities/order.entity';
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
  IsObject,
  IsNumber,
  ValidateIf,
  IsNotEmpty,
  IsBoolean,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { P2PLocationDto } from './p2p-location.dto';
import { PackageDetailsDto } from './package-details.dto';

export class CreateOrderDto {
  @ApiProperty({
    description:
      'Identifiant UUID unique de la boutique / du commerce (optionnel pour P2P)',
    format: 'uuid',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    required: false,
  })
  @IsUUID()
  @ValidateIf((o) => o.orderType !== OrderType.P2P_DELIVERY)
  businessId?: string;

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
    description: 'Type de fulfillment (DELIVERY, PICKUP, DINE_IN)',
    enum: FulfillmentType,
  })
  @IsOptional()
  @IsEnum(FulfillmentType)
  fulfillmentType?: FulfillmentType;

  @ApiPropertyOptional({
    description:
      'Détails de fulfillment (tableNumber, reservationTime, numberOfGuests, notes)',
    example: { tableNumber: '5', numberOfGuests: 2 },
  })
  @IsOptional()
  @IsObject()
  fulfillmentDetails?: {
    tableNumber?: string;
    reservationTime?: string;
    numberOfGuests?: number;
    notes?: string;
  };

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

  // --- 🚚 P2P DELIVERY FIELDS (Course à la demande) ---

  @ApiPropertyOptional({
    description: 'Lieu de ramassage pour livraison P2P',
    type: P2PLocationDto,
  })
  @IsOptional()
  @ValidateIf((o) => o.orderType === OrderType.P2P_DELIVERY)
  @ValidateNested()
  @Type(() => P2PLocationDto)
  pickupLocation?: P2PLocationDto;

  @ApiPropertyOptional({
    description: 'Lieu de livraison pour livraison P2P',
    type: P2PLocationDto,
  })
  @IsOptional()
  @ValidateIf((o) => o.orderType === OrderType.P2P_DELIVERY)
  @ValidateNested()
  @Type(() => P2PLocationDto)
  dropoffLocation?: P2PLocationDto;

  @ApiPropertyOptional({
    description: 'Détails du colis pour livraison P2P',
    type: PackageDetailsDto,
  })
  @IsOptional()
  @ValidateIf((o) => o.orderType === OrderType.P2P_DELIVERY)
  @ValidateNested()
  @Type(() => PackageDetailsDto)
  packageDetails?: PackageDetailsDto;
}
