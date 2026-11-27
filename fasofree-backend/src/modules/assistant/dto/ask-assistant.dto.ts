/**
 * Copyright (c) 2026 BIDIGA Imrane - Koliwa. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class AskAssistantDto {
  @ApiProperty({
    example: 'Comment faire récupérer un achat en boutique ?',
    description: "Question posée à l'assistant",
  })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(2)
  @MaxLength(500)
  @IsNotEmpty()
  question: string;

  @ApiPropertyOptional({
    example: '3d1f6d8e-62c0-4c7a-9f88-2d0b0c8a91e4',
    description: 'Ancien contexte marchand conservé pour les clients existants',
    deprecated: true,
  })
  @IsOptional()
  @IsUUID()
  businessId?: string;
}
