/**
 * FasoFree — Service Analytics
 * Endpoint: /analytics/business/{businessId}
 */
import api from './api';

/**
 * Obtenir les indicateurs d'un commerce (business_admin)
 * @param {string} businessId - UUID du commerce
 * @returns {Promise<Object>} KPIs: totalOrders, totalRevenue, totalClients, etc.
 */
export const getBusinessAnalytics = async (businessId) => {
  const response = await api.get(`/analytics/business/${businessId}`);
  return response.data;
};
