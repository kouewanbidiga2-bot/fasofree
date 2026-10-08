/**
 * 📦 Types de providers de livraison (niveaux du dispatch multi-niveaux).
 * - INTERNAL   : livreurs internes FasoFree (niveau 1 — existant)
 * - AGENCY     : agences partenaires locales (niveau 2 — Phase 1)
 * - THIRD_PARTY: sociétés de livraison avec API (niveau 3 — Phase 2)
 * - MANUAL     : pont manuel opérateur (téléphone/WhatsApp — Phase 2)
 */
export enum DeliveryProviderType {
  INTERNAL = 'INTERNAL',
  AGENCY = 'AGENCY',
  THIRD_PARTY = 'THIRD_PARTY',
  MANUAL = 'MANUAL',
}
