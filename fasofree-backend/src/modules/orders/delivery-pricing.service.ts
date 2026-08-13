import { Injectable, Logger } from '@nestjs/common';

export enum VehicleType {
  BICYCLE = 'BICYCLE',
  MOTORCYCLE = 'MOTORCYCLE',
  CAR = 'CAR',
}

export interface PricingConfig {
  baseFee: number; // Frais de base en FCFA
  ratePerKm: number; // Tarif par kilomètre en FCFA
  multiplier: number; // Coefficient multiplicateur (ex: 1.0 normal, 1.2 en heure de pointe)
}

@Injectable()
export class DeliveryPricingService {
  private readonly logger = new Logger(DeliveryPricingService.name);

  // Configuration tarifaire par type de véhicule (Standard marché Ouest-Africain / FCFA)
  private readonly pricingProfiles: Record<VehicleType, PricingConfig> = {
    [VehicleType.BICYCLE]: {
      baseFee: 250,
      ratePerKm: 100,
      multiplier: 1.0,
    },
    [VehicleType.MOTORCYCLE]: {
      baseFee: 400,
      ratePerKm: 150,
      multiplier: 1.0,
    },
    [VehicleType.CAR]: {
      baseFee: 800,
      ratePerKm: 300,
      multiplier: 1.1, // Léger surcoût lié aux frais de carburant/véhicule
    },
  };

  /**
   * 🧮 Calcule le prix exact de la livraison en fonction de la distance et du véhicule
   */
  calculateDeliveryFee(
    distanceKm: number,
    vehicleType: VehicleType = VehicleType.MOTORCYCLE,
    surgeMultiplier: number = 1.0,
  ): number {
    const profile =
      this.pricingProfiles[vehicleType] ||
      this.pricingProfiles[VehicleType.MOTORCYCLE];

    if (distanceKm < 0) {
      this.logger.warn(
        `[Pricing Warning] Distance négative reçue: ${distanceKm}km. Forcée à 0.`,
      );
      distanceKm = 0;
    }

    // Formule : Base + (Distance * Rate) * Multiplicateur Véhicule * Surge Pricing horaire/météo
    const rawCost =
      (profile.baseFee + distanceKm * profile.ratePerKm) *
      profile.multiplier *
      surgeMultiplier;

    // Arrondi commercial intelligent au palier de 25 FCFA le plus proche
    const roundedFee = Math.ceil(rawCost / 25) * 25;

    this.logger.log(
      `[Pricing Engine] Véhicule: ${vehicleType} | Distance: ${distanceKm.toFixed(2)}km | Prix calculé: ${roundedFee} FCFA`,
    );

    return roundedFee;
  }

  /**
   * 🚗 Sélectionne le profil de véhicule optimal selon le volume ou l'option choisie
   */
  resolveVehicleType(requestedType?: string): VehicleType {
    if (
      requestedType &&
      Object.values(VehicleType).includes(requestedType as VehicleType)
    ) {
      return requestedType as VehicleType;
    }
    return VehicleType.MOTORCYCLE; // Valeur par défaut standard
  }
}
