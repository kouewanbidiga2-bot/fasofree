/**
 * FasoFree — Service Commandes
 * Endpoints: /orders
 * Statuts: PENDING | PAID | IN_PREPARATION | PROCESSING | DELIVERED | COMPLETED | CANCELLED | FAILED
 */
import api from './api';

/**
 * Créer une nouvelle commande (client)
 * @param {Object} data - { businessId, totalAmount, deliveryLatitude, deliveryLongitude, orderType, deliveryFee }
 * orderType: 'DELIVERY' | 'PICKUP' | 'RIDE' | 'EXPRESS'
 */
export const createOrder = async (data) => {
  const response = await api.post('/orders', data);
  return response.data;
};

/**
 * Lister mes commandes (client ou livreur selon le rôle JWT)
 */
export const getMyOrders = async () => {
  const response = await api.get('/orders/my-orders');
  return response.data;
};

/**
 * Obtenir le détail complet d'une commande
 * @param {string} id - ID de la commande
 */
export const getOrderById = async (id) => {
  const response = await api.get(`/orders/${id}`);
  return response.data;
};

/**
 * Mettre à jour le statut d'une commande
 * @param {string} id
 * @param {string} status - Nouveau statut (enum)
 */
export const updateOrderStatus = async (id, status) => {
  const response = await api.patch(`/orders/${id}/status`, { status });
  return response.data;
};

// ─── Helpers pour les labels et couleurs de statut ──────────────────────
export const ORDER_STATUS = {
  PENDING: { label: 'En attente', color: 'warning', dot: '#F59E0B' },
  PAID: { label: 'Payé', color: 'info', dot: '#3B82F6' },
  IN_PREPARATION: { label: 'En préparation', color: 'processing', dot: '#FF6600' },
  PROCESSING: { label: 'En livraison', color: 'info', dot: '#3B82F6' },
  DELIVERED: { label: 'Livré', color: 'success', dot: '#22C55E' },
  COMPLETED: { label: 'Terminé', color: 'success', dot: '#22C55E' },
  CANCELLED: { label: 'Annulé', color: 'error', dot: '#EF4444' },
  FAILED: { label: 'Échoué', color: 'error', dot: '#EF4444' },
};

export const ORDER_TYPES = {
  DELIVERY: 'Livraison',
  PICKUP: 'À emporter',
  RIDE: 'Transport',
  EXPRESS: 'Express',
};

export const getStatusInfo = (status) => {
  return ORDER_STATUS[status] || { label: status, color: 'default', dot: '#A09890' };
};
