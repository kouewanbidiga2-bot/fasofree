/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

/**
 * 📡 Événements du tunnel d'affiliation.
 *
 * Ils permettent d'alimenter le funnel SANS créer de dépendance circulaire
 * entre `AuthModule`/`OrdersModule` et `AffiliateModule` : les modules
 * émetteurs ne connaissent que la constante, jamais le service.
 */

/** Commande marchande créée (paiement engagé, pas encore encaissé). */
export const AFFILIATE_ORDER_CREATED = 'affiliate.order.created';

export interface AffiliateOrderCreatedPayload {
  orderId: string;
  clientId: string;
  businessId: string;
  /** Montant total payé par le client, en FCFA. */
  amount: number;
}
