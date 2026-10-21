/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { UserRole } from '../../users/entities/user-role.enum';
import { OrderType } from '../../orders/entities/order.entity';
import { PenaltiesService, PENALTY_SCORE_IMPACT } from '../../penalties/penalties.service';
import { DeliveryPenaltyLevel } from '../../penalties/entities/delivery-penalty.entity';

/**
 * 📍 Structure pour le scoring des livreurs
 */
export interface DriverScore {
  driverId: string;
  driver: User;
  distanceKm: number;
  averageRating: number;
  score: number;
}

/**
 * 📊 Configuration des poids de scoring
 */
const SCORING_WEIGHTS = {
  DISTANCE: 0.6, // 60% de la note basée sur la distance
  RATING: 0.4, // 40% de la note basée sur la note moyenne
  MAX_DISTANCE_KM: 10, // Distance maximale acceptable (km)
  MIN_RATING: 3.0, // Note minimale acceptable
};

/** Distance maximale pour un livreur à vélo (au-delà, les vélos sont exclus) */
const MAX_BICYCLE_DISTANCE_KM = 3;

/**
 * 🎯 Scoring des livreurs internes (distance + note + contraintes vélo).
 * Service partagé : le cron de timeout ET le provider InternalFleet
 * utilisent la MÊME logique (source unique de vérité).
 */
@Injectable()
export class DriverScoringService {
  private readonly logger = new Logger(DriverScoringService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly penaltiesService: PenaltiesService,
  ) {}

  /**
   * 🧮 Formule Haversine pour calculer la distance entre deux coordonnées GPS
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
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * 🎯 Algorithme de Scoring des livreurs
   * Score = (Distance normalisée * 0.6) + (Rating normalisé * 0.4)
   */
  calculateDriverScore(
    distanceKm: number,
    averageRating: number,
  ): number {
    // Normaliser la distance (0 = excellent, 1 = mauvais)
    const normalizedDistance = Math.min(
      distanceKm / SCORING_WEIGHTS.MAX_DISTANCE_KM,
      1,
    );

    // Normaliser le rating (1 = mauvais, 0 = excellent)
    const normalizedRating = Math.max(
      (5 - averageRating) / (5 - SCORING_WEIGHTS.MIN_RATING),
      0,
    );

    // Calculer le score final (plus bas = meilleur)
    return (
      normalizedDistance * SCORING_WEIGHTS.DISTANCE +
      normalizedRating * SCORING_WEIGHTS.RATING
    );
  }

  /**
   * 🔍 Trouver les livreurs disponibles et les scorer
   * @param orderType Si RIDE : les livreurs à vélo (BICYCLE) sont pénalisés
   * (une moto/VTC est préférée pour une course de personnes).
   */
  async findAndScoreDrivers(
    originLat: number,
    originLng: number,
    orderType?: OrderType,
  ): Promise<DriverScore[]> {
    // 1. Récupérer tous les livreurs actifs et disponibles
    const drivers = await this.userRepository.find({
      where: {
        role: In([UserRole.DRIVER, UserRole.COURIER]),
        isActive: true,
      },
    });

    if (drivers.length === 0) {
      this.logger.warn('[Dispatch] Aucun livreur actif trouvé');
      return [];
    }

    // ⚖️ Pénalités qualité (bloc C) : UNE requête pour tous les candidats.
    // Une panne du module pénalités dégrade en « aucune sanction connue »
    // plutôt que de bloquer tout le dispatch — on préfère risquer de
    // solliciter un livreur sanctionné que de ne livrer personne.
    let driverLevels = new Map<string, DeliveryPenaltyLevel>();
    let agencyLevels = new Map<string, DeliveryPenaltyLevel>();
    try {
      driverLevels = await this.penaltiesService.getActiveDriverLevels(
        drivers.map((d) => d.id),
      );
      const agencyIds = [
        ...new Set(drivers.map((d) => d.agencyId).filter(Boolean)),
      ] as string[];
      agencyLevels =
        await this.penaltiesService.getActiveAgencyLevels(agencyIds);
    } catch (err) {
      this.logger.warn(
        `[Dispatch] Pénalités indisponibles au scoring : ${
          (err as Error)?.message ?? 'inconnu'
        }`,
      );
    }

    // 2. Calculer le score pour chaque livreur
    const scoredDrivers: DriverScore[] = [];

    for (const driver of drivers) {
      // Vérifier si le livreur a une position GPS enregistrée
      if (!driver.latitude || !driver.longitude) {
        this.logger.debug(
          `[Dispatch] Livreur ${driver.id} sans position GPS, ignoré`,
        );
        continue;
      }

      // Vérifier si le livreur est en ligne et disponible
      if (!driver.isOnline || !driver.isAvailable) {
        this.logger.debug(
          `[Dispatch] Livreur ${driver.id} hors ligne ou non disponible`,
        );
        continue;
      }

      const distanceKm = this.calculateDistance(
        originLat,
        originLng,
        driver.latitude,
        driver.longitude,
      );

      // Filtrer par distance maximale
      if (distanceKm > SCORING_WEIGHTS.MAX_DISTANCE_KM) {
        this.logger.debug(
          `[Dispatch] Livreur ${driver.id} trop loin (${distanceKm.toFixed(2)} km)`,
        );
        continue;
      }

      // 🚲 Exclure les livreurs à vélo si la distance est > 3 km
      const vehicle = String(driver.vehicleType || '').toUpperCase();
      if (vehicle === 'BICYCLE' && distanceKm > MAX_BICYCLE_DISTANCE_KM) {
        this.logger.debug(
          `[Dispatch] Livreur ${driver.id} à vélo exclu: distance ${distanceKm.toFixed(2)}km > ${MAX_BICYCLE_DISTANCE_KM}km`,
        );
        continue;
      }

      // Récupérer la note moyenne du livreur (via reviews service si disponible)
      const averageRating = driver.averageRating || 4.0; // Par défaut 4.0

      // Filtrer par note minimale
      if (averageRating < SCORING_WEIGHTS.MIN_RATING) {
        this.logger.debug(
          `[Dispatch] Livreur ${driver.id} note trop basse (${averageRating})`,
        );
        continue;
      }

      // ⚖️ Suspension (niveau 3) : le livreur, ou sa société de livraison,
      // est exclu du dispatch jusqu'à la fin de la sanction.
      const driverLevel = driverLevels.get(driver.id);
      const agencyLevel = driver.agencyId
        ? agencyLevels.get(driver.agencyId)
        : undefined;
      if (
        driverLevel === DeliveryPenaltyLevel.SUSPENSION ||
        agencyLevel === DeliveryPenaltyLevel.SUSPENSION
      ) {
        this.logger.debug(
          `[Dispatch] Livreur ${driver.id} exclu (suspension ${
            driverLevel === DeliveryPenaltyLevel.SUSPENSION
              ? 'individuelle'
              : 'de sa société'
          })`,
        );
        continue;
      }

      const baseScore = this.calculateDriverScore(distanceKm, averageRating);

      // 🏍️ RIDE : pénalité si le livreur se déplace à vélo / à pied (préférer moto/VTC)
      const isRide = orderType === OrderType.RIDE;
      const isSlowVehicle =
        vehicle === 'BICYCLE' || vehicle === 'FOOT' || vehicle === 'PIED';
      if (isRide && isSlowVehicle) {
        this.logger.debug(
          `[Dispatch] Livreur ${driver.id} à vélo (${vehicle}) pénalisé pour une course RIDE`,
        );
      }

      // ⚖️ Baisse de priorité : la sanction renchérit le score (rappel :
      // plus bas = meilleur). La sanction de la société compte moitié
      // moins que la sanction individuelle — un livreur ne doit pas payer
      // plein tarif pour une décision prise au niveau de son employeur.
      let penaltyImpact = 0;
      if (driverLevel) penaltyImpact += PENALTY_SCORE_IMPACT[driverLevel];
      if (agencyLevel) penaltyImpact += PENALTY_SCORE_IMPACT[agencyLevel] / 2;

      scoredDrivers.push({
        driverId: driver.id,
        driver,
        distanceKm,
        averageRating,
        score:
          baseScore + (isRide && isSlowVehicle ? 0.5 : 0) + penaltyImpact,
      });
    }

    // 3. Trier par score (le plus bas en premier)
    scoredDrivers.sort((a, b) => a.score - b.score);

    this.logger.log(
      `[Dispatch] ${scoredDrivers.length} livreur(s) éligible(s) trouvé(s)`,
    );

    return scoredDrivers;
  }
}
