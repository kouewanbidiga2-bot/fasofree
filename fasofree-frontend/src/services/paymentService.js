/**
 * FasoFree — Service Paiements
 * Endpoints: /payments
 * Provider: GeniusPay (Orange Money, Moov Money, Wave)
 */
import api from './api';

/**
 * Initier un paiement pour une commande via GeniusPay
 * @param {Object} data - { orderId, paymentMethod, phoneNumber }
 * paymentMethod: 'orange_money' | 'moov_money' | 'wave'
 */
export const initiatePayment = async (data) => {
  const response = await api.post('/payments/initiate', {
    orderId: data.orderId,
    paymentMethod: data.paymentMethod,
    phoneNumber: data.phoneNumber,
  });
  return response.data;
};

/**
 * Recharger le portefeuille FasoFree via GeniusPay
 * @param {Object} data - { amount, customerName, customerEmail }
 */
export const topupWallet = async (data) => {
  const response = await api.post('/payments/topup', data);
  return response.data;
};

/**
 * Vérifier le statut d'un paiement GeniusPay
 * @param {string} ref - Référence du paiement
 */
export const checkPaymentStatus = async (ref) => {
  const response = await api.get(`/payments/geniuspay/status/${ref}`);
  return response.data;
};

// ─── Méthodes de paiement disponibles (via GeniusPay) ──────────────────
export const PAYMENT_METHODS = [
  {
    id: 'orange_money',
    label: 'Orange Money',
    description: 'Paiement mobile Orange',
    color: '#FF6600',
    icon: '🟠',
    requiresPhone: true,
  },
  {
    id: 'moov_money',
    label: 'Moov Money',
    description: 'Paiement mobile Moov',
    color: '#0095D9',
    icon: '🔵',
    requiresPhone: true,
  },
  {
    id: 'wave',
    label: 'Wave',
    description: 'Paiement mobile Wave',
    color: '#1DC3F0',
    icon: '🌊',
    requiresPhone: true,
  },
  {
    id: 'cash',
    label: 'Paiement à la livraison',
    description: 'Espèces à la livraison',
    color: '#F59E0B',
    icon: '💵',
    requiresPhone: false,
  },
];
