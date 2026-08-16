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
