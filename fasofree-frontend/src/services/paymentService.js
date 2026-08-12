/**
 * FasoFree — Service Paiements
 * Endpoints: /payments
 * Méthodes: orange_money | moov_money | card | cash | ligdicash
 */
import api from './api';

/**
 * Initier un paiement pour une commande (via Wave/LigdiCash)
 * @param {Object} data - { orderId, paymentMethod, phoneNumber }
 * paymentMethod: 'orange_money' | 'moov_money' | 'card' | 'cash'
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
 * Créer une demande de paiement LigdiCash (payin)
 * @param {Object} data - { orderId, amount, customerName, customerEmail }
 */
export const initiateLigdiCashPayin = async (data) => {
  const response = await api.post('/payments/ligdicash/payin', {
    orderId: data.orderId,
    amount: data.amount,
    customerName: data.customerName,
    customerEmail: data.customerEmail,
  });
  return response.data;
};

// ─── Méthodes de paiement disponibles ──────────────────────────────────
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
    id: 'cash',
    label: 'Paiement à la livraison',
    description: 'Espèces à la livraison',
    color: '#F59E0B',
    icon: '💵',
    requiresPhone: false,
  },
  {
    id: 'card',
    label: 'Carte bancaire',
    description: 'Visa / Mastercard',
    color: '#22C55E',
    icon: '💳',
    requiresPhone: false,
  },
];
