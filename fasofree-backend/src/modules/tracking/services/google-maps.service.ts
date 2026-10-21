/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { Injectable, Logger } from '@nestjs/common';

export interface DistanceMatrixResult {
  distanceInMeters: number;
  durationInSeconds: number;
  isEstimatedByFallback: boolean;
}

@Injectable()
export class GoogleMapsService {
  private readonly logger = new Logger(GoogleMapsService.name);

  async getDistance(
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number,
  ): Promise<DistanceMatrixResult> {
    return {
      distanceInMeters: 5000,
      durationInSeconds: 600,
      isEstimatedByFallback: true,
    };
  }
}
