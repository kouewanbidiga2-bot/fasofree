/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

/**
 * FasoFree — Service Paiements
 * Endpoints: /payments
 * Provider: SasPay (Orange Money, Moov Money — Burkina Faso)
 */
import api from './api';

/**
 * Initier un paiement pour une commande via SasPay.
 * @param {Object} data - { orderId, paymentMethod, phoneNumber }
 * paymentMethod: 'orange_money' | 'moov_money'
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
 * Recharger le portefeuille FasoFree via SasPay.
 * @param {Object} data - { amount, paymentMethod, customerName, customerEmail }
 */
export const topupWallet = async (data) => {
  const response = await api.post('/payments/topup', data);
  return response.data;
};

/**
 * Réconciliation ADMIN d'un paiement (même logique que le client,
 * sans contrôle d'appartenance). Rôles : SUPER_ADMIN / ADMIN / SUPPORT.
 * @param {string} orderId
 * @returns {Promise<{status:string, paid:boolean, reference:string|null}>}
 */
export const reconcilePaymentAdmin = async (orderId) => {
  const response = await api.get(`/payments/admin/reconcile/${orderId}`);
  return response.data;
};

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
];
