/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import {
  IsNumber,
  IsOptional,
  IsString,
  IsLatitude,
  IsLongitude,
} from 'class-validator';

export class UpdateLocationDto {
  @IsOptional()
  @IsString()
  orderId?: string;

  @IsNumber()
  @IsLatitude()
  latitude: number;

  @IsNumber()
  @IsLongitude()
  longitude: number;

  @IsOptional()
  @IsNumber()
  heading?: number;
}
