import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SubscriptionService } from '../../subscriptions/subscription.service';
import { DistanceCalculatorService } from './distance-calculator.service';
import { RideOption } from '../entities/order.entity';

/**
 * Tarification FasoFree Ride (VTC / moto-taxi à la demande).
 * - Course = distance GPS (km) × RIDE_PRICE_PER_KM (200 FCFA/km) × rideOptionMultiplier,
 *   avec un minimum de course RIDE_MIN_FARE (500 FCFA) × rideOptionMultiplier.
 * - Frais plateforme = 100 FCFA par course (offerts pour le client FasoFree VIP).
 * Total client = Course + Frais plateforme.
 * ⚠️ Aucun plancher de livraison (MIN_DELIVERY_FEE = 800 FCFA) n'est appliqué.
 */
export const RIDE_PRICE_PER_KM = 200;
export const RIDE_MIN_FARE = 500;

/** Multiplicateur par option de confort (sans casser le tarif historique) */
export const RIDE_OPTION_MULTIPLIERS: Record<string, number> = {
  [RideOption.ECONOMY]: 1.0,
  [RideOption.COMFORT]: 1.4,
  [RideOption.PREMIUM]: 2.0,
};

export interface RideEstimate {
  distanceKm: number;
  fare: number;
  platformFee: number;
  total: number;
  rideOption: RideOption;
  currency: 'FCFA';
}

@Injectable()
export class RidePricingService {
  constructor(
    private readonly configService: ConfigService,
    private readonly distanceCalculatorService: DistanceCalculatorService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  /**
   * 🏍️ Estimation d'une course FasoFree Ride entre deux points GPS.
   * Course = max(distance × 200 × mult, 500 × mult) + frais plateforme (0 si VIP).
   */
  async estimate(
    pickupLatitude: number,
    pickupLongitude: number,
    dropoffLatitude: number,
    dropoffLongitude: number,
    clientId: string,
    rideOption?: RideOption,
  ): Promise<RideEstimate> {
    const distanceKm = this.distanceCalculatorService.calculateDistance(
      pickupLatitude,
      pickupLongitude,
      dropoffLatitude,
      dropoffLongitude,
    );

    const pricePerKm = this.configService.get<number>(
      'RIDE_PRICE_PER_KM',
      RIDE_PRICE_PER_KM,
    );
    const minFare = this.configService.get<number>('RIDE_MIN_FARE', RIDE_MIN_FARE);
    const option = rideOption || RideOption.ECONOMY;
    const multiplier = RIDE_OPTION_MULTIPLIERS[option] ?? 1.0;

    const fare = Math.max(distanceKm * pricePerKm * multiplier, minFare * multiplier);
    const platformFee = await this.subscriptionService.resolveServiceFee(clientId);

    return {
      distanceKm,
      fare: Math.round(fare),
      platformFee,
      total: Math.round(fare) + platformFee,
      rideOption: option,
      currency: 'FCFA',
    };
  }
}
