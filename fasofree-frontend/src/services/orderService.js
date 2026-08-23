/**
 * FasoFree — Order Service
 * Endpoints backed by backend: /orders
 */
import api from './api';
import { OrderStatus, OrderStatusFlow } from '../types';

/**
 * Créer une nouvelle commande (client)
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
 * Lister les commandes d'un commerce (marchand)
 */
export const getBusinessOrders = async (businessId) => {
  const response = await api.get(`/orders/business/${businessId}`);
  return response.data;
};

/**
 * Obtenir le détail complet d'une commande
 */
export const getOrderById = async (id) => {
  const response = await api.get(`/orders/${id}`);
  return response.data;
};

/**
 * Mettre à jour le statut d'une commande (PATCH /orders/:id/status)
 */
export const updateOrderStatus = async (id, status) => {
  const response = await api.patch(`/orders/${id}/status`, { status });
  return response.data;
};

/**
 * Accepter une commande (pour livreur)
 */
export const acceptOrder = async (orderId) => {
  const response = await api.post(`/orders/${orderId}/accept`);
  return response.data;
};

/**
 * Valider si une transition de statut est valide selon la FSM
 */
export const isValidStatusTransition = (currentStatus, newStatus) => {
  const allowedTransitions = OrderStatusFlow[currentStatus] || [];
  return allowedTransitions.includes(newStatus);
};

/**
 * Obtenir les prochains statuts possibles pour une commande
 */
export const getNextPossibleStatuses = (currentStatus) => {
  return OrderStatusFlow[currentStatus] || [];
};

// ─── FUNCTIONS BELOW REQUIRE BACKEND ROUTES NOT YET IMPLEMENTED ────────
// They return null gracefully if the endpoint is missing.

/**
 * Confirmer la livraison (⏳ NOT YET IMPLEMENTED on backend)
 * Expected route: POST /orders/:orderId/confirm-delivery
 */
export const confirmDelivery = async (orderId, data) => {
  try {
    const response = await api.post(`/orders/${orderId}/confirm-delivery`, data);
    return response.data;
  } catch {
    return null;
  }
};

/**
 * Mettre à jour la position du livreur (⏳ NOT YET IMPLEMENTED on backend)
 * Expected route: POST /orders/:orderId/driver-location
 */
export const updateDriverLocation = async (orderId, location) => {
  try {
    const response = await api.post(`/orders/${orderId}/driver-location`, location);
    return response.data;
  } catch {
    return null;
  }
};

// ─── Helpers pour les labels et couleurs de statut ──────────────────────
export const ORDER_STATUS = {
  [OrderStatus.PENDING]: { label: 'En attente', color: 'warning', dot: '#F59E0B' },
  [OrderStatus.PAID]: { label: 'Payée', color: 'info', dot: '#3B82F6' },
  [OrderStatus.IN_PREPARATION]: { label: 'En préparation', color: 'processing', dot: '#FF6600' },
  [OrderStatus.PROCESSING]: { label: 'En cours', color: 'info', dot: '#3B82F6' },
  [OrderStatus.DELIVERED_PENDING_CONFIRMATION]: { label: 'Livrée (attente)', color: 'processing', dot: '#FF6600' },
  [OrderStatus.DELIVERED]: { label: 'Livrée', color: 'success', dot: '#22C55E' },
  [OrderStatus.COMPLETED]: { label: 'Terminée', color: 'success', dot: '#22C55E' },
  [OrderStatus.CANCELLED]: { label: 'Annulée', color: 'error', dot: '#EF4444' },
  [OrderStatus.FAILED]: { label: 'Échouée', color: 'error', dot: '#EF4444' },
  [OrderStatus.DISPUTED]: { label: 'Litigée', color: 'error', dot: '#EF4444' },
  [OrderStatus.REFUNDED]: { label: 'Remboursée', color: 'error', dot: '#EF4444' },
};

export const ORDER_TYPES = {
  MERCHANT: 'Marchand',
  P2P_DELIVERY: 'Livraison P2P',
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
    { key: OrderStatus.PENDING, label: 'Commande créée' },
    { key: OrderStatus.PAID, label: 'Payée' },
    { key: OrderStatus.IN_PREPARATION, label: 'En préparation' },
    { key: OrderStatus.PROCESSING, label: 'En cours' },
    { key: OrderStatus.DELIVERED, label: 'Livrée' },
    { key: OrderStatus.COMPLETED, label: 'Terminée' },
  ];

  const statusIndex = steps.findIndex(step => step.key === currentStatus);

  return steps.map((step, index) => ({
    ...step,
    completed: index < statusIndex,
    current: index === statusIndex,
    pending: index > statusIndex,
  }));
};
