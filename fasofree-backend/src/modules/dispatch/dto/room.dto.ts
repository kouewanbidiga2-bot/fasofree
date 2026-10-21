/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { IsNotEmpty, IsString } from 'class-validator';

export class JoinBusinessRoomDto {
  @IsString()
  @IsNotEmpty()
  businessId: string;
}

export class JoinOrderTrackingDto {
  @IsString()
  @IsNotEmpty()
  orderId: string;
}
