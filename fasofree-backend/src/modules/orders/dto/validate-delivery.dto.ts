import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, Length } from 'class-validator';

/**
 * DTO utilisé par le client pour valider la réception de sa commande
 * en fournissant le Code PIN communiqué par le système.
 */
export class ClientValidateDeliveryDto {
  @ApiProperty({
    description:
      'Code PIN à 4 chiffres fourni au client lors de la création de la commande',
    example: '4829',
    minLength: 4,
    maxLength: 4,
  })
  @IsString()
  @Length(4, 4, { message: 'Le code PIN doit contenir exactement 4 chiffres' })
  pinCode: string;
}

/**
 * DTO utilisé par le livreur/coursier pour signaler qu'il a effectué la livraison.
 */
export class DriverValidateDeliveryDto {
  @ApiPropertyOptional({
    description: 'Note optionnelle du livreur (ex: "Remis au gardien")',
    example: "Remis au gardien de l'immeuble",
  })
  @IsOptional()
  @IsString()
  note?: string;
}

/**
 * DTO pour ouvrir un litige sur une commande.
 */
export class DisputeOrderDto {
  @ApiProperty({
    description: 'Raison du litige',
    example: 'Commande non reçue malgré la confirmation du livreur',
  })
  @IsString()
  reason: string;
}
