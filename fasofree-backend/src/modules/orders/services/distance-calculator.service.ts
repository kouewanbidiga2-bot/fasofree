import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Service de calcul de distance et de prix pour les livraisons P2P
 */
@Injectable()
export class DistanceCalculatorService {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Calcule la distance entre deux points GPS en utilisant la formule de Haversine
   * @param lat1 Latitude du point de départ
   * @param lon1 Longitude du point de départ
   * @param lat2 Latitude du point d'arrivée
   * @param lon2 Longitude du point d'arrivée
   * @returns Distance en kilomètres
   */
  calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371; // Rayon de la Terre en km
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return Math.round(distance * 100) / 100; // Arrondi à 2 décimales
  }

  /**
   * Calcule le prix de livraison P2P basé sur la distance
   * @param distance Distance en kilomètres
   * @param isFragile Si le colis est fragile (surcoût possible)
   * @param weight Poids du colis en kg (surcoût possible)
   * @returns Prix en FCFA
   */
  calculateP2PPrice(
    distance: number,
    isFragile: boolean = false,
    weight: number = 0,
  ): number {
    const minPrice = this.configService.get<number>(
      'P2P_MIN_PRICE',
      500, // Prix minimum par défaut
    );

    const pricePerKm = this.configService.get<number>(
      'P2P_PRICE_PER_KM',
      200, // Prix par km par défaut
    );

    const fragileSurcharge = this.configService.get<number>(
      'P2P_FRAGILE_SURCHARGE',
      100, // Surcoût fragile par défaut
    );

    const weightSurchargePerKg = this.configService.get<number>(
      'P2P_WEIGHT_SURCHARGE_PER_KG',
      50, // Surcoût par kg au-dessus de 5kg
    );

    const weightThreshold = this.configService.get<number>(
      'P2P_WEIGHT_THRESHOLD',
      5, // Seuil de poids en kg
    );

    // Calcul du prix de base
    let totalPrice = minPrice + distance * pricePerKm;

    // Surcoût pour colis fragile
    if (isFragile) {
      totalPrice += fragileSurcharge;
    }

    // Surcoût pour poids élevé
    if (weight > weightThreshold) {
      totalPrice += (weight - weightThreshold) * weightSurchargePerKg;
    }

    return Math.round(totalPrice);
  }

  /**
   * Calcule le prix total pour une livraison P2P
   * @param pickupLat Latitude du ramassage
   * @param pickupLon Longitude du ramassage
   * @param dropoffLat Latitude de la livraison
   * @param dropoffLon Longitude de la livraison
   * @param isFragile Si le colis est fragile
   * @param weight Poids du colis en kg
   * @returns Objet contenant la distance et le prix
   */
  calculateP2PDelivery(
    pickupLat: number,
    pickupLon: number,
    dropoffLat: number,
    dropoffLon: number,
    isFragile: boolean = false,
    weight: number = 0,
  ): {
    distance: number;
    price: number;
    breakdown: {
      basePrice: number;
      distancePrice: number;
      fragileSurcharge: number;
      weightSurcharge: number;
    };
  } {
    const distance = this.calculateDistance(
      pickupLat,
      pickupLon,
      dropoffLat,
      dropoffLon,
    );

    const minPrice = this.configService.get<number>('P2P_MIN_PRICE', 500);
    const pricePerKm = this.configService.get<number>('P2P_PRICE_PER_KM', 200);
    const fragileSurcharge = this.configService.get<number>(
      'P2P_FRAGILE_SURCHARGE',
      100,
    );
    const weightSurchargePerKg = this.configService.get<number>(
      'P2P_WEIGHT_SURCHARGE_PER_KG',
      50,
    );
    const weightThreshold = this.configService.get<number>(
      'P2P_WEIGHT_THRESHOLD',
      5,
    );

    const basePrice = minPrice;
    const distancePrice = distance * pricePerKm;
    const fragileSurchargePrice = isFragile ? fragileSurcharge : 0;
    const weightSurchargePrice =
      weight > weightThreshold
        ? (weight - weightThreshold) * weightSurchargePerKg
        : 0;

    const totalPrice =
      basePrice + distancePrice + fragileSurchargePrice + weightSurchargePrice;

    return {
      distance,
      price: Math.round(totalPrice),
      breakdown: {
        basePrice,
        distancePrice: Math.round(distancePrice),
        fragileSurcharge: fragileSurchargePrice,
        weightSurcharge: Math.round(weightSurchargePrice),
      },
    };
  }

  /**
   * Convertit des degrés en radians
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}
