/**
 * FasoFree — UI partagée des onglets Litiges (administration + marchand).
 * Évite la duplication DisputesTab/MerchantDisputesTab : statuts, filtres,
 * formatage, InfoItem et constantes métier miroir du backend.
 */
import React from 'react';

/** Miroir du backend (disputes.service.ts merchantRefund) : statuts qu'un
 *  gérant peut rembourser sans admin. Ne JAMAIS désynchroniser du backend. */
export const MERCHANT_REFUNDABLE = ['OPEN', 'UNDER_INVESTIGATION'];

export const STATUS_CONFIG = {
  OPEN: { label: 'Ouvert', color: 'warning', dot: '#D97706' },
  UNDER_INVESTIGATION: { label: 'En cours', color: 'info', dot: '#3B82F6' },
  PENDING_ADMIN_APPROVAL: { label: 'En attente admin', color: 'processing', dot: '#F59E0B' },
  APPROVED: { label: 'Approuvé', color: 'success', dot: '#22C55E' },
  REJECTED: { label: 'Rejeté', color: 'error', dot: '#EF4444' },
  CLOSED: { label: 'Clôturé', color: 'gray', dot: '#9CA3AF' },
};

export const FILTERS = [
  { value: '', label: 'Tous' },
  { value: 'OPEN', label: 'Ouverts' },
  { value: 'UNDER_INVESTIGATION', label: 'En cours' },
  { value: 'PENDING_ADMIN_APPROVAL', label: 'En attente admin' },
  { value: 'APPROVED', label: 'Approuvés' },
  { value: 'REJECTED', label: 'Rejetés' },
];

export const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString('fr-FR') : '—';

/**
 * Libellés français des statuts de commande (évite d'afficher l'enum brut).
 * Miroir complet de OrderStatus (order.entity.ts) : tout statut backend doit
 * avoir sa traduction ici, sinon le téléversement retombe sur l'enum brut.
 */
const ORDER_STATUS_LABELS = {
  PENDING: 'En attente',
  AWAITING_PAYMENT: 'En attente de paiement',
  PAID: 'Payée',
  IN_PREPARATION: 'En préparation',
  READY_FOR_PICKUP: 'Prête',
  DRIVER_ASSIGNED: 'Livreur en chemin',
  PROCESSING: 'En livraison',
  IN_DELIVERY: 'En livraison',
  DELIVERED_PENDING_CONFIRMATION: 'Arrivée',
  DELIVERED: 'Livrée',
  COMPLETED: 'Terminée',
  CANCELLED: 'Annulée',
  FAILED: 'Échouée',
  DISPUTED: 'Litigée',
  REFUNDED: 'Remboursée',
};

export const orderStatusLabel = (status) =>
  ORDER_STATUS_LABELS[status] || status || '—';

/** Court identifiant affichable (`#abc12345`), chaîne vide si absent
 *  (l'appelant peut fournir un repli, convention `|| '—'` dans les
 *  onglets Litiges : le même tiret que les autres champs vides). */
export const shortId = (id) =>
  id && id.length > 8 ? id.slice(-8) : id || '';

export const InfoItem = ({ icon: Icon, label, value, sub }) => (
  <div className="flex items-start gap-2">
    <Icon size={14} className="text-text-tertiary mt-0.5 shrink-0" strokeWidth={1.5} />
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase text-text-secondary">{label}</p>
      <p className="text-text-primary font-semibold truncate">{value || '—'}</p>
      {sub && <p className="text-text-secondary truncate">{sub}</p>}
    </div>
  </div>
);