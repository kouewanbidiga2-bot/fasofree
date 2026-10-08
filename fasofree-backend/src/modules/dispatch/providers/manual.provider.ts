import { Injectable, Logger } from '@nestjs/common';
import {
  DeliveryProvider,
  DeliveryProviderResult,
  DeliveryTicket,
} from './delivery-provider.interface';
import { DeliveryProviderType } from './delivery-provider-type.enum';

/**
 * 📞 Provider NIVEAU 2/3 (bridge) — pont MANUEL opérateur.
 *
 * Utilisé quand aucun livreur interne ni agence n'est disponible :
 * la course est versée dans une file manuelle qu'un opérateur
 * (support / dispatcher) traite par téléphone ou WhatsApp, puis
 * assigne via l'assignation manuelle existante
 * (POST /dispatch/orders/:orderId/assign — déjà exposée).
 *
 * Ce provider « accepte » toujours la course : un humain la traitera.
 * La commande reste dans son statut courant (READY_FOR_PICKUP) avec
 * `deliveryProvider='manual'` et `deliveryProviderStatus='MANUAL_QUEUE'`,
 * ce qui la rend visible dans les dashboards de supervision.
 *
 * 🔐 Aucun contenu (adresses, client) n'est loggé — seulement la forme.
 */
@Injectable()
export class ManualProvider implements DeliveryProvider {
  readonly type = DeliveryProviderType.MANUAL;
  readonly name = 'manual';
  /** Traitement humain : toutes zones */
  readonly zones: string[] = [];

  private readonly logger = new Logger(ManualProvider.name);

  async canHandle(_ticket: DeliveryTicket): Promise<boolean> {
    return true;
  }

  async createDelivery(ticket: DeliveryTicket): Promise<DeliveryProviderResult> {
    this.logger.warn(
      `[Manual Provider] Course #${ticket.orderId} versée dans la file manuelle (type=${ticket.orderType ?? 'inconnu'}) — traitement opérateur requis`,
    );

    return {
      accepted: true,
      externalRef: `MANUAL-${ticket.orderId}`,
      status: 'MANUAL_QUEUE',
      details: {
        note: 'File manuelle — assignation par un opérateur (POST /dispatch/orders/:orderId/assign)',
      },
    };
  }

  async cancel(externalRef: string): Promise<boolean> {
    this.logger.warn(`[Manual Provider] Annulation demandée pour ${externalRef}`);
    return true;
  }
}
