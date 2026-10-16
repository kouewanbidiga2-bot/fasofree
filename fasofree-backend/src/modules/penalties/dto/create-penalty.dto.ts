import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import {
  DeliveryPenaltyLevel,
  DeliveryPenaltyTarget,
} from '../entities/delivery-penalty.entity';

/**
 * ⚖️ Création d'une sanction qualité (bloc C).
 *
 * `driverId` / `agencyId` sont validés conditionnellement au `targetType` :
 * une sanction DRIVER sans `driverId` (ou AGENCY sans `agencyId`) doit être
 * rejetée en 400 explicite, pas silencieusement transformée en sanction vide.
 */
export class CreatePenaltyDto {
  @ApiProperty({
    enum: DeliveryPenaltyTarget,
    description: 'DRIVER (livreur interne) ou AGENCY (société de livraison)',
  })
  @IsEnum(DeliveryPenaltyTarget)
  targetType: DeliveryPenaltyTarget;

  @ApiPropertyOptional({ description: 'Requis si targetType = DRIVER' })
  @ValidateIf((o: CreatePenaltyDto) => o.targetType === DeliveryPenaltyTarget.DRIVER)
  @IsUUID()
  driverId?: string;

  @ApiPropertyOptional({ description: 'Requis si targetType = AGENCY' })
  @ValidateIf((o: CreatePenaltyDto) => o.targetType === DeliveryPenaltyTarget.AGENCY)
  @IsUUID()
  agencyId?: string;

  @ApiPropertyOptional({ description: 'Commande concernée par la sanction' })
  @IsOptional()
  @IsUUID()
  orderId?: string;

  @ApiProperty({
    enum: DeliveryPenaltyLevel,
    description:
      'WARNING (avertissement) | PRIORITY_DOWNGRADE (baisse de priorité) | SUSPENSION (temporaire)',
  })
  @IsEnum(DeliveryPenaltyLevel)
  level: DeliveryPenaltyLevel;

  @ApiPropertyOptional({
    description: 'Motif lisible — ne jamais y mettre de donnée personnelle',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @ApiPropertyOptional({ description: 'Début d\'effet (défaut : maintenant)' })
  @IsOptional()
  @IsISO8601()
  effectiveFrom?: string;

  @ApiPropertyOptional({
    description:
      'Fin d\'effet (défaut : 7 jours pour SUSPENSION, sans terme sinon)',
  })
  @IsOptional()
  @IsISO8601()
  effectiveUntil?: string;
}
