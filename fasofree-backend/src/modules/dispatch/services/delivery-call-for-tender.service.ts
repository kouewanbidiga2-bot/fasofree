import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Not, Repository } from 'typeorm';
import {
  DeliveryOffer,
  DeliveryOfferStatus,
} from '../entities/delivery-offer.entity';
import { DeliveryAgency } from '../entities/delivery-agency.entity';
import { Order, OrderStatus } from '../../orders/entities/order.entity';
import { Business } from '../../businesses/entities/business.entity';
import { DeliveryTicket } from '../providers/delivery-provider.interface';
import { DispatchGateway } from '../dispatch.gateway';
import { PenaltiesService } from '../../penalties/penalties.service';
import { DeliveryPenaltyLevel } from '../../penalties/entities/delivery-penalty.entity';

/** Réponse d'ouverture d'un appel d'offres. */
export interface TenderOpenResult {
  /** Nombre d'agences sollicitées (0 = aucune agence éligible) */
  agencyCount: number;
  /** Fin de la fenêtre d'acceptation (null si aucune agence sollicitée) */
  expiresAt: Date | null;
}

/** Offre ouverte, enrichie pour l'espace agence. */
export interface AgencyOpenOffer {
  offerId: string;
  orderId: string;
  status: DeliveryOfferStatus;
  round: number;
  expiresAt: Date;
  /** Secondes restantes avant fermeture de la fenêtre (0 = fermée) */
  secondsRemaining: number;
  commissionPct: number;
  agencyCommissionXof: number | null;
  order: {
    id: string;
    orderType: string;
    status: string;
    businessName: string | null;
    pickupAddress: string | null;
    deliveryAddress: string | null;
    deliveryFee: number;
    totalAmount: number;
    estimatedDistanceKm: number | null;
    createdAt: Date;
  } | null;
}

/**
 * 📣 Appel d'offres multi-agences (bloc A4).
 *
 * Remplace le routage vers **une seule** agence : à T+0, FasoFree diffuse
 * la course à **toutes** les agences éligibles et **la première qui accepte
 * gagne**. Les offres concurrentes sont clôturées (LOST) immédiatement.
 *
 * Chaîne de secours A4 (pilotée par le cron de DispatchService) :
 *   T+0    → diffusion interne + toutes agences éligibles (ce service)
 *   T+5    → retour pool interne + re-diffusion (round 2)
 *   T+10   → « aucun livreur disponible » + appel aux sociétés partenaires
 *
 * Ce service ne connaît PAS le scoring interne ni la chaîne de providers :
 * il ne fait que tenir le registre des offres et l'acceptation atomique.
 * C'est DispatchService qui orchestre les tours (il porte déjà le ticket,
 * la chaîne de providers et le cron).
 */
@Injectable()
export class DeliveryCallForTenderService {
  private readonly logger = new Logger(DeliveryCallForTenderService.name);

  /** Fenêtre d'acceptation d'un tour : 5 minutes (décision produit). */
  static readonly WINDOW_MS = 5 * 60 * 1000;

  constructor(
    @InjectRepository(DeliveryOffer)
    private readonly offerRepository: Repository<DeliveryOffer>,
    @InjectRepository(DeliveryAgency)
    private readonly agencyRepository: Repository<DeliveryAgency>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
    private readonly dataSource: DataSource,
    private readonly dispatchGateway: DispatchGateway,
    private readonly penaltiesService: PenaltiesService,
  ) {}

  // ─── Éligibilité (source unique de vérité) ──────────────────────

  /**
   * 🎯 Agences éligibles à une course : actives, non suspendues, couvrant
   * la zone et disposant de la capacité annoncée.
   *
   * Publique : `AgencyProvider.canHandle` l'utilise pour rester aligné —
   * deux implémentations de l'éligibilité divergeraient en silence.
   */
  async findEligibleAgencies(
    ticket: DeliveryTicket,
  ): Promise<DeliveryAgency[]> {
    const agencies = await this.agencyRepository.find({
      where: { isActive: true },
    });
    if (agencies.length === 0) return [];

    // ⚖️ Les sociétés suspendues (pénalité niveau 3) sont écartées.
    let suspended = new Set<string>();
    try {
      suspended = await this.penaltiesService.getSuspendedAgencyIds();
    } catch (err) {
      // Une panne du module pénalités ne doit pas bloquer toute la
      // livraison : on dégrade en « aucune suspension connue ».
      this.logger.warn(
        `[A4] Suspensions agences indisponibles : ${(err as Error)?.message}`,
      );
    }

    const eligible: DeliveryAgency[] = [];
    for (const agency of agencies) {
      if (suspended.has(agency.id)) continue;
      if (!this.coversZones(agency, ticket)) continue;
      if (!(await this.hasCapacity(agency))) continue;
      eligible.push(agency);
    }

    // 🎚️ Baisse de priorité : les agences sanctionnées passent en dernier
    // (elles restent éligibles — seule la suspension exclut).
    try {
      const levels = await this.penaltiesService.getActiveAgencyLevels(
        eligible.map((a) => a.id),
      );
      eligible.sort((a, b) => {
        const la = levels.get(a.id);
        const lb = levels.get(b.id);
        const pa = la === DeliveryPenaltyLevel.PRIORITY_DOWNGRADE ? 1 : 0;
        const pb = lb === DeliveryPenaltyLevel.PRIORITY_DOWNGRADE ? 1 : 0;
        if (pa !== pb) return pa - pb;
        return Number(a.commissionPct ?? 0) - Number(b.commissionPct ?? 0);
      });
    } catch {
      // Best effort : l'ordre n'est pas critique, l'éligibilité l'est.
    }

    return eligible;
  }

  /** L'agence couvre-t-elle la zone de la course ? */
  private coversZones(agency: DeliveryAgency, ticket: DeliveryTicket): boolean {
    const zones = agency.zones ?? [];
    if (!zones || zones.length === 0) {
      return true; // couverture nationale
    }
    const haystack = [ticket.pickupAddress ?? '', ticket.deliveryAddress ?? '']
      .join(' ')
      .toLowerCase();
    return zones.some(
      (z) =>
        z && String(z).length > 0 && haystack.includes(String(z).toLowerCase()),
    );
  }

  /** L'agence a-t-elle de la capacité (courses en vol < max) ? */
  private async hasCapacity(agency: DeliveryAgency): Promise<boolean> {
    const max = Number(agency.maxConcurrentDeliveries ?? 0);
    if (!max || max <= 0) {
      return true; // illimité
    }
    const inFlight = await this.orderRepository
      .createQueryBuilder('o')
      .where('o."deliveryProviderId" = :agencyId', { agencyId: agency.id })
      .andWhere('o."driverId" IS NULL')
      .andWhere('o.status IN (:...statuses)', {
        statuses: [OrderStatus.READY_FOR_PICKUP, OrderStatus.DRIVER_ASSIGNED],
      })
      .getCount();
    return inFlight < max;
  }

  // ─── Ouverture / re-diffusion ───────────────────────────────────

  /**
   * 📣 Ouvre (ou rouvre) l'appel d'offres pour une commande.
   *
   * Idempotent par construction : la contrainte d'unicité (orderId, agencyId)
   * oblige à mettre à jour l'offre existante. Une agence qui a déjà refusé
   * n'est **pas** relancée au tour suivant (un refus est un refus — la
   * relancer ferait perdre les 5 minutes de la fenêtre).
   */
  async openTender(
    orderId: string,
    ticket: DeliveryTicket,
    round = 1,
  ): Promise<TenderOpenResult> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });
    if (!order) {
      return { agencyCount: 0, expiresAt: null };
    }

    // Un preneur est déjà là (livreur interne ou agence) → aucun intérêt
    // à relancer un appel d'offres.
    if (order.driverId) {
      return { agencyCount: 0, expiresAt: null };
    }
    if (order.deliveryProviderId) {
      return { agencyCount: 0, expiresAt: null };
    }

    // 🔒 Appel d'offres déjà ouvert et non expiré → on ne le relance PAS.
    // Sans ce garde-fou, un refus de livreur interne ou un fail-over
    // repousserait indéfiniment la fenêtre de 5 min et remettrait le tour
    // A4 à zéro : la course ne sortirait jamais de la chaîne de secours.
    if (
      order.dispatchOfferExpiresAt &&
      order.dispatchOfferExpiresAt.getTime() > Date.now() &&
      order.dispatchOfferRound >= round
    ) {
      return {
        agencyCount: await this.countPendingOffers(orderId),
        expiresAt: order.dispatchOfferExpiresAt,
      };
    }

    const agencies = await this.findEligibleAgencies(ticket);
    if (agencies.length === 0) {
      return { agencyCount: 0, expiresAt: null };
    }

    const expiresAt = new Date(Date.now() + DeliveryCallForTenderService.WINDOW_MS);
    const fee = Number(ticket.deliveryFeeXOF ?? 0);

    for (const agency of agencies) {
      const commissionPct = Number(agency.commissionPct ?? 10);
      const agencyCommissionXof = Math.round((fee * commissionPct) / 100);

      let offer = await this.offerRepository.findOne({
        where: { orderId, agencyId: agency.id },
      });

      if (offer && offer.status === DeliveryOfferStatus.REFUSED) {
        continue;
      }
      if (offer && offer.status === DeliveryOfferStatus.ACCEPTED) {
        // Ne devrait pas arriver (on a vérifié deliveryProviderId), mais
        // on ne casse jamais une acceptation déjà enregistrée.
        continue;
      }

      if (offer) {
        offer.status = DeliveryOfferStatus.PENDING;
        offer.round = round;
        offer.expiresAt = expiresAt;
        offer.respondedAt = null;
        offer.commissionPct = commissionPct;
        offer.agencyCommissionXof = agencyCommissionXof;
      } else {
        offer = this.offerRepository.create({
          orderId,
          agencyId: agency.id,
          status: DeliveryOfferStatus.PENDING,
          commissionPct,
          agencyCommissionXof,
          round,
          expiresAt,
          respondedAt: null,
        });
      }
      await this.offerRepository.save(offer);

      // 📡 Temps réel : la room de l'agence reçoit l'offre immédiatement.
      this.dispatchGateway.notifyAgency(agency.id, {
        type: 'tender_offer',
        offerId: offer.id,
        orderId,
        round,
        expiresAt: expiresAt.toISOString(),
        orderType: order.orderType,
        businessName: ticket.businessName || 'Course à la demande',
        pickupAddress: ticket.pickupAddress ?? null,
        pickupLatitude: ticket.pickupLatitude ?? null,
        pickupLongitude: ticket.pickupLongitude ?? null,
        deliveryAddress: ticket.deliveryAddress ?? null,
        deliveryLatitude: ticket.deliveryLatitude ?? null,
        deliveryLongitude: ticket.deliveryLongitude ?? null,
        deliveryFeeXOF: fee,
        agencyCommissionXof,
        commissionPct,
      });
    }

    // La fenêtre est portée par la commande (le cron s'en sert d'index).
    await this.orderRepository.update(orderId, {
      dispatchOfferExpiresAt: expiresAt,
      dispatchOfferRound: round,
    });

    this.logger.log(
      `[A4] Appel d'offres tour ${round} — course #${orderId} diffusée à ${agencies.length} agence(s), fenêtre jusqu'à ${expiresAt.toISOString()}`,
    );

    return { agencyCount: agencies.length, expiresAt };
  }

  // ─── Réponses des agences ───────────────────────────────────────

  /**
   * ✅ Acceptation « premier qui accepte gagne ».
   *
   * Verrou pessimiste sur la commande + transaction sérialisable : deux
   * agences qui cliquent dans la même seconde ne peuvent pas gagner toutes
   * les deux. La seconde reçoit un 400 explicite.
   */
  async acceptOffer(orderId: string, agencyId: string): Promise<Order> {
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction('SERIALIZABLE');

    try {
      const order = await runner.manager
        .createQueryBuilder(Order, 'o')
        .setLock('pessimistic_write')
        .where('o.id = :orderId', { orderId })
        .getOne();

      if (!order) {
        throw new NotFoundException(`Commande #${orderId} introuvable`);
      }

      const offer = await runner.manager.findOne(DeliveryOffer, {
        where: { orderId, agencyId },
      });
      if (!offer) {
        throw new NotFoundException(
          "Aucune offre ne vous a été adressée pour cette course",
        );
      }

      // Rejeu réseau : l'agence a déjà gagné → réponse idempotente.
      if (
        offer.status === DeliveryOfferStatus.ACCEPTED &&
        order.deliveryProviderId === agencyId
      ) {
        await runner.commitTransaction();
        return order;
      }

      if (offer.status !== DeliveryOfferStatus.PENDING) {
        throw new BadRequestException(
          `Cette offre n'est plus ouverte (statut ${offer.status})`,
        );
      }
      if (offer.expiresAt.getTime() < Date.now()) {
        offer.status = DeliveryOfferStatus.EXPIRED;
        offer.respondedAt = new Date();
        await runner.manager.save(offer);
        throw new BadRequestException(
          "La fenêtre d'acceptation (5 min) est écoulée",
        );
      }
      if (order.driverId) {
        throw new BadRequestException(
          'Cette course a déjà été prise par un livreur',
        );
      }
      if (order.deliveryProviderId && order.deliveryProviderId !== agencyId) {
        throw new BadRequestException(
          'Cette course a déjà été acceptée par une autre société de livraison',
        );
      }

      const agency = await runner.manager.findOne(DeliveryAgency, {
        where: { id: agencyId },
      });

      const now = new Date();
      offer.status = DeliveryOfferStatus.ACCEPTED;
      offer.respondedAt = now;
      await runner.manager.save(offer);

      // 🏁 Les offres concurrentes sont définitivement perdues.
      await runner.manager.update(
        DeliveryOffer,
        { orderId, id: Not(offer.id), status: DeliveryOfferStatus.PENDING },
        { status: DeliveryOfferStatus.LOST, respondedAt: now },
      );

      order.deliveryProvider = 'agency';
      order.deliveryProviderId = agencyId;
      order.deliveryProviderStatus = 'ACCEPTED';
      order.deliveryProviderDetails = {
        agencyId,
        agencyName: agency?.name ?? null,
        commissionPct: Number(offer.commissionPct ?? 10),
        acceptedAt: now.toISOString(),
      };
      order.agencyCommissionXof =
        offer.agencyCommissionXof != null
          ? Number(offer.agencyCommissionXof)
          : null;
      // Fenêtre close : plus aucun tour A4 ne doit être déclenché.
      order.dispatchOfferExpiresAt = null;

      const saved = await runner.manager.save(order);
      await runner.commitTransaction();

      this.logger.log(
        `[A4] Course #${orderId} acceptée par l'agence "${agency?.name ?? agencyId}" — offres concurrentes clôturées`,
      );

      // 📡 Les agences perdantes voient l'offre disparaître sans rechargement.
      this.dispatchGateway.broadcastOrderStatusChanged({
        id: saved.id,
        status: saved.status,
        driverId: saved.driverId,
        businessId: saved.businessId,
      });

      return saved;
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }

  /** 🚫 Refus explicite : l'offre est fermée, l'appel d'offres continue. */
  async refuseOffer(orderId: string, agencyId: string): Promise<DeliveryOffer> {
    const offer = await this.offerRepository.findOne({
      where: { orderId, agencyId },
    });
    if (!offer) {
      throw new NotFoundException(
        'Aucune offre ne vous a été adressée pour cette course',
      );
    }
    if (offer.status !== DeliveryOfferStatus.PENDING) {
      return offer; // idempotent
    }
    offer.status = DeliveryOfferStatus.REFUSED;
    offer.respondedAt = new Date();
    const saved = await this.offerRepository.save(offer);
    this.logger.log(
      `[A4] Course #${orderId} refusée par l'agence ${agencyId}`,
    );
    return saved;
  }

  // ─── Lecture ────────────────────────────────────────────────────

  /** Offres encore ouvertes pour une agence (espace agence). */
  async listOpenOffersForAgency(
    agencyId: string,
  ): Promise<AgencyOpenOffer[]> {
    const offers = await this.offerRepository.find({
      where: { agencyId, status: DeliveryOfferStatus.PENDING },
      order: { createdAt: 'DESC' },
      take: 50,
    });
    if (offers.length === 0) return [];

    const orderIds = [...new Set(offers.map((o) => o.orderId))];
    const orders = await this.orderRepository.find({
      where: { id: In(orderIds) },
    });
    const orderMap = new Map(orders.map((o) => [o.id, o]));

    const businessIds = [
      ...new Set(orders.map((o) => o.businessId).filter(Boolean)),
    ] as string[];
    const businesses = businessIds.length
      ? await this.businessRepository.find({ where: { id: In(businessIds) } })
      : [];
    const businessMap = new Map(businesses.map((b) => [b.id, b.name]));

    return offers
      .map((offer): AgencyOpenOffer | null => {
        const order = orderMap.get(offer.orderId);
        if (!order) return null;
        // Une course déjà prise (livreur ou autre agence) n'est plus à prendre :
        // on ne l'affiche pas, le cron la clôturera côté registre.
        if (order.driverId) return null;
        if (order.deliveryProviderId && order.deliveryProviderId !== agencyId) {
          return null;
        }
        return {
          offerId: offer.id,
          orderId: offer.orderId,
          status: offer.status,
          round: offer.round,
          expiresAt: offer.expiresAt,
          secondsRemaining: Math.max(
            0,
            Math.round((offer.expiresAt.getTime() - Date.now()) / 1000),
          ),
          commissionPct: Number(offer.commissionPct ?? 10),
          agencyCommissionXof:
            offer.agencyCommissionXof != null
              ? Number(offer.agencyCommissionXof)
              : null,
          order: {
            id: order.id,
            orderType: order.orderType,
            status: order.status,
            businessName: order.businessId
              ? (businessMap.get(order.businessId) ?? null)
              : null,
            pickupAddress:
              order.pickupLocation?.address ?? null,
            deliveryAddress: order.dropoffLocation?.address ?? null,
            deliveryFee: Number(order.deliveryFee ?? 0),
            totalAmount: Number(order.totalAmount ?? 0),
            estimatedDistanceKm:
              order.deliveryEtaMinutes != null
                ? order.deliveryEtaMinutes
                : null,
            createdAt: order.createdAt,
          },
        };
      })
      .filter((x): x is AgencyOpenOffer => x !== null);
  }

  /** Toutes les offres d'une commande (supervision). */
  async listOffersForOrder(orderId: string): Promise<DeliveryOffer[]> {
    return this.offerRepository.find({
      where: { orderId },
      order: { createdAt: 'ASC' },
    });
  }

  // ─── Clôture (pilotée par le cron) ──────────────────────────────

  /** Ferme toutes les offres encore en attente d'une commande. */
  async closePendingOffers(
    orderId: string,
    status: DeliveryOfferStatus = DeliveryOfferStatus.EXPIRED,
  ): Promise<number> {
    const result = await this.offerRepository.update(
      { orderId, status: DeliveryOfferStatus.PENDING },
      { status, respondedAt: new Date() },
    );
    return result.affected ?? 0;
  }

  /** Ids des agences actuellement sollicitées sur une commande. */
  async listOfferAgencyIds(orderId: string): Promise<string[]> {
    const offers = await this.offerRepository.find({
      where: { orderId },
      select: { agencyId: true },
    });
    return [...new Set(offers.map((o) => o.agencyId))];
  }

  /** Nombre d'offres encore en attente de réponse pour une commande. */
  async countPendingOffers(orderId: string): Promise<number> {
    return this.offerRepository.count({
      where: { orderId, status: DeliveryOfferStatus.PENDING },
    });
  }
}
