import { Injectable, Logger } from '@nestjs/common';
import { Inject, forwardRef } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/entities/user-role.enum';
import { Business } from '../businesses/entities/business.entity';
import {
  Order,
  OrderStatus,
  FulfillmentType,
} from '../orders/entities/order.entity';
import { DispatchGateway } from './dispatch.gateway';
import { DeliveryPricingService } from '../orders/delivery-pricing.service';
import { DeliveryProviderRegistry } from './providers/delivery-provider.registry';
import { DeliveryTicket } from './providers/delivery-provider.interface';
import { DriverScoringService } from './services/driver-scoring.service';
import { OrdersService } from '../orders/orders.service';
import { NotificationStoreService } from '../notifications/notification-store.service';
import { NotificationType } from '../notifications/entities/notification.entity';

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
    private readonly deliveryPricingService: DeliveryPricingService,
    private readonly configService: ConfigService,
    private readonly providerRegistry: DeliveryProviderRegistry,
    private readonly driverScoringService: DriverScoringService,
    @Inject(forwardRef(() => OrdersService))
    private readonly ordersService: OrdersService,
    private readonly notificationStore: NotificationStoreService,
  ) {}

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

    // 💰 Calcul des frais de livraison avec le tarif véhicule
    const ticket = this.buildTicket(order, business);

    // 🧭 ORCHESTRATEUR MULTI-NIVEAUX :
    // essaie chaque provider dans l'ordre configuré (DELIVERY_PROVIDERS).
    // L'échec d'un niveau n'est PAS une erreur finale → fail-over.
    const handled = await this.dispatchThroughProviders(order, ticket);

    if (!handled) {
      // ⛔ Tous les niveaux ont échoué : aucun moyen de livraison.
      this.logger.warn(
        `[Auto-Dispatch] Aucun provider de livraison disponible pour la commande #${orderId}`,
      );
      // Notifier le système qu'aucun livreur n'est disponible
      this.dispatchGateway.notifyNewOrderToBusiness(order.businessId, order);
      await this.markEscalated(order);
    }
  }

  /**
   * 🎟️ Construit le ticket standardisé transmis aux providers.
   */
  private buildTicket(order: Order, business: Business | null): DeliveryTicket {
    const originLatitude = business?.latitude ?? order.pickupLocation?.latitude;
    const originLongitude =
      business?.longitude ?? order.pickupLocation?.longitude;

    const estimatedDistanceKm =
      business && originLatitude && originLongitude
        ? this.driverScoringService.calculateDistance(
            originLatitude,
            originLongitude,
            order.deliveryLocation?.latitude ?? originLatitude,
            order.deliveryLocation?.longitude ?? originLongitude,
          )
        : 0;
    const resolvedVehicleType =
      this.deliveryPricingService.resolveVehicleType();
    const calculatedFee = this.deliveryPricingService.calculateDeliveryFee(
      estimatedDistanceKm,
      resolvedVehicleType,
    );

    return {
      orderId: order.id,
      orderType: order.orderType,
      fulfillmentType: order.fulfillmentType,
      pickupAddress:
        order.pickupLocation?.address || business?.address || null,
      // ⚠️ L'origine de scoring DOIT être business|pickup (comme
      // l'historique), sinon le provider interne refuse les commandes
      // marchands dont pickupLocation est null.
      pickupLatitude:
        business?.latitude ?? order.pickupLocation?.latitude ?? null,
      pickupLongitude:
        business?.longitude ?? order.pickupLocation?.longitude ?? null,
      deliveryAddress:
        order.dropoffLocation?.address || business?.address || null,
      deliveryLatitude: order.deliveryLocation?.latitude ?? null,
      deliveryLongitude: order.deliveryLocation?.longitude ?? null,
      deliveryFeeXOF: calculatedFee?.fee ?? Number(order.deliveryFee || 0),
      pricingResult: calculatedFee,
      totalAmount: Number(order.totalAmount || 0),
      businessName: business?.name || null,
    };
  }

  /**
   * 🧭 Parcourt la chaîne de providers (fail-over).
   * Retourne true dès qu'un provider prend la course en charge.
   */
  private async dispatchThroughProviders(
    order: Order,
    ticket: DeliveryTicket,
  ): Promise<boolean> {
    for (const provider of this.providerRegistry.getAll()) {
      try {
        const canHandle = await provider.canHandle(ticket);
        if (!canHandle) {
          this.logger.debug(
            `[Dispatch] Provider "${provider.name}" ne peut pas traiter la commande #${ticket.orderId}`,
          );
          continue;
        }

        const result = await provider.createDelivery(ticket);
        if (!result.accepted) {
          this.logger.debug(
            `[Dispatch] Provider "${provider.name}" a refusé la commande #${ticket.orderId} (${result.message ?? 'non acceptée'})`,
          );
          continue;
        }

        // Recharger la commande pour ne pas écraser les mutations
        // du provider (candidats notifiés, etc.)
        const fresh = await this.orderRepository.findOne({
          where: { id: order.id },
        });
        if (fresh) {
          fresh.deliveryProvider = provider.name;
          fresh.deliveryProviderId = result.providerId ?? null;
          fresh.deliveryExternalRef = result.externalRef ?? null;
          fresh.deliveryProviderStatus = result.status ?? 'ROUTED';
          fresh.deliveryProviderDetails = result.details ?? null;
          fresh.deliveryProviderTriedAt = new Date();
          if (
            result.details?.agencyCommissionXof != null
          ) {
            fresh.agencyCommissionXof = result.details.agencyCommissionXof;
          }
          await this.orderRepository.save(fresh);
        }

        this.logger.log(
          `[Dispatch] Commande #${ticket.orderId} prise en charge par le provider "${provider.name}"`,
        );
        return true;
      } catch (err) {
        // Un provider en erreur ne bloque pas les suivants
        this.logger.error(
          `[Dispatch] Provider "${provider.name}" en erreur sur la commande #${ticket.orderId}: ${
            (err as Error)?.message ?? 'inconnu'
          }`,
        );
        continue;
      }
    }
    return false;
  }

  /**
   * 🚨 Marque la commande comme ESCALÉE (Niveau 4 : intervention
   * humaine) quand aucun moyen de livraison n'a pu la prendre
   * en charge. Marquage purement indicatif (visible en supervision).
   */
  private async markEscalated(order: Order): Promise<void> {
    try {
      const fresh = await this.orderRepository.findOne({
        where: { id: order.id },
      });
      if (!fresh || fresh.deliveryProviderStatus === 'ESCALATED') {
        return;
      }
      fresh.deliveryProviderStatus = 'ESCALATED';
      fresh.deliveryProviderTriedAt = new Date();
      await this.orderRepository.save(fresh);
      this.logger.warn(
        `[Dispatch] Commande #${order.id} ESCALÉE — aucun moyen de livraison (intervention opérateur requise)`,
      );
    } catch (err) {
      this.logger.error(
        `[Dispatch] Impossible de marquer l'escalade pour la commande #${order.id}: ${
          (err as Error)?.message ?? 'inconnu'
        }`,
      );
    }
  }

  /**
   * ⏰ CRON JOB: Vérifier les timeouts de dispatch (toutes les minutes)
   * Réassigne aux candidats suivants si aucun livreur n'accepte dans les 10 minutes
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async checkDispatchTimeouts(): Promise<void> {
    this.logger.log('[Dispatch Timeout] Vérification des timeouts de dispatch');

    try {
      // Trouver les commandes en attente de livreur depuis plus
      // de DISPATCH_TIMEOUT_MS (défaut : 10 minutes)
      const timeoutMs =
        Number(this.configService.get<number>('DISPATCH_TIMEOUT_MS')) ||
        10 * 60 * 1000;
      const timeout = new Date(Date.now() - timeoutMs);

      const pendingOrders = await this.orderRepository
        .createQueryBuilder('o')
        .where('o.status = :status', { status: OrderStatus.READY_FOR_PICKUP })
        .andWhere('o."dispatchedAt" < :timeout', { timeout })
        .andWhere('o."driverId" IS NULL')
        .getMany();

      for (const order of pendingOrders) {
        if (
          !order.dispatchCandidates ||
          order.dispatchCandidates.length === 0
        ) {
          // 🧭 Commande sans candidats internes :
          //  - déjà routée vers un provider externe (agence/manuel)
          //    → on attend sa prise en charge, rien à faire ;
          //  - sinon → fail-over : réessaie la chaîne complète
          //    (interne → agence → manuel) puis escalade SLA.
          const routedProvider = order.deliveryProvider;
          if (routedProvider && routedProvider !== 'internal') {
            continue;
          }
          await this.failoverToNextProvider(order);
          continue;
        }

        this.logger.log(
          `[Dispatch Timeout] Commande #${order.id} en attente depuis 10 min - Réassignation`,
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

        const scoredDrivers = await this.driverScoringService.findAndScoreDrivers(
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
          // 🧭 Fail-over vers les autres niveaux + escalade SLA
          await this.failoverToNextProvider(order);
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
          pickupLatitude: originLatitude ?? null,
          pickupLongitude: originLongitude ?? null,
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
   * 🧭 Fail-over (cron) : reconstruit le ticket et réessaie
   * la chaîne complète de providers. Utilisé quand le pool
   * interne est épuisé (plus aucun candidat) — le niveau
   * suivant (agence, manuel) prend le relais.
   */
  private async failoverToNextProvider(order: Order): Promise<void> {
    try {
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
          `[Dispatch Timeout] Commande #${order.id} sans coordonnées GPS de référence — fail-over ignoré`,
        );
        return;
      }

      const ticket = this.buildTicket(order, business);
      const handled = await this.dispatchThroughProviders(order, ticket);

      if (handled) {
        this.logger.log(
          `[Dispatch Timeout] Fail-over réussi pour la commande #${order.id}`,
        );
      } else {
        // Rien n'a pu prendre en charge → escalade SLA (Niveau 4)
        await this.markEscalated(order);
      }
    } catch (err) {
      this.logger.error(
        `[Dispatch Timeout Error] Fail-over impossible pour la commande #${order.id}: ${
          (err as Error)?.message ?? 'inconnu'
        }`,
      );
    }
  }

  /**
   * 🎯 Refuser une course : le livreur refuse et passe au suivant
   */
  async refuseOrder(orderId: string, driverId: string): Promise<void> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });
    if (!order) throw new Error(`Commande #${orderId} introuvable`);

    if (order.driverId === driverId) {
      throw new Error(`Vous etes deja assigne a cette commande`);
    }

    if (order.status !== 'PENDING' && order.status !== 'PAID' && order.status !== 'READY_FOR_PICKUP') {
      throw new Error(`Impossible de refuser : commande au statut "${order.status}"`);
    }

    const candidates = order.dispatchCandidates || [];
    const existing = candidates.find((c) => c.driverId === driverId);
    if (existing) {
      existing.refused = true;
      existing.refusedAt = new Date().toISOString();
    } else {
      candidates.push({ driverId, refused: true, refusedAt: new Date().toISOString() });
    }
    order.dispatchCandidates = candidates;
    await this.orderRepository.save(order);

    // 🚦 Tous les livreurs notifiés ont refusé sur CETTE course →
    //    alerte immédiate marchand + fail-over de secours (sans attendre le cron).
    const allRefused =
      candidates.length > 0 && candidates.every((c) => c.refused);
    if (allRefused) {
      this.logger.warn(
        `[Refus Course] La commande #${orderId} a été refusée par tous les candidats — fail-over immédiat`,
      );
      try {
        this.dispatchGateway.notifyNewOrderToBusiness(order.businessId, order);
      } catch { /* noop */ }
      try {
        await this.failoverToNextProvider(order);
      } catch (err) {
        this.logger.error(`[Refus Course] Fail-over #${orderId}: ${err.message}`);
      }
    }

    // 📊 Méta-refus livreur : signaler S’il refuse fréquemment.
    // Alerte une seule fois par fenêtre 24h (au croisement du seuil de 3).
    try {
      const refusals = await this.countRefusalsByDriverLast24h(driverId);
      this.logger.debug(
        `[Refus] Livreur ${driverId} : ${refusals} refus sur 24h`,
      );
      if (refusals === 3) {
        this.logger.warn(
          `[Signalisation] Livreur ${driverId} a refusé ${refusals} courses sur 24h`,
        );
        try {
          await this.notificationStore.broadcastToRole(
            'super_admin',
            'Livreur refuse beaucoup de courses',
            `Le livreur ${driverId} a refusé ${refusals} courses sur les 24 dernières heures. Évaluez son activité et sa disponibilité.`,
            NotificationType.SYSTEM,
          );
        } catch { /* best effort */ }
      }
    } catch (err) {
      this.logger.warn(
        `[Signalisation] Comptage des refus indisponible: ${err.message}`,
      );
    }
  }

  /**
   * 📊 Nombre de courses refusées par un livreur sur les dernières 24h
   * (analyse des candidats notifiés via dispatchCandidates JSONB).
   */
  private async countRefusalsByDriverLast24h(driverId: string): Promise<number> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return this.orderRepository
      .createQueryBuilder('o')
      .where('o.createdAt >= :since', { since })
      .andWhere(
        `EXISTS (
          SELECT 1 FROM jsonb_array_elements(o."dispatchCandidates") AS cand
          WHERE cand->>'driverId' = :driverId
            AND (cand->>'refused')::boolean IS TRUE
        )`,
        { driverId },
      )
      .getCount();
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

    const assignableStatuses = [
      OrderStatus.PAID,
      OrderStatus.READY_FOR_PICKUP,
    ];
    if (!assignableStatuses.includes(order.status)) {
      throw new Error(
        `Impossible d'assigner un livreur : commande au statut "${order.status}". Statuts acceptés : ${assignableStatuses.join(', ')}`,
      );
    }

    const driver = await this.userRepository.findOne({
      where: { id: driverId, role: In([UserRole.DRIVER, UserRole.COURIER]) },
    });
    if (!driver) {
      throw new Error(`Livreur ${driverId} introuvable`);
    }

    const previousStatus = order.status;
    order.driverId = driverId;
    order.status = OrderStatus.DRIVER_ASSIGNED;
    const updatedOrder = await this.orderRepository.save(order);

    await this.userRepository.update(driverId, { isAvailable: false });

    // 📱 Notifications push / in-app (client + livreur)
    try {
      await this.ordersService.sendStatusNotifications(updatedOrder, previousStatus);
    } catch (err) {
      this.logger.warn(`[Manual Assign] Notifications non envoyées: ${err.message}`);
    }

    // Notifier le livreur
    this.dispatchGateway.notifyCandidateDrivers([driverId], {
      type: 'order_assigned',
      orderId: order.id,
      message: 'Vous avez été assigné à cette commande',
    });

    // 📡 Broadcast temps réel : le dashboard du livreur et du marchand se mettent à jour
    this.dispatchGateway.broadcastOrderStatusChanged({
      id: updatedOrder.id,
      status: updatedOrder.status,
      driverId: updatedOrder.driverId,
      businessId: updatedOrder.businessId,
    });

    return updatedOrder;
  }
}
