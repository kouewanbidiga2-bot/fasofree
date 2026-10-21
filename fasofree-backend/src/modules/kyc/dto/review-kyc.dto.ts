/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewKycDto {
  @ApiPropertyOptional({ description: 'Obligatoire en cas de rejet.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
