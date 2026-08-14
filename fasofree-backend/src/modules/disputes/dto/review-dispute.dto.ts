import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsNumber,
  MaxLength,
} from 'class-validator';
import { DisputeResolution } from '../entities/dispute.entity';

export class ReviewDisputeDto {
  @ApiProperty({ enum: DisputeResolution })
  @IsEnum(DisputeResolution)
  resolution: DisputeResolution;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  @ApiPropertyOptional({
    description:
      'Montant du remboursement (optionnel, défaut = montant total de la commande)',
  })
  @IsOptional()
  @IsNumber()
  refundAmount?: number;
}
