/**
 * FasoFree — Enhanced Order Service with FSM
 * Endpoints: /orders
 * FSM States: CREATED -> CONFIRMED -> PREPARING -> READY_FOR_PICKUP -> IN_TRANSIT -> DELIVERED -> CANCELLED -> REFUNDED
 */
import api from './api';
import { OrderStatus, OrderStatusFlow } from '../types';

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
export const getMyOrders = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.status) params.append('status', filters.status);
  if (filters.limit) params.append('limit', filters.limit);
  if (filters.offset) params.append('offset', filters.offset);
  
  const response = await api.get(`/orders/my-orders?${params.toString()}`);
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
 * Mettre à jour le statut d'une commande avec validation FSM
 * @param {string} id
 * @param {string} status - Nouveau statut (enum)
 */
export const updateOrderStatus = async (id, status) => {
  const response = await api.patch(`/orders/${id}/status`, { status });
  return response.data;
};

/**
 * Valider si une transition de statut est valide selon la FSM
 * @param {string} currentStatus
 * @param {string} newStatus
 */
export const isValidStatusTransition = (currentStatus, newStatus) => {
  const allowedTransitions = OrderStatusFlow[currentStatus] || [];
  return allowedTransitions.includes(newStatus);
};

/**
 * Obtenir les prochains statuts possibles pour une commande
 * @param {string} currentStatus
 */
export const getNextPossibleStatuses = (currentStatus) => {
  return OrderStatusFlow[currentStatus] || [];
};

/**
 * Annuler une commande
 * @param {string} id
 * @param {string} reason - Raison de l'annulation
 */
export const cancelOrder = async (id, reason) => {
  const response = await api.post(`/orders/${id}/cancel`, { reason });
  return response.data;
};

/**
 * Rembourser une commande
 * @param {string} id
 * @param {string} reason - Raison du remboursement
 */
export const refundOrder = async (id, reason) => {
  const response = await api.post(`/orders/${id}/refund`, { reason });
  return response.data;
};

/**
 * Obtenir les commandes pour un business
 * @param {string} businessId
 */
export const getBusinessOrders = async (businessId, filters = {}) => {
  const params = new URLSearchParams();
  if (filters.status) params.append('status', filters.status);
  if (filters.startDate) params.append('startDate', filters.startDate);
  if (filters.endDate) params.append('endDate', filters.endDate);
  if (filters.limit) params.append('limit', filters.limit);
  
  const response = await api.get(`/orders/business/${businessId}?${params.toString()}`);
  return response.data;
};

/**
 * Obtenir les commandes disponibles pour les livreurs
 */
export const getAvailableOrders = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.latitude) params.append('latitude', filters.latitude);
  if (filters.longitude) params.append('longitude', filters.longitude);
  if (filters.radius) params.append('radius', filters.radius);
  
  const response = await api.get(`/orders/available?${params.toString()}`);
  return response.data;
};

/**
 * Accepter une commande (pour livreur)
 * @param {string} orderId
 */
export const acceptOrder = async (orderId) => {
  const response = await api.post(`/orders/${orderId}/accept`);
  return response.data;
};

/**
 * Mettre à jour la position du livreur
 * @param {string} orderId
 * @param {Object} location - { latitude, longitude }
 */
export const updateDriverLocation = async (orderId, location) => {
  const response = await api.post(`/orders/${orderId}/driver-location`, location);
  return response.data;
};

/**
 * Notifier le client de l'arrivée
 * @param {string} orderId
 */
export const notifyArrival = async (orderId) => {
  const response = await api.post(`/orders/${orderId}/notify-arrival`);
  return response.data;
};

/**
 * Confirmer la livraison
 * @param {string} orderId
 * @param {Object} data - { proofOfDelivery, notes }
 */
export const confirmDelivery = async (orderId, data) => {
  const response = await api.post(`/orders/${orderId}/confirm-delivery`, data);
  return response.data;
};

// ─── Helpers pour les labels et couleurs de statut ──────────────────────
export const ORDER_STATUS = {
  [OrderStatus.CREATED]: { label: 'Créée', color: 'warning', dot: '#F59E0B' },
  [OrderStatus.CONFIRMED]: { label: 'Confirmée', color: 'info', dot: '#3B82F6' },
  [OrderStatus.PREPARING]: { label: 'En préparation', color: 'processing', dot: '#FF6600' },
  [OrderStatus.READY_FOR_PICKUP]: { label: 'Prête', color: 'success', dot: '#22C55E' },
  [OrderStatus.IN_TRANSIT]: { label: 'En livraison', color: 'info', dot: '#3B82F6' },
  [OrderStatus.DELIVERED]: { label: 'Livrée', color: 'success', dot: '#22C55E' },
  [OrderStatus.CANCELLED]: { label: 'Annulée', color: 'error', dot: '#EF4444' },
  [OrderStatus.REFUNDED]: { label: 'Remboursée', color: 'error', dot: '#EF4444' },
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

/**
 * Obtenir les étapes du stepper pour une commande
 */
export const getOrderSteps = (currentStatus) => {
  const steps = [
    { key: OrderStatus.CREATED, label: 'Commande créée' },
    { key: OrderStatus.CONFIRMED, label: 'Confirmée' },
    { key: OrderStatus.PREPARING, label: 'En préparation' },
    { key: OrderStatus.READY_FOR_PICKUP, label: 'Prête' },
    { key: OrderStatus.IN_TRANSIT, label: 'En livraison' },
    { key: OrderStatus.DELIVERED, label: 'Livrée' },
  ];

  const statusIndex = steps.findIndex(step => step.key === currentStatus);
  
  return steps.map((step, index) => ({
    ...step,
    completed: index < statusIndex,
    current: index === statusIndex,
    pending: index > statusIndex,
  }));
};
