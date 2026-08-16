import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/entities/user-role.enum';
import { Business } from '../businesses/entities/business.entity';
import {
  Order,
  OrderStatus,
  OrderType,
  FulfillmentType,
} from '../orders/entities/order.entity';
import { DispatchGateway } from './dispatch.gateway';

/**
 * 📍 Structure pour le scoring des livreurs
 */
interface DriverScore {
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

@Injectable()
export class DispatchService {
  private readonly logger = new Logger(DispatchService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly dispatchGateway: DispatchGateway,
  ) {}

  /**
   * 🧮 Formule Haversine pour calculer la distance entre deux coordonnées GPS
   * @returns Distance en kilomètres
   */
  private calculateDistance(
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
  private calculateDriverScore(
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
    const score =
      normalizedDistance * SCORING_WEIGHTS.DISTANCE +
      normalizedRating * SCORING_WEIGHTS.RATING;

    return score;
  }

  /**
   * 🔍 Trouver les livreurs disponibles et les scorer
   * @param orderType Si RIDE : les livreurs à vélo (BICYCLE) sont pénalisés
   * (une moto/VTC est préférée pour une course de personnes).
   */
  private async findAndScoreDrivers(
    originLat: number,
    originLng: number,
    orderType?: OrderType,
  ): Promise<DriverScore[]> {
    // 1. Récupérer tous les livreurs actifs et disponibles
    const drivers = await this.userRepository.find({
      where: {
        role: UserRole.DRIVER,
        isActive: true,
      },
    });

    if (drivers.length === 0) {
      this.logger.warn('[Dispatch] Aucun livreur actif trouvé');
      return [];
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

      // Récupérer la note moyenne du livreur (via reviews service si disponible)
      const averageRating = driver.averageRating || 4.0; // Par défaut 4.0

      // Filtrer par note minimale
      if (averageRating < SCORING_WEIGHTS.MIN_RATING) {
        this.logger.debug(
          `[Dispatch] Livreur ${driver.id} note trop basse (${averageRating})`,
        );
        continue;
      }

      const score = this.calculateDriverScore(distanceKm, averageRating);

      // 🏍️ RIDE : pénalité si le livreur se déplace à vélo / à pied (préférer moto/VTC)
      const isRide = orderType === OrderType.RIDE;
      const vehicle = String(driver.vehicleType || '').toUpperCase();
      if (isRide && (vehicle === 'BICYCLE' || vehicle === 'FOOT' || vehicle === 'PIED')) {
        this.logger.debug(
          `[Dispatch] Livreur ${driver.id} à vélo (${vehicle}) pénalisé pour une course RIDE`,
        );
      }

      scoredDrivers.push({
        driverId: driver.id,
        driver,
        distanceKm,
        averageRating,
        score: isRide &&
          (vehicle === 'BICYCLE' || vehicle === 'FOOT' || vehicle === 'PIED')
          ? score + 0.5
          : score,
      });
    }

    // 3. Trier par score (le plus bas en premier)
    scoredDrivers.sort((a, b) => a.score - b.score);

    this.logger.log(
      `[Dispatch] ${scoredDrivers.length} livreur(s) éligible(s) trouvé(s)`,
    );

    return scoredDrivers;
  }

  /**
   * 🚀 Assigner automatiquement une commande au meilleur livreur
   * Ou notifier les 3 meilleurs candidats
   */
  async autoDispatchOrder(orderId: string): Promise<void> {
    this.logger.log(
      `[Auto-Dispatch] Début du dispatch pour la commande #${orderId}`,
    );

    // 1. Récupérer la commande
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });

    if (!order) {
      this.logger.error(`[Auto-Dispatch] Commande #${orderId} introuvable`);
      return;
    }

    // 2. Vérifier si le dispatch est nécessaire
    // Skip dispatch pour PICKUP ou DINE_IN
    if (
      order.fulfillmentType === FulfillmentType.PICKUP ||
      order.fulfillmentType === FulfillmentType.DINE_IN
    ) {
      this.logger.log(
        `[Auto-Dispatch] Commande #${orderId} est en mode ${order.fulfillmentType} - Pas de dispatch nécessaire`,
      );
      return;
    }

    // Récupérer le commerce (seulement pour les commandes marchand)
    const business = order.businessId
      ? await this.businessRepository.findOne({
          where: { id: order.businessId },
        })
      : null;

    // Skip dispatch si le commerçant a ses propres livreurs
    if (business?.hasOwnDrivers) {
      this.logger.log(
        `[Auto-Dispatch] Commerçant #${order.businessId} utilise ses propres livreurs - Pas de dispatch FasoFree`,
      );
      return;
    }

    // 3. Récupérer les coordonnées de référence (commerce OU point de ramassage P2P)
    const originLatitude = business?.latitude ?? order.pickupLocation?.latitude;
    const originLongitude =
      business?.longitude ?? order.pickupLocation?.longitude;

    if (!originLatitude || !originLongitude) {
      this.logger.error(
        `[Auto-Dispatch] Commande #${order.businessId ?? 'P2P'} sans coordonnées GPS de référence`,
      );
      return;
    }

    // Adresse de livraison (colis P2P ou commerce marchand)
    const deliveryAddress =
      order.dropoffLocation?.address || business?.address || null;

    // 4. Trouver et scorer les livreurs
    const scoredDrivers = await this.findAndScoreDrivers(
      originLatitude,
      originLongitude,
      order.orderType,
    );

    if (scoredDrivers.length === 0) {
      this.logger.warn(
        `[Auto-Dispatch] Aucun livreur éligible pour la commande #${orderId}`,
      );
      // Notifier le système qu'aucun livreur n'est disponible
      this.dispatchGateway.notifyNewOrderToBusiness(order.businessId, order);
      return;
    }

    // 5. Stratégie d'assignation
    // Option A: Assigner automatiquement au meilleur livreur
    // Option B: Notifier les 3 meilleurs candidats

    const TOP_CANDIDATES_COUNT = 3;
    const topCandidates = scoredDrivers.slice(0, TOP_CANDIDATES_COUNT);

    this.logger.log(
      `[Auto-Dispatch] Top ${topCandidates.length} candidat(s) pour la commande #${orderId}:`,
    );

    topCandidates.forEach((candidate, index) => {
      this.logger.log(
        `  #${index + 1}: ${candidate.driver.fullName} - Distance: ${candidate.distanceKm.toFixed(2)}km - Rating: ${candidate.averageRating} - Score: ${candidate.score.toFixed(3)}`,
      );
    });

    // 6. Notifier les candidats via WebSocket
    const driverIds = topCandidates.map((c) => c.driverId);

    // Stocker les candidats notifiés pour le timeout
    const notifiedCandidates = topCandidates.map((c) => ({
      driverId: c.driverId,
      score: c.score,
      notifiedAt: new Date(),
    }));

    // Mettre à jour la commande avec les candidats notifiés
    order.dispatchCandidates = notifiedCandidates;
    order.dispatchedAt = new Date();
    await this.orderRepository.save(order);

    this.dispatchGateway.notifyCandidateDrivers(driverIds, {
      type: 'NEW_ORDER_OFFER',
      orderId: order.id,
      orderType: order.orderType,
      businessName: business?.name || 'Course à la demande',
      businessAddress: business?.address || order.pickupLocation?.address,
      pickupAddress:
        order.pickupLocation?.address || business?.address || null,
      pickupLatitude: order.pickupLocation?.latitude,
      pickupLongitude: order.pickupLocation?.longitude,
      deliveryAddress,
      deliveryLatitude: order.deliveryLocation?.latitude,
      deliveryLongitude: order.deliveryLocation?.longitude,
      earningXOF: order.deliveryFee,
      totalAmount: order.totalAmount,
      estimatedDistanceKm: topCandidates[0].distanceKm,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes
    });

    this.logger.log(
      `[Auto-Dispatch] Notification envoyée à ${driverIds.length} livreur(s) pour la commande #${orderId}`,
    );
  }

  /**
   * ⏰ CRON JOB: Vérifier les timeouts de dispatch (toutes les minutes)
   * Réassigne aux candidats suivants si aucun livreur n'accepte dans les 5 minutes
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async checkDispatchTimeouts(): Promise<void> {
    this.logger.log('[Dispatch Timeout] Vérification des timeouts de dispatch');

    try {
      // Trouver les commandes en attente de livreur depuis plus de 5 minutes
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

      const pendingOrders = await this.orderRepository
        .createQueryBuilder('order')
        .where('order.status = :status', { status: OrderStatus.PAID })
        .andWhere('order.dispatchedAt < :timeout', { timeout: fiveMinutesAgo })
        .andWhere('order.driverId IS NULL')
        .getMany();

      for (const order of pendingOrders) {
        if (
          !order.dispatchCandidates ||
          order.dispatchCandidates.length === 0
        ) {
          continue;
        }

        this.logger.log(
          `[Dispatch Timeout] Commande #${order.id} en attente depuis 5 min - Réassignation`,
        );

        // Trouver le candidat suivant qui n'a pas encore été notifié
        const notifiedDriverIds = order.dispatchCandidates.map(
          (c) => c.driverId,
        );

        // Récupérer les coordonnées de référence (commerce OU point de ramassage RIDE/P2P)
        const business = order.businessId
          ? await this.businessRepository.findOne({
              where: { id: order.businessId },
            })
          : null;

        const originLatitude =
          business?.latitude ?? order.pickupLocation?.latitude;
        const originLongitude =
          business?.longitude ?? order.pickupLocation?.longitude;

        if (!originLatitude || !originLongitude) {
          this.logger.warn(
            `[Dispatch Timeout] Commande #${order.id} sans coordonnées GPS de référence — réassignation ignorée`,
          );
          continue;
        }

        const scoredDrivers = await this.findAndScoreDrivers(
          originLatitude,
          originLongitude,
          order.orderType,
        );

        // Filtrer les candidats déjà notifiés
        const remainingCandidates = scoredDrivers.filter(
          (c) => !notifiedDriverIds.includes(c.driverId),
        );

        if (remainingCandidates.length === 0) {
          this.logger.warn(
            `[Dispatch Timeout] Plus de candidats disponibles pour la commande #${order.id}`,
          );
          // Notifier le commerçant qu'aucun livreur n'est disponible
          this.dispatchGateway.notifyNewOrderToBusiness(
            order.businessId,
            order,
          );
          continue;
        }

        // Notifier le prochain candidat
        const nextCandidate = remainingCandidates[0];
        const newNotifiedCandidates = [
          ...order.dispatchCandidates,
          {
            driverId: nextCandidate.driverId,
            score: nextCandidate.score,
            notifiedAt: new Date(),
          },
        ];

        order.dispatchCandidates = newNotifiedCandidates;
        order.dispatchedAt = new Date();
        await this.orderRepository.save(order);

        this.dispatchGateway.notifyCandidateDrivers([nextCandidate.driverId], {
          type: 'NEW_ORDER_OFFER',
          orderId: order.id,
          orderType: order.orderType,
          businessName: business?.name || 'Course à la demande',
          businessAddress: business?.address || order.pickupLocation?.address,
          pickupAddress:
            order.pickupLocation?.address || business?.address || null,
          pickupLatitude: order.pickupLocation?.latitude,
          pickupLongitude: order.pickupLocation?.longitude,
          deliveryAddress:
            order.dropoffLocation?.address || business?.address,
          deliveryLatitude: order.deliveryLocation?.latitude,
          deliveryLongitude: order.deliveryLocation?.longitude,
          earningXOF: order.deliveryFee,
          totalAmount: order.totalAmount,
          estimatedDistanceKm: nextCandidate.distanceKm,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        });

        this.logger.log(
          `[Dispatch Timeout] Notification envoyée au candidat suivant ${nextCandidate.driverId} pour la commande #${order.id}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `[Dispatch Timeout Error] Erreur lors de la vérification des timeouts: ${error.message}`,
      );
    }
  }

  /**
   * 🎯 Assigner manuellement une commande à un livreur spécifique
   */
  async assignDriverToOrder(orderId: string, driverId: string): Promise<Order> {
    this.logger.log(
      `[Manual Assign] Assignation de la commande #${orderId} au livreur ${driverId}`,
    );

    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });
    if (!order) {
      throw new Error(`Commande #${orderId} introuvable`);
    }

    const driver = await this.userRepository.findOne({
      where: { id: driverId, role: UserRole.DRIVER },
    });
    if (!driver) {
      throw new Error(`Livreur ${driverId} introuvable`);
    }

    order.driverId = driverId;
    order.status = OrderStatus.PROCESSING; // IN_TRANSIT
    const updatedOrder = await this.orderRepository.save(order);

    // Notifier le livreur
    this.dispatchGateway.notifyCandidateDrivers([driverId], {
      type: 'ORDER_ASSIGNED',
      orderId: order.id,
      message: 'Vous avez été assigné à cette commande',
    });

    return updatedOrder;
  }
}
