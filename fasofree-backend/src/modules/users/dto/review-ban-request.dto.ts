/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';
import { BanRequestStatus } from '../entities/ban-request.entity';

export class ReviewBanRequestDto {
  @ApiProperty({
    enum: BanRequestStatus,
    example: BanRequestStatus.APPROVED,
  })
  @IsString()
  status: BanRequestStatus.APPROVED | BanRequestStatus.REJECTED;

  @ApiPropertyOptional({
    example: 'Demande approuvée — motifs confirmés',
  })
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  note?: string;
}
