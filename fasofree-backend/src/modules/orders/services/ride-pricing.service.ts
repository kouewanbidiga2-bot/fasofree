import { Injectable, Logger } from '@nestjs/common';
import { SubscriptionService } from '../../subscriptions/subscription.service';
import { DistanceCalculatorService } from './distance-calculator.service';
import { RideOption } from '../entities/order.entity';

export const RIDE_PRICE_PER_KM_DEFAULT = 200;
export const RIDE_MIN_FARE_DEFAULT = 500;
/**
 * Plancher économique absolu par course (moto) :
 * ~500 FCFA d'essence aller-retour + 500 FCFA de bénéfice minimum livreur.
 * Même sur les trajets les plus courts, le livreur doit y retrouver son compte.
 */
export const RIDE_FLOOR_FARE_DEFAULT = 1000;

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

interface RidePricingRow {
  minFare: number;
  pricePerKm: number;
}

/**
 * Tarification FasoFree Ride — lit les tarifs depuis le cache statique
 * rempli par SettingsService.onModuleInit(). Fallback hardcodé si vide.
 */
@Injectable()
export class RidePricingService {
  private readonly logger = new Logger(RidePricingService.name);

  /** Cache rempli par SettingsService.onModuleInit() */
  static override: Record<string, RidePricingRow> | null = null;

  constructor(
    private readonly distanceCalculatorService: DistanceCalculatorService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  private getOptionPricing(option: RideOption): RidePricingRow {
    if (RidePricingService.override && RidePricingService.override[option]) {
      return RidePricingService.override[option];
    }
    return {
      minFare: RIDE_MIN_FARE_DEFAULT,
      pricePerKm: RIDE_PRICE_PER_KM_DEFAULT,
    };
  }

  /**
   * Arrondit au multiple de 50 FCFA supérieur (prix "propres" pour le client).
   */
  private roundUp50(value: number): number {
    return Math.ceil(value / 50) * 50;
  }

  async estimate(
    pickupLatitude: number,
    pickupLongitude: number,
    dropoffLatitude: number,
    dropoffLongitude: number,
    clientId: string,
    rideOption?: RideOption,
  ): Promise<RideEstimate> {
    const distanceKm = this.distanceCalculatorService.calculateDistance(
      pickupLatitude, pickupLongitude, dropoffLatitude, dropoffLongitude,
    );

    const option = rideOption || RideOption.ECONOMY;
    const pricing = this.getOptionPricing(option);

    // 💡 Tarification moto : base (prise en charge / essence courte distance)
    // + tarif kilométrique sur la distance réelle pickup → destination.
    const rawFare = pricing.minFare + distanceKm * pricing.pricePerKm;

    // 🛵 Plancher absolu : essence aller-retour (~500 F) + bénéfice
    // minimum livreur (500 F) sur les trajets les plus courts.
    const fare = Math.max(rawFare, pricing.minFare, RIDE_FLOOR_FARE_DEFAULT);

    const roundedFare = this.roundUp50(fare);
    const platformFee = await this.subscriptionService.resolveServiceFee(clientId);

    return {
      distanceKm,
      fare: roundedFare,
      platformFee,
      total: roundedFare + platformFee,
      rideOption: option,
      currency: 'FCFA',
    };
  }
}
