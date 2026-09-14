import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNotEmpty, Length } from 'class-validator';

/**
 * DTO utilisé par le client pour valider la réception de sa commande
 * en fournissant le code de commande (6 derniers caractères de l'ID).
 */
export class ClientValidateDeliveryDto {
  @ApiProperty({
    description:
      'Code de commande (6 derniers caractères de l\'ID de commande)',
    example: 'a3f8b2',
    minLength: 6,
    maxLength: 6,
  })
  @IsString()
  @Length(6, 6, { message: 'Le code doit contenir exactement 6 caractères' })
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

  @ApiProperty({
    description: 'Mot de passe actuel pour confirmer la soumission du litige',
    example: 'MonMotDePasse123',
  })
  @IsString()
  @IsNotEmpty()
  password: string;
}
