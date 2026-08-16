import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { Order } from './entities/order.entity';
import { DispatchGateway } from '../dispatch/dispatch.gateway';
import {
  DeliveryPricingService,
  VehicleType,
} from './delivery-pricing.service';

export interface DriverLocation {
  driverId: string;
  latitude: number;
  longitude: number;
  updatedAt: number;
}

export interface CandidateDriverMatch {
  driverId: string;
  distanceKm: number;
}

export interface OrderTracePoint {
  latitude: number;
  longitude: number;
  heading?: number;
  timestamp: string;
}

/**
 * 🛰️ Service de géolocalisation temps réel des livreurs (Redis Geo).
 *
 * NB: Service distinct de `DispatchService` (scoring/assignation) qui vit dans
 * le module `dispatch/`. Ce service gère UNIQUEMENT la position GPS en temps
 * réel des livreurs via Redis Geo et le broadcast WebSocket.
 */
@Injectable()
export class GeoDispatchService {
  private readonly logger = new Logger(GeoDispatchService.name);
  private readonly DRIVERS_GEO_KEY = 'drivers:locations:geo';
  private readonly DRIVER_TTL_SECONDS = 300;
  private readonly ORDER_TRACE_KEY_PREFIX = 'order:trace:';
  private readonly ORDER_TRACE_MAX_POINTS = 50;

  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    // 🛡️ LE FIX EST ICI : forwardRef casse la boucle infinie avec le module Dispatch
    @Inject(forwardRef(() => DispatchGateway))
    private readonly dispatchGateway: DispatchGateway,
    private readonly configService: ConfigService,
    private readonly pricingService: DeliveryPricingService,
  ) {}

  /**
   * 📍 1. Mise à jour GPS ultra-rapide
   */
  async updateDriverLocation(
    driverId: string,
    latitude: number,
    longitude: number,
  ): Promise<void> {
    const pipeline = this.redis.pipeline();

    pipeline.geoadd(this.DRIVERS_GEO_KEY, longitude, latitude, driverId);
    pipeline.setex(
      `driver:${driverId}:meta`,
      this.DRIVER_TTL_SECONDS,
      JSON.stringify({
        latitude,
        longitude,
        updatedAt: Date.now(),
      }),
    );

    await pipeline.exec();
  }

  /**
   * 📍 1b. Récupérer la dernière position connue d'un livreur (Redis).
   */
  async getDriverLocation(driverId: string): Promise<DriverLocation | null> {
    try {
      const raw = await this.redis.get(`driver:${driverId}:meta`);
      if (!raw) return null;
      const meta = JSON.parse(raw);
      return {
        driverId,
        latitude: meta.latitude,
        longitude: meta.longitude,
        updatedAt: meta.updatedAt,
      };
    } catch (err) {
      this.logger.warn(
        `Lecture position livreur ${driverId} impossible: ${err.message}`,
      );
      return null;
    }
  }

  /**
   * 🗺️ 1c. Enregistrer un point de tracé GPS pour une commande en cours (IN_TRANSIT).
   */
  async saveOrderTracePoint(
    orderId: string,
    latitude: number,
    longitude: number,
    heading?: number,
  ): Promise<void> {
    const key = `${this.ORDER_TRACE_KEY_PREFIX}${orderId}`;
    const point: OrderTracePoint = {
      latitude,
      longitude,
      heading,
      timestamp: new Date().toISOString(),
    };

    const pipeline = this.redis.pipeline();
    pipeline.rpush(key, JSON.stringify(point));
    // Garder seulement les N derniers points pour ne pas faire grossir Redis
    pipeline.ltrim(key, -this.ORDER_TRACE_MAX_POINTS, -1);
    pipeline.expire(key, 60 * 60 * 24); // TTL 24h
    await pipeline.exec();
  }

  /**
   * 🗺️ 1d. Récupérer le tracé complet de la course.
   */
  async getOrderTrace(orderId: string): Promise<OrderTracePoint[]> {
    try {
      const raw = await this.redis.lrange(
        `${this.ORDER_TRACE_KEY_PREFIX}${orderId}`,
        0,
        -1,
      );
      return raw.map((entry) => JSON.parse(entry) as OrderTracePoint);
    } catch (err) {
      this.logger.warn(`Lecture tracé ${orderId} impossible: ${err.message}`);
      return [];
    }
  }

  /**
   * 🗑️ 1e. Purger le tracé d'une commande (statut terminal).
   */
  async clearOrderTrace(orderId: string): Promise<void> {
    await this.redis.del(`${this.ORDER_TRACE_KEY_PREFIX}${orderId}`);
  }

  /**
   * 🎯 2. Recherche avec validation d'activité
   */
  async findNearbyActiveDrivers(
    latitude: number,
    longitude: number,
    radiusInKm: number = 5.0,
    limit: number = 10,
  ): Promise<CandidateDriverMatch[]> {
    const nearbyDriverIds = (await this.redis.geosearch(
      this.DRIVERS_GEO_KEY,
      'FROMLONLAT',
      longitude,
      latitude,
      'BYRADIUS',
      radiusInKm,
      'km',
      'ASC',
      'COUNT',
      limit * 2,
    )) as string[];

    if (!nearbyDriverIds || nearbyDriverIds.length === 0) {
      return [];
    }

    const pipeline = this.redis.pipeline();
    nearbyDriverIds.forEach((id) => pipeline.get(`driver:${id}:meta`));

    const results = await pipeline.exec();

    if (!results) {
      return [];
    }

    const activeDrivers: CandidateDriverMatch[] = [];
    const expiredDriverIds: string[] = [];

    nearbyDriverIds.forEach((driverId, index) => {
      const entry = results[index];
      if (!entry) return;

      const [err, metaDataStr] = entry;

      if (!err && typeof metaDataStr === 'string') {
        const meta = JSON.parse(metaDataStr);
        const distanceKm = this.calculateHaversineDistance(
          latitude,
          longitude,
          meta.latitude,
          meta.longitude,
        );

        activeDrivers.push({ driverId, distanceKm });
      } else {
        expiredDriverIds.push(driverId);
      }
    });

    if (expiredDriverIds.length > 0) {
      this.redis
        .zrem(this.DRIVERS_GEO_KEY, ...expiredDriverIds)
        .catch((err) => {
          this.logger.warn(
            `Échec de la purge des livreurs inactifs: ${err.message}`,
          );
        });
    }

    return activeDrivers.slice(0, limit);
  }

  /**
   * 📡 3. Engine de Dispatch Adaptatif
   */
  async dispatchOrderToCandidateDrivers(order: Order): Promise<boolean> {
    if (!order.deliveryLocation) {
      this.logger.warn(
        `[Dispatch Aborted] Pas de coordonnées GPS sur la commande #${order.id}`,
      );
      return false;
    }

    const { latitude, longitude } = order.deliveryLocation;
    const radiusStepsInKm = [3.0, 5.0, 10.0];
    let candidates: CandidateDriverMatch[] = [];

    for (const radius of radiusStepsInKm) {
      candidates = await this.findNearbyActiveDrivers(
        latitude,
        longitude,
        radius,
        5,
      );
      if (candidates.length > 0) {
        this.logger.log(
          `[Dispatch Match] ${candidates.length} livreur(s) actif(s) trouvé(s) dans un rayon de ${radius} km pour la commande #${order.id}`,
        );
        break;
      }
    }

    if (candidates.length === 0) {
      this.logger.warn(
        `[Dispatch Miss] Aucun livreur actif disponible dans un rayon de 10 km pour la commande #${order.id}`,
      );
      return false;
    }

    const closestDriver = candidates[0];

    if (!closestDriver) {
      this.logger.warn(`[Dispatch] Aucun candidat trouvé.`);
      return false;
    }

    const deliveryFee = this.pricingService.calculateDeliveryFee(
      closestDriver.distanceKm,
      VehicleType.MOTORCYCLE,
    );

    const candidateIds = candidates.map((c) => c.driverId);

    this.logger.log(
      `[Dispatch] Livreur ${closestDriver.driverId} trouvé à ${closestDriver.distanceKm}km. Tarif: ${deliveryFee} FCFA`,
    );

    this.dispatchGateway.notifyCandidateDrivers(candidateIds, {
      orderId: order.id,
      pickupAddress: order.businessId,
      deliveryFee: Number(deliveryFee),
      totalAmount: Number(order.totalAmount),
      distanceKm: Number(closestDriver.distanceKm.toFixed(2)),
    });

    return true;
  }

  private calculateHaversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const EARTH_RADIUS_KM = 6371;
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return EARTH_RADIUS_KM * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}
