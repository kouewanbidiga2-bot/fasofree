import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  DeliveryProvider,
  DeliveryProviderResult,
  DeliveryTicket,
} from './delivery-provider.interface';
import { DeliveryProviderType } from './delivery-provider-type.enum';
import { DeliveryAgency } from '../entities/delivery-agency.entity';
import { Order, OrderStatus } from '../../orders/entities/order.entity';
import { DispatchGateway } from '../dispatch.gateway';

/**
 * 🏢 Provider NIVEAU 2 — agences partenaires.
 *
 * Route une course vers une agence éligible (zone couverte + capacité
 * disponible), en choisissant la commission la plus basse (meilleur
 * coût/SLA). Notifie l'agence en temps réel via la room WebSocket
 * `agency:<id>` ; l'agence assigne ensuite un de SES chauffeurs depuis
 * son espace dédié (le chauffeur est un DRIVER classique — tout le
 * déroulé livraison/PIN/paiement est réutilisé tel quel).
 */
@Injectable()
export class AgencyProvider implements DeliveryProvider {
  readonly type = DeliveryProviderType.AGENCY;
  readonly name = 'agency';
  /** Le matching de zone se fait agence par agence */
  readonly zones: string[] = [];

  private readonly logger = new Logger(AgencyProvider.name);

  constructor(
    @InjectRepository(DeliveryAgency)
    private readonly agencyRepository: Repository<DeliveryAgency>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly dispatchGateway: DispatchGateway,
  ) {}

  async canHandle(ticket: DeliveryTicket): Promise<boolean> {
    const agencies = await this.findEligibleAgencies(ticket);
    return agencies.length > 0;
  }

  async createDelivery(ticket: DeliveryTicket): Promise<DeliveryProviderResult> {
    const agencies = await this.findEligibleAgencies(ticket);
    if (agencies.length === 0) {
      return { accepted: false, message: 'Aucune agence éligible' };
    }

    // Meilleur coût/SLA : commission la plus basse d'abord
    const agency = [...agencies].sort(
      (a, b) => Number(a.commissionPct ?? 0) - Number(b.commissionPct ?? 0),
    )[0];

    const commissionPct = Number(agency.commissionPct ?? 10);
    const fee = Number(ticket.deliveryFeeXOF ?? 0);
    const agencyCommissionXof = Math.round((fee * commissionPct) / 100);
    const externalRef = `AGENCY-${agency.id}-${ticket.orderId}`;

    // 📣 Notification temps réel à l'agence (room WebSocket agency:<id>)
    this.dispatchGateway.notifyAgency(agency.id, {
      type: 'new_delivery',
      orderId: ticket.orderId,
      orderType: ticket.orderType,
      businessName: ticket.businessName || 'Course à la demande',
      pickupAddress: ticket.pickupAddress,
      pickupLatitude: ticket.pickupLatitude,
      pickupLongitude: ticket.pickupLongitude,
      deliveryAddress: ticket.deliveryAddress,
      deliveryLatitude: ticket.deliveryLatitude,
      deliveryLongitude: ticket.deliveryLongitude,
      deliveryFeeXOF: fee,
      agencyCommissionXof,
      externalRef,
    });

    this.logger.log(
      `[Agency Provider] Course #${ticket.orderId} routée vers l'agence "${agency.name}" (commission ${commissionPct} %)`,
    );

    return {
      accepted: true,
      providerId: agency.id,
      externalRef,
      status: 'ROUTED',
      details: {
        agencyId: agency.id,
        agencyName: agency.name,
        commissionPct,
        agencyCommissionXof,
      },
    };
  }

  /** Suivi partenaire : Phase 2 (API/webhooks) — non supporté pour l'instant */
  async track(_externalRef: string): Promise<DeliveryProviderResult | null> {
    return null;
  }

  async cancel(externalRef: string): Promise<boolean> {
    this.logger.warn(`[Agency Provider] Annulation demandée pour ${externalRef}`);
    return true;
  }

  // ─── Sélection d'agence ─────────────────────────────────────────

  private async findEligibleAgencies(
    ticket: DeliveryTicket,
  ): Promise<DeliveryAgency[]> {
    const agencies = await this.agencyRepository.find({
      where: { isActive: true },
    });
    const eligible: DeliveryAgency[] = [];
    for (const agency of agencies) {
      if (!this.coversZones(agency, ticket)) continue;
      if (!(await this.hasCapacity(agency))) continue;
      eligible.push(agency);
    }
    return eligible;
  }

  /** L'agence couvre-t-elle la zone de la course ? */
  private coversZones(agency: DeliveryAgency, ticket: DeliveryTicket): boolean {
    const zones = agency.zones ?? [];
    if (!zones || zones.length === 0) {
      return true; // couverture nationale
    }
    const haystack = [
      ticket.pickupAddress ?? '',
      ticket.deliveryAddress ?? '',
    ]
      .join(' ')
      .toLowerCase();
    return zones.some(
      (z) => z && String(z).length > 0 && haystack.includes(String(z).toLowerCase()),
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
}
