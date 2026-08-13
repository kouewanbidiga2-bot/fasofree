import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleMapsService } from './services/google-maps.service';
import { CalculateDistanceDto } from './dto/calculate-distance.dto';

@Injectable()
export class TrackingService {
  constructor(
    private readonly googleMapsService: GoogleMapsService,
    private readonly configService: ConfigService,
  ) {}

  async calculateDeliveryFee(dto: CalculateDistanceDto): Promise<any> {
    const distanceData = await this.googleMapsService.getDistance(
      dto.originLatitude,
      dto.originLongitude,
      dto.destinationLatitude,
      dto.destinationLongitude,
    );

    const distanceKm = Number(
      (distanceData.distanceInMeters / 1000).toFixed(2),
    );
    const baseFee = this.configService.get<number>('DELIVERY_BASE_FEE', 500);

    return {
      deliveryFeeFcfa: Math.max(500, baseFee),
      distanceInKm: distanceKm,
      isEstimatedByFallback: distanceData.isEstimatedByFallback,
    };
  }
}
