/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * 🎙️ Requête de commande vocale (transcript) → action structurée.
 */
export class VoiceActionDto {
  @ApiProperty({ description: 'Texte transcrit de la voix de l’utilisateur' })
  @IsString()
  question: string;

  @ApiPropertyOptional({ description: 'Contexte restaurant courant (optionnel)' })
  @IsOptional()
  @IsString()
  businessId?: string;
}
