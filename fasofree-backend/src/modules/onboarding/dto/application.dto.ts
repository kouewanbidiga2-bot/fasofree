/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RejectApplicationDto {
  @ApiProperty({ example: 'Pièce d\'identité illisible' })
  @IsString()
  @MinLength(2)
  reason: string;
}

export class ApproveApplicationDto {
  /**
   * Affiche du restaurant (optionnelle) : si l'admin l'a déjà sous la main au
   * moment d'approuver, elle est attribuée au business créé — sinon le client
   * affiche le fallback catégorie, et le marchand pourra l'ajouter ensuite
   * dans Paramètres → Identité visuelle. Non bloquant : l'approbation reste
   * possible sans image.
   */
  @ApiPropertyOptional({
    description: "URL de l'affiche du restaurant (optionnel)",
    example: '/uploads/covers/restaurant.jpg',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  coverImage?: string;
}

export class ListApplicationsQueryDto {
  @ApiPropertyOptional({
    enum: ['PENDING_APPROVAL', 'KYC_APPROVED', 'APPROVED', 'REJECTED'],
    description:
      "Statut unique ou liste séparée par des virgules (ex: PENDING_APPROVAL,KYC_APPROVED)",
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ enum: ['MERCHANT', 'DRIVER'] })
  @IsOptional()
  @IsString()
  type?: string;
}
