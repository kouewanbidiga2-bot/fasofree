/**
 * Copyright (c) 2026 BIDIGA Imrane - Koliwa. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * 🎙️ Requête de commande vocale (transcript) → action structurée.
 */
export class VoiceActionDto {
  @ApiProperty({ description: 'Texte transcrit de la voix de l’utilisateur' })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(2)
  @MaxLength(500)
  question: string;

  @ApiPropertyOptional({ description: 'Ancien contexte marchand', deprecated: true })
  @IsOptional()
  @IsString()
  businessId?: string;
}
