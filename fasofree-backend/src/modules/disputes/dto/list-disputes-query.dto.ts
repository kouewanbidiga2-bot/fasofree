import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { DisputeStatus } from '../entities/dispute.entity';

/**
 * Filtre optionnel de la liste des litiges (staff).
 * Valide le statut pour éviter un 500 (contrainte CK_disputes_status) si un
 * statut inconnu est passé en query.
 */
export class ListDisputesQueryDto {
  @ApiPropertyOptional({
    enum: DisputeStatus,
    description: 'Filtre par statut de litige (optionnel).',
  })
  @IsOptional()
  @IsEnum(DisputeStatus)
  status?: DisputeStatus;
}
