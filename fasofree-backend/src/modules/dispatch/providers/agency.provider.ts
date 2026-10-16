import { Injectable, Logger } from '@nestjs/common';
import {
  DeliveryProvider,
  DeliveryProviderResult,
  DeliveryTicket,
} from './delivery-provider.interface';
import { DeliveryProviderType } from './delivery-provider-type.enum';
import { DeliveryCallForTenderService } from '../services/delivery-call-for-tender.service';

/**
 * 🏢 Provider NIVEAU 2 — sociétés de livraison partenaires.
 *
 * ⚠️ Évolution bloc A4 : ce provider ne route plus vers **une seule**
 * agence (commission la plus basse). Il ouvre un **appel d'offres** vers
 * toutes les agences éligibles — **la première qui accepte gagne**
 * (fenêtre 5 min, voir `DeliveryCallForTenderService`).
 *
 * Toute la connaissance de l'éligibilité (zone, capacité, suspensions) et
 * du registre des offres vit dans `DeliveryCallForTenderService` : une
 * seule source de vérité, partagée avec le cron A4 de `DispatchService`.
 */
@Injectable()
export class AgencyProvider implements DeliveryProvider {
  readonly type = DeliveryProviderType.AGENCY;
  readonly name = 'agency';
  /** Le matching de zone se fait agence par agence (dans le service) */
  readonly zones: string[] = [];

  private readonly logger = new Logger(AgencyProvider.name);

  constructor(
    private readonly callForTender: DeliveryCallForTenderService,
  ) {}

  async canHandle(ticket: DeliveryTicket): Promise<boolean> {
    const agencies = await this.callForTender.findEligibleAgencies(ticket);
    return agencies.length > 0;
  }

  async createDelivery(ticket: DeliveryTicket): Promise<DeliveryProviderResult> {
    const { agencyCount, expiresAt } = await this.callForTender.openTender(
      ticket.orderId,
      ticket,
      1,
    );

    if (agencyCount === 0) {
      return { accepted: false, message: 'Aucune agence éligible' };
    }

    this.logger.log(
      `[Agency Provider] Appel d'offres #${ticket.orderId} diffusé à ${agencyCount} agence(s) — premier qui accepte gagne`,
    );

    return {
      accepted: true,
      // Pas de providerId : aucune agence n'a encore pris la course.
      // `deliveryProviderId` reste null → l'appel d'offres est ouvert.
      status: 'OFFERED',
      details: {
        tenderAgencyCount: agencyCount,
        tenderExpiresAt: expiresAt ? expiresAt.toISOString() : null,
        note: "Appel d'offres multi-agences — acceptation depuis l'espace agence",
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
}
