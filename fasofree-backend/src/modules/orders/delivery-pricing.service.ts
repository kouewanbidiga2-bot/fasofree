import { Injectable, Logger } from '@nestjs/common';

export enum VehicleType {
  BICYCLE = 'BICYCLE',
  MOTORCYCLE = 'MOTORCYCLE',
  CAR = 'CAR',
}

export interface PricingConfig {
  baseFee: number;
  ratePerKm: number;
}

/**
 * Tarification livraison dynamique.
 * Le cache statique est rempli par SettingsService.onModuleInit().
 * Fallback hardcodé si le cache est vide.
 */
@Injectable()
export class DeliveryPricingService {
  private readonly logger = new Logger(DeliveryPricingService.name);

  static readonly DEFAULTS: Record<VehicleType, PricingConfig> = {
    [VehicleType.BICYCLE]:    { baseFee: 250, ratePerKm: 100 },
    [VehicleType.MOTORCYCLE]: { baseFee: 400, ratePerKm: 150 },
    [VehicleType.CAR]:        { baseFee: 800, ratePerKm: 300 },
  };

  /** Cache rempli par SettingsService.onModuleInit() */
  static override: Record<string, PricingConfig> | null = null;

  calculateDeliveryFee(
    distanceKm: number,
    vehicleType: VehicleType = VehicleType.MOTORCYCLE,
    surgeMultiplier: number = 1.0,
  ): number {
    const profiles = DeliveryPricingService.override || DeliveryPricingService.DEFAULTS;
    const profile = profiles[vehicleType] || DeliveryPricingService.DEFAULTS[VehicleType.MOTORCYCLE];

    if (distanceKm < 0) {
      this.logger.warn(`[Pricing Warning] Distance négative: ${distanceKm}km. Forcée à 0.`);
      distanceKm = 0;
    }

    const rawCost = (profile.baseFee + distanceKm * profile.ratePerKm) * surgeMultiplier;
    const roundedFee = Math.ceil(rawCost / 25) * 25;

    this.logger.log(
      `[Pricing Engine] Véhicule: ${vehicleType} | Distance: ${distanceKm.toFixed(2)}km | Prix: ${roundedFee} FCFA`,
    );

    return roundedFee;
  }

  resolveVehicleType(requestedType?: string): VehicleType {
    if (requestedType && Object.values(VehicleType).includes(requestedType as VehicleType)) {
      return requestedType as VehicleType;
    }
    return VehicleType.MOTORCYCLE;
  }
}
