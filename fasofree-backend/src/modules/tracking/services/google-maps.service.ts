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
