/**
 * FasoFree — Service Commandes (Tour de contrôle / Live)
 * Endpoints: /orders (SUPER_ADMIN, ADMIN, SUPPORT)
 */
import api from './api';

/**
 * Tour de contrôle : toutes les commandes avec position live des livreurs.
 * @param {string} [status] - Filtre optionnel (PENDING, ACCEPTED, IN_TRANSIT, COMPLETED, CANCELLED...)
 */
export const getAdminOrders = async (status) => {
  const params = status ? { status } : {};
  const response = await api.get('/orders', { params });
  return response.data;
};

/**
 * Assigner manuellement un livreur à une commande.
 * @param {string} orderId
 * @param {string} driverId
 */
export const assignDriverToOrder = async (orderId, driverId) => {
  const response = await api.post(`/orders/${orderId}/assign`, { driverId });
  return response.data;
};

/**
 * Liste des livreurs actifs (disponibles pour assignation).
 */
export const getActiveDrivers = async () => {
  const response = await api.get('/orders/available-drivers');
  return response.data;
};
