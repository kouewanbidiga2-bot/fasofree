import { DeliveryProviderType } from './delivery-provider-type.enum';
import { DeliveryPricingResult } from '../../orders/delivery-pricing.service';

/**
 * 🎟️ Ticket de livraison — la description standardisée d'une course
 * transmise à un provider (interne, agence, tiers, manuel).
 * Le provider ne connaît QUE ce ticket (isolation des niveaux).
 */
export interface DeliveryTicket {
  orderId: string;
  orderType?: string;
  fulfillmentType?: string;
  pickupAddress?: string | null;
  pickupLatitude?: number | null;
  pickupLongitude?: number | null;
  deliveryAddress?: string | null;
  deliveryLatitude?: number | null;
  deliveryLongitude?: number | null;
  /** Frais de livraison estimés (FCFA) — base de la commission agence */
  deliveryFeeXOF?: number;
  /** Résultat brut du pricing (préservé tel quel dans les payloads WS) */
  pricingResult?: DeliveryPricingResult;
  totalAmount?: number;
  businessName?: string | null;
  /** Nom de l'agence/commerce émetteur (null = course P2P à la demande) */
  cityHint?: string | null;
}

/**
 * ✅ Résultat d'une tentative de prise en charge par un provider.
 * `accepted=false` signifie « je ne peux pas » → l'orchestrateur
 * passe au provider suivant (fail-over). Ce n'est JAMAIS une erreur finale.
 */
export interface DeliveryProviderResult {
  accepted: boolean;
  /** Id du provider secondaire (ex. id de l'agence) */
  providerId?: string;
  /** Référence externe de suivi (ex. AGENCY-<id>-<orderId>) */
  externalRef?: string;
  /** Statut provider-side : DISPATCHED / ROUTED / MANUAL_QUEUE … */
  status?: string;
  /** Détails bruts (commission, nom agence…) — masqués dans les logs */
  details?: Record<string, any>;
  message?: string;
}

/**
 * 🧩 Interface commune à TOUS les moyens de livraison.
 * Un provider répond à la question :
 * « peux-tu satisfaire cette course, et si oui prends-la en charge ? »
 */
export interface DeliveryProvider {
  /** Type de provider (INTERNAL / AGENCY / THIRD_PARTY / MANUAL) */
  readonly type: DeliveryProviderType;
  /** Nom unique (clé du registry, ex. 'internal', 'agency', 'manual') */
  readonly name: string;
  /** Zones couvertes (villes). Vide = toutes zones. */
  readonly zones: string[];
  /** Le provider peut-il traiter cette course (zone, capacité, horaires) ? */
  canHandle(ticket: DeliveryTicket): Promise<boolean> | boolean;
  /** Prendre la course en charge (notifier livreurs / routage / file) */
  createDelivery(ticket: DeliveryTicket): Promise<DeliveryProviderResult>;
  /** Suivi d'une course déjà prise en charge (null si non supporté) */
  track?(externalRef: string): Promise<DeliveryProviderResult | null>;
  /** Annulation (best effort) */
  cancel?(externalRef: string): Promise<boolean>;
}
