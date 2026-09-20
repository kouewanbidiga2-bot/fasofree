import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export enum VehicleType {
  BICYCLE = 'BICYCLE',
  MOTORCYCLE = 'MOTORCYCLE',
  CAR = 'CAR',
}

/**
 * Tranches de livraison (colis / motos) — Burkina Faso.
 * La nuit (21h–06h Africa/Ouagadougou) ajoute +500 FCFA.
 */
export interface DeliveryTier {
  minKm: number;
  maxKm: number | null; // null = illimité
  minPrice: number;
  maxPrice: number;
  label?: string;
}

export interface DeliveryPricingResult {
  fee: number;
  distanceKm: number;
  tier: DeliveryTier;
  isNight: boolean;
  nightSurcharge: number;
  baseFee: number;
  vehicleType: VehicleType;
}

const DEFAULT_TIERS: DeliveryTier[] = [
  { minKm: 0,   maxKm: 15, minPrice: 1500, maxPrice: 2000, label: '0–15 km' },
  { minKm: 16,  maxKm: 20, minPrice: 2000, maxPrice: 2500, label: '16–20 km' },
  { minKm: 21,  maxKm: 25, minPrice: 2500, maxPrice: 3000, label: '21–25 km' },
  { minKm: 26,  maxKm: 30, minPrice: 3000, maxPrice: 3500, label: '26–30 km' },
  { minKm: 31,  maxKm: null, minPrice: 3500, maxPrice: 4000, label: '31+ km' },
];

const NIGHT_START_HOUR = 21;
const NIGHT_END_HOUR = 6;
const NIGHT_SURCHARGE = 500;
const TIMEZONE = 'Africa/Ouagadougou';

function isNightTime(date: Date = new Date()): boolean {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    hour12: false,
  });
  const hour = parseInt(formatter.format(date), 10);
  return hour >= NIGHT_START_HOUR || hour < NIGHT_END_HOUR;
}

@Injectable()
export class DeliveryPricingService {
  private readonly logger = new Logger(DeliveryPricingService.name);
  private tiers: DeliveryTier[];

  /** Override legacy (linéaire: baseFee + ratePerKm). Null si tranches DB actives. */
  static override: Record<string, { baseFee: number; ratePerKm: number }> | null = null;

  /** Tranches depuis la DB (prioritaires sur override legacy). */
  static tiersFromDB: { minKm: number; maxKm: number | null; price: number; label?: string }[] | null = null;

  constructor(private readonly configService: ConfigService) {
    const configTiers = this.configService.get<DeliveryTier[]>('DELIVERY_TIERS');
    this.tiers = configTiers?.length ? configTiers : DEFAULT_TIERS;
    this.tiers.sort((a, b) => a.minKm - b.minKm);
  }

  calculateDeliveryFee(
    distanceKm: number,
    vehicleType: VehicleType = VehicleType.MOTORCYCLE,
    _surgeMultiplier: number = 1.0,
    weightKg?: number,
    date?: Date,
  ): DeliveryPricingResult {
    if (distanceKm < 0) {
      this.logger.warn(`[Pricing] Distance négative: ${distanceKm}km. Forcée à 0.`);
      distanceKm = 0;
    }

    // 1. Priorité : tranches depuis la DB (nouveau système admin)
    if (DeliveryPricingService.tiersFromDB && DeliveryPricingService.tiersFromDB.length > 0) {
      const dbTiers = DeliveryPricingService.tiersFromDB;
      const matched = dbTiers.find(t => distanceKm >= t.minKm && (t.maxKm === null || distanceKm <= t.maxKm));
      const tier = matched ?? dbTiers[dbTiers.length - 1];

      const isNight = isNightTime(date);
      const nightSurcharge = isNight ? NIGHT_SURCHARGE : 0;
      const totalFee = tier.price + nightSurcharge;

      const resultTier: DeliveryTier = {
        minKm: tier.minKm,
        maxKm: tier.maxKm,
        minPrice: tier.price,
        maxPrice: tier.price,
        label: tier.label,
      };

      this.logger.log(
        `[Pricing] Distance: ${distanceKm.toFixed(2)}km | Palier: ${tier.label ?? `${tier.minKm}–${tier.maxKm ?? '+'}km`} | ` +
        `Prix: ${tier.price} FCFA | Nuit: ${isNight ? 'OUI (+500)' : 'NON'} | Total: ${totalFee} FCFA`,
      );

      return {
        fee: totalFee,
        distanceKm,
        tier: resultTier,
        isNight,
        nightSurcharge,
        baseFee: tier.price,
        vehicleType,
      };
    }

    // 2. Fallback legacy : formule linéaire (baseFee + distance × ratePerKm)
    if (DeliveryPricingService.override && DeliveryPricingService.override[vehicleType]) {
      const profile = DeliveryPricingService.override[vehicleType];
      const rawCost = profile.baseFee + distanceKm * profile.ratePerKm;
      const roundedFee = Math.ceil(rawCost / 25) * 25;
      return {
        fee: roundedFee,
        distanceKm,
        tier: { minKm: 0, maxKm: null, minPrice: roundedFee, maxPrice: roundedFee },
        isNight: false,
        nightSurcharge: 0,
        baseFee: roundedFee,
        vehicleType,
      };
    }

    // 3. Dernier fallback : tranches par défaut hardcodées
    const tier = this.tiers.find(t => distanceKm >= t.minKm && (t.maxKm === null || distanceKm <= t.maxKm))
      ?? this.tiers[this.tiers.length - 1];

    const baseFee = Math.round((tier.minPrice + tier.maxPrice) / 2);
    const isNight = isNightTime(date);
    const nightSurcharge = isNight ? NIGHT_SURCHARGE : 0;
    const totalFee = baseFee + nightSurcharge;

    this.logger.log(
      `[Pricing] Distance: ${distanceKm.toFixed(2)}km | Tranche: ${tier.minKm}–${tier.maxKm ?? '+'}km | ` +
      `Base: ${baseFee} FCFA | Nuit: ${isNight ? 'OUI (+500)' : 'NON'} | Total: ${totalFee} FCFA`,
    );

    return {
      fee: totalFee,
      distanceKm,
      tier,
      isNight,
      nightSurcharge,
      baseFee,
      vehicleType,
    };
  }

  calculateDeliveryFeeLegacy(
    distanceKm: number,
    vehicleType: VehicleType = VehicleType.MOTORCYCLE,
    surgeMultiplier: number = 1.0,
  ): number {
    return this.calculateDeliveryFee(distanceKm, vehicleType, surgeMultiplier).fee;
  }

  resolveVehicleType(requestedType?: string): VehicleType {
    if (requestedType && Object.values(VehicleType).includes(requestedType as VehicleType)) {
      return requestedType as VehicleType;
    }
    return VehicleType.MOTORCYCLE;
  }
}