import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeliveryProvider, DeliveryProviderResult, DeliveryTicket } from './delivery-provider.interface';
import { DeliveryProviderType } from './delivery-provider-type.enum';
import { DriverScoringService } from '../services/driver-scoring.service';
import { DispatchGateway } from '../dispatch.gateway';
import { DeliveryPricingService } from '../../orders/delivery-pricing.service';
import { Order } from '../../orders/entities/order.entity';
import { OrderType } from '../../orders/entities/order.entity';
import { Business } from '../../businesses/entities/business.entity';

/** Nombre de candidats notifiés en interne (top N du scoring) */
const TOP_CANDIDATES_COUNT = 3;
/** Durée de validité d'une offre candidat (ms) */
const OFFER_TTL_MS = 10 * 60 * 1000;

/**
 * 🏍️ Provider NIVEAU 1 — livreurs internes FasoFree.
 *
 * Encapsule la logique historique de dispatch (scoring → top 3 →
 * notification WebSocket) sans la modifier. Retourne `accepted=false`
 * quand aucun livreur n'est éligible → l'orchestrateur passe au
 * provider suivant (fail-over).
 */
@Injectable()
export class InternalFleetProvider implements DeliveryProvider {
  readonly type = DeliveryProviderType.INTERNAL;
  readonly name = 'internal';
  /** Le pool interne couvre toutes les zones */
  readonly zones: string[] = [];

  private readonly logger = new Logger(InternalFleetProvider.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
    private readonly driverScoringService: DriverScoringService,
    private readonly dispatchGateway: DispatchGateway,
    private readonly deliveryPricingService: DeliveryPricingService,
  ) {}

  async canHandle(_ticket: DeliveryTicket): Promise<boolean> {
    // Toujours candidat : c'est le scoring qui décide en aval
    // (aucun livreur éligible → accepted=false).
    return true;
  }

  async createDelivery(ticket: DeliveryTicket): Promise<DeliveryProviderResult> {
    const order = await this.orderRepository.findOne({
      where: { id: ticket.orderId },
    });
    if (!order) {
      return { accepted: false, message: 'Commande introuvable' };
    }

    const originLatitude = ticket.pickupLatitude ?? null;
    const originLongitude = ticket.pickupLongitude ?? null;
    if (!originLatitude || !originLongitude) {
      this.logger.error(
        `[Internal Fleet] Commande #${ticket.orderId} sans coordonnées GPS de référence`,
      );
      return { accepted: false, message: 'Coordonnées de référence manquantes' };
    }

    // 🎯 Scoring des livreurs internes
    const scoredDrivers = await this.driverScoringService.findAndScoreDrivers(
      originLatitude,
      originLongitude,
      ticket.orderType as OrderType | undefined,
    );

    if (scoredDrivers.length === 0) {
      this.logger.warn(
        `[Internal Fleet] Aucun livreur éligible pour la commande #${ticket.orderId}`,
      );
      return { accepted: false, message: 'Aucun livreur éligible' };
    }

    // 📣 Notifier les 3 meilleurs candidats
    const topCandidates = scoredDrivers.slice(0, TOP_CANDIDATES_COUNT);
    const driverIds = topCandidates.map((c) => c.driverId);

    topCandidates.forEach((candidate, index) => {
      this.logger.log(
        `[Internal Fleet] Candidat #${index + 1} pour la commande #${ticket.orderId}: ${candidate.driver.fullName} — ${candidate.distanceKm.toFixed(2)} km — rating ${candidate.averageRating} — score ${candidate.score.toFixed(3)}`,
      );
    });

    // Stocker les candidats notifiés pour le timeout / refus
    order.dispatchCandidates = topCandidates.map((c) => ({
      driverId: c.driverId,
      score: c.score,
      notifiedAt: new Date(),
    }));
    order.dispatchedAt = new Date();
    await this.orderRepository.save(order);

    this.dispatchGateway.notifyCandidateDrivers(driverIds, {
      type: 'NEW_ORDER_OFFER',
      orderId: order.id,
      orderType: order.orderType,
      businessName: ticket.businessName || 'Course à la demande',
      businessAddress: ticket.pickupAddress,
      pickupAddress: ticket.pickupAddress || null,
      pickupLatitude: ticket.pickupLatitude,
      pickupLongitude: ticket.pickupLongitude,
      deliveryAddress: ticket.deliveryAddress,
      deliveryLatitude: ticket.deliveryLatitude,
      deliveryLongitude: ticket.deliveryLongitude,
      earningXOF: ticket.pricingResult ?? ticket.deliveryFeeXOF,
      totalAmount: ticket.totalAmount,
      estimatedDistanceKm: topCandidates[0].distanceKm,
      expiresAt: new Date(Date.now() + OFFER_TTL_MS).toISOString(),
    });

    this.logger.log(
      `[Internal Fleet] Notification envoyée à ${driverIds.length} livreur(s) pour la commande #${ticket.orderId}`,
    );

    return {
      accepted: true,
      status: 'DISPATCHED',
      details: { candidateCount: driverIds.length },
    };
  }
}
