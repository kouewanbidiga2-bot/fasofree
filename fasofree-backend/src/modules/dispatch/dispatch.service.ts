/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

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
import { DeliverySlaService } from './services/delivery-sla.service';
import { DeliveryCallForTenderService } from './services/delivery-call-for-tender.service';
import { DeliveryAgency } from './entities/delivery-agency.entity';
import { GeoDispatchService, DriverLocation } from '../orders/dispatch.service';
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
    @InjectRepository(DeliveryAgency)
    private readonly agencyRepository: Repository<DeliveryAgency>,
    private readonly dispatchGateway: DispatchGateway,
    private readonly deliveryPricingService: DeliveryPricingService,
    private readonly configService: ConfigService,
    private readonly providerRegistry: DeliveryProviderRegistry,
    private readonly driverScoringService: DriverScoringService,
    private readonly deliverySlaService: DeliverySlaService,
    private readonly callForTender: DeliveryCallForTenderService,
    @Inject(forwardRef(() => OrdersService))
    private readonly ordersService: OrdersService,
    private readonly notificationStore: NotificationStoreService,
    private readonly geoDispatchService: GeoDispatchService,
  ) {}

  /**
   * 📍 Positions connues de PLUSIEURS livreurs, en une passe parallèle.
   *
   * Exposé sur `DispatchService` (et non sur `GeoDispatchService`) parce que
   * c'est lui que les autres modules injectent : `DispatchModule` est
   * `@Global`, donc `AgenciesService` l'obtient sans nouveau câblage, là où
   * `GeoDispatchService` n'est pas exporté par `OrdersModule`… si, il l'est,
   * mais passer par le service global évite d'importer OrdersModule partout.
   *
   * Un livreur sans position connue (jamais envoyé de GPS, ou TTL Redis
   * expiré) vaut `null` — c'est un état normal, pas une erreur.
   */
  async getDriversLocations(
    driverIds: string[],
  ): Promise<Map<string, DriverLocation | null>> {
    const unique = Array.from(new Set(driverIds.filter(Boolean)));
    const map = new Map<string, DriverLocation | null>();
    await Promise.all(
      unique.map(async (id) => {
        map.set(id, await this.geoDispatchService.getDriverLocation(id));
      }),
    );
    return map;
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

    // 💰 Calcul des frais de livraison avec le tarif véhicule
    const ticket = this.buildTicket(order, business);

    // 🧭 ORCHESTRATEUR MULTI-NIVEAUX :
    // essaie chaque provider dans l'ordre configuré (DELIVERY_PROVIDERS).
    // L'échec d'un niveau n'est PAS une erreur finale → fail-over.
    const handled = await this.dispatchThroughProviders(order, ticket);

    // ⏱️ SLA (bloc B) : ETA + échéance de retard estampillées une seule fois,
    // avant tout fail-over, pour que la mesure porte sur la course entière.
    await this.stampDeliverySla(order, ticket);

    // 📣 A4-T0 : appel d'offres diffusé EN PARALLÈLE du pool interne vers
    // TOUTES les agences éligibles (« premier qui accepte gagne »).
    // Volontairement indépendant de DELIVERY_PROVIDERS : le niveau agence
    // doit fonctionner même quand la chaîne de secours est réglée sur
    // « internal » seul (valeur par défaut).
    let tenderOpen = false;
    try {
      const tender = await this.callForTender.openTender(order.id, ticket, 1);
      tenderOpen = tender.agencyCount > 0;
      if (tenderOpen) {
        this.logger.log(
          `[A4] Course #${orderId} : appel d'offres ouvert à ${tender.agencyCount} agence(s) en parallèle du pool interne`,
        );
      }
    } catch (err) {
      // Un échec de l'appel d'offres ne doit JAMAIS empêcher le dispatch interne.
      this.logger.error(
        `[A4] Appel d'offres impossible pour la commande #${orderId}: ${
          (err as Error)?.message ?? 'inconnu'
        }`,
      );
    }

    if (!handled) {
      // Notifier le système qu'aucun livreur n'est disponible
      this.dispatchGateway.notifyNewOrderToBusiness(order.businessId, order);

      if (!tenderOpen) {
        // ⛔ Tous les niveaux ont échoué : aucun moyen de livraison.
        this.logger.warn(
          `[Auto-Dispatch] Aucun provider de livraison disponible pour la commande #${orderId}`,
        );
        await this.markEscalated(order);
      } else {
        // L'appel d'offres A4 prend le relais : escalader tout de suite
        // priverait les agences de leur fenêtre de 5 minutes. C'est le cron
        // `processCallForTenders` qui clôturera à T+10 si personne ne prend.
        this.logger.log(
          `[A4] Course #${orderId} confiée à l'appel d'offres (aucun pool interne éligible)`,
        );
      }
    }
  }

  /**
   * ⏱️ Estampille l'ETA et l'échéance de retard sur la commande (bloc B).
   *
   * Idempotent : une échéance déjà posée n'est jamais réécrite, sinon un
   * fail-over repousserait indéfiniment le retard d'une course en cours.
   */
  private async stampDeliverySla(
    order: Order,
    ticket: DeliveryTicket,
  ): Promise<void> {
    try {
      if (order.deliverySlaDeadline) return;

      const from = order.dispatchedAt ?? new Date();

      // Distance ramassage → livraison (0 si l'une des extrémités manque :
      // le plancher de 15 min s'applique alors, ce qui reste honnête).
      const pLat = ticket.pickupLatitude;
      const pLng = ticket.pickupLongitude;
      const dLat = ticket.deliveryLatitude;
      const dLng = ticket.deliveryLongitude;
      const distanceKm =
        pLat != null && pLng != null && dLat != null && dLng != null
          ? this.driverScoringService.calculateDistance(pLat, pLng, dLat, dLng)
          : 0;

      const eta = this.deliverySlaService.computeEta(distanceKm, from);
      const deadline = this.deliverySlaService.computeLateDeadline(
        eta.etaMinutes,
        from,
      );

      await this.orderRepository.update(order.id, {
        deliveryEtaMinutes: eta.etaMinutes,
        deliverySlaDeadline: deadline,
      });

      this.logger.log(
        `[SLA] Course #${order.id} : ETA ${eta.etaMinutes} min (${eta.distanceKm.toFixed(1)} km${
          eta.peakApplied ? ', heure de pointe' : ''
        }) — échéance ${deadline.toISOString()}`,
      );
    } catch (err) {
      // Le SLA ne doit jamais bloquer une livraison.
      this.logger.warn(
        `[SLA] ETA non calculable pour la commande #${order.id}: ${
          (err as Error)?.message ?? 'inconnu'
        }`,
      );
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
    // 🏁 Bloc A4 — une société de livraison a-t-elle déjà accepté l'appel
    // d'offres ? Si oui, la course est prise : notifier d'autres livreurs
    // serait trompeur et un « accept » concurrent casserait le contrat
    // « premier qui accepte gagne ». Vérifié AVANT la boucle pour ne
    // déclencher aucun effet de bord (notifications) inutilement.
    const current = await this.orderRepository.findOne({
      where: { id: order.id },
      select: { id: true, deliveryProviderId: true },
    });
    if (current?.deliveryProviderId) {
      this.logger.log(
        `[Dispatch] Commande #${order.id} déjà prise par la société ${current.deliveryProviderId} — chaîne de secours ignorée`,
      );
      return true;
    }

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
        // 📣 Appel d'offres A4 ouvert et non échu : c'est le cron dédié
        // `processCallForTenders` qui pilote la suite (T+5 / T+10).
        // Décider ici en parallèle ferait diverger les deux crons
        // (fail-over manuel immédiat + re-diffusion aux agences).
        if (
          order.dispatchOfferRound > 0 &&
          order.dispatchOfferRound < 3 &&
          order.dispatchOfferExpiresAt != null
        ) {
          this.logger.debug(
            `[Dispatch Timeout] Commande #${order.id} sous appel d'offres A4 (tour ${order.dispatchOfferRound}) — géré par le cron dédié`,
          );
          continue;
        }

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
   * 📣 CHAÎNE DE SECOURS A4 — appel d'offres multi-agences.
   *
   * T+0  : diffusion interne + toutes agences éligibles (tour 1)
   * T+5  : retour pool interne + re-diffusion aux agences + notification
   *        à l'établissement (tour 2)
   * T+10 : « aucun livreur disponible » à l'établissement + appel aux
   *        sociétés partenaires « besoin livreur » + escalade (tour 3)
   *
   * Le cron ne traite QUE les commandes dont l'appel d'offres est ouvert et
   * échu, et où personne n'a pris la course :
   * `driverId IS NULL` (aucun livreur) ET `deliveryProviderId IS NULL`
   * (aucune agence n'a accepté).
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async processCallForTenders(): Promise<void> {
    try {
      const now = new Date();
      const dueOrders = await this.orderRepository
        .createQueryBuilder('o')
        // ⚠️ PAS de filtre sur READY_FOR_PICKUP : le dispatch — et donc la
        // fenêtre A4 — démarre dès PAID / IN_PREPARATION (le livreur peut
        // accepter pendant que la commande se prépare). Filtrer sur
        // READY_FOR_PICKUP ferait expirer la fenêtre avant même que la
        // commande y arrive, et la chaîne sauterait directement à T+10.
        .where('o."driverId" IS NULL')
        .andWhere('o."deliveryProviderId" IS NULL')
        .andWhere('o."dispatchOfferExpiresAt" IS NOT NULL')
        .andWhere('o."dispatchOfferExpiresAt" <= :now', { now })
        .andWhere('o."dispatchOfferRound" < :finalRound', { finalRound: 3 })
        .andWhere('o.status NOT IN (:...closed)', {
          closed: [
            OrderStatus.CANCELLED,
            OrderStatus.FAILED,
            OrderStatus.DELIVERED_PENDING_CONFIRMATION,
            OrderStatus.DELIVERED,
            OrderStatus.COMPLETED,
            OrderStatus.DISPUTED,
            OrderStatus.REFUNDED,
          ],
        })
        .getMany();

      for (const order of dueOrders) {
        if (order.dispatchOfferRound <= 1) {
          await this.escalateTenderRoundTwo(order);
        } else {
          await this.closeTenderWithoutWinner(order);
        }
      }
    } catch (error) {
      this.logger.error(
        `[A4] Erreur du cron d'appel d'offres: ${(error as Error)?.message ?? 'inconnu'}`,
      );
    }
  }

  /**
   * 🔁 A4 — T+5 : personne n'a accepté, on relance plus largement.
   * ① retour au pool interne, ② re-diffusion aux agences, ③ information de
   * l'établissement (il doit savoir que la course traîne).
   */
  private async escalateTenderRoundTwo(order: Order): Promise<void> {
    this.logger.warn(
      `[A4] T+5 — aucune acceptation sur la course #${order.id} : retour pool interne + re-diffusion + notification à l'établissement`,
    );

    // Les offres du tour 1 sont closes AVANT d'ouvrir le tour 2, sinon
    // elles cohabiteraient avec des offres aux fenêtres différentes.
    await this.callForTender.closePendingOffers(order.id);

    // ① Retour au pool interne : diffusion à tous les livreurs disponibles.
    this.dispatchGateway.dispatchOrderToDrivers(order);

    // ③ L'établissement est informé que la recherche se poursuit.
    this.dispatchGateway.notifyBusinessNoCourier(order.businessId, order.id, {
      stage: 'RETRY',
    });

    // ② Re-diffusion aux agences éligibles (tour 2).
    const business = order.businessId
      ? await this.businessRepository.findOne({
          where: { id: order.businessId },
        })
      : null;
    const ticket = this.buildTicket(order, business);
    const tender = await this.callForTender.openTender(order.id, ticket, 2);

    if (tender.agencyCount === 0) {
      // Plus aucune agence éligible (désactivée, suspendue, en surcharge) :
      // on clôture immédiatement au lieu de boucler à vide pendant 5 min.
      await this.closeTenderWithoutWinner(order);
    }
  }

  /**
   * ⛔ A4 — T+10 : aucun livreur disponible. On clôture proprement,
   * on prévient l'établissement, on fait appel aux sociétés partenaires
   * et on escalade à un opérateur humain (Niveau 4).
   */
  private async closeTenderWithoutWinner(order: Order): Promise<void> {
    this.logger.warn(
      `[A4] T+10 — course #${order.id} : aucun livreur disponible, clôture et appel aux sociétés partenaires`,
    );

    await this.callForTender.closePendingOffers(order.id);
    await this.orderRepository.update(order.id, {
      dispatchOfferExpiresAt: null,
      dispatchOfferRound: 3,
    });

    // ① Message explicite à l'établissement.
    this.dispatchGateway.notifyBusinessNoCourier(order.businessId, order.id, {
      stage: 'EXHAUSTED',
    });

    // ② Appel aux sociétés partenaires « besoin livreur ».
    await this.notifyPartnerAgenciesNeedDriver(order);

    // ③ Escalade opérateur : un humain reprend la course.
    await this.markEscalated(order);
  }

  /**
   * 📢 Re-notification de TOUTES les sociétés partenaires actives
   * (« besoin livreur ») — y compris celles qui n'étaient pas éligibles
   * au tour courant : c'est un appel à l'aide humain, pas une offre
   * formelle. La notification persistée garantit que les agences hors
   * ligne la retrouvent à la reconnexion.
   */
  private async notifyPartnerAgenciesNeedDriver(order: Order): Promise<void> {
    try {
      const agencies = await this.agencyRepository.find({
        where: { isActive: true },
      });

      for (const agency of agencies) {
        this.dispatchGateway.notifyAgency(agency.id, {
          type: 'need_driver',
          orderId: order.id,
          message: 'Besoin urgent de livreur',
          orderType: order.orderType,
          pickupAddress: order.pickupLocation?.address ?? null,
          deliveryAddress: order.dropoffLocation?.address ?? null,
          deliveryFeeXOF: Number(order.deliveryFee ?? 0),
        });
      }

      await this.notificationStore.broadcastToRole(
        UserRole.AGENCY,
        'Besoin de livreur',
        `Aucun livreur n'a pu prendre la course #${order.id}. Une société partenaire peut-elle la couvrir ?`,
        NotificationType.SYSTEM,
      );

      this.logger.log(
        `[A4] Appel « besoin livreur » diffusé à ${agencies.length} société(s) partenaire(s)`,
      );
    } catch (err) {
      this.logger.warn(
        `[A4] Appel aux sociétés partenaires impossible: ${
          (err as Error)?.message ?? 'inconnu'
        }`,
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
