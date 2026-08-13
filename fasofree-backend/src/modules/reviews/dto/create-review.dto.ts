import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReviewTargetType } from '../entities/review.entity';

export class CreateReviewDto {
  @ApiProperty({
    description: "L'identifiant de la commande",
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  orderId: string;

  @ApiProperty({
    description: "L'identifiant du livreur, coursier ou commerce évalué",
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @IsUUID()
  targetId: string;

  @ApiProperty({
    description: 'Le type de cible évaluée (DRIVER, COURIER, BUSINESS)',
    enum: ReviewTargetType,
    example: ReviewTargetType.DRIVER,
  })
  @IsEnum(ReviewTargetType)
  targetType: ReviewTargetType;

  @ApiProperty({
    description: 'La note attribuée (de 1 à 5)',
    example: 5,
    minimum: 1,
    maximum: 5,
  })
  @IsInt()
  @Min(1)
  @Max(5)
  score: number;

  @ApiPropertyOptional({
    description: 'Un commentaire optionnel sur le service',
    example: 'Très bon service, rapide et courtois.',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;

  @ApiPropertyOptional({
    description: 'Le montant du pourboire (optionnel, en FCFA)',
    example: 500,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  tipAmount?: number;
}
