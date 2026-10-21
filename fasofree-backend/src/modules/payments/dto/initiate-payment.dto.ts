/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { PaymentMethod } from '../entities/transaction.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class InitiatePaymentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  orderId: string;

  @ApiProperty({ enum: PaymentMethod, description: 'Mode de paiement (normalisé en minuscules)' })
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase().trim() : value))
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @ApiPropertyOptional({ example: '+22670000000' })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional({ example: 'paydunya', enum: ['geniuspay', 'paydunya'], description: 'Provider de paiement (défaut: auto)' })
  @IsOptional()
  @IsString()
  provider?: 'geniuspay' | 'paydunya';

  @ApiPropertyOptional({ example: 'https://app.com/success' })
  @IsOptional()
  @IsString()
  successUrl?: string;

  @ApiPropertyOptional({ example: 'https://app.com/cancel' })
  @IsOptional()
  @IsString()
  errorUrl?: string;
}
