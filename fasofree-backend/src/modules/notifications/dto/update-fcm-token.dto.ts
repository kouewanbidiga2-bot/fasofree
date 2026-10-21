/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateFcmTokenDto {
  @ApiProperty({
    description: "Jeton FCM unique généré par l'application mobile",
    example: 'f7a8b9c0_d1e2f3...:APA91bH...',
  })
  @IsString()
  @IsNotEmpty()
  fcmToken: string;
}
