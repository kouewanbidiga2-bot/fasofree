/**
 * FasoFree — Service Analytics
 */
import api from './api';

/**
 * Obtenir les indicateurs d'un commerce (business_admin)
 */
export const getBusinessAnalytics = async (businessId) => {
  const response = await api.get(`/analytics/business/${businessId}`);
  return response.data;
};

/**
 * Obtenir les analytics agrégés d'une marque (toutes les agences)
 */
export const getBrandAnalytics = async (brandId, filter = {}) => {
  const params = new URLSearchParams();
  if (filter.period) params.append('period', filter.period);
  if (filter.startDate) params.append('startDate', filter.startDate);
  if (filter.endDate) params.append('endDate', filter.endDate);
  const query = params.toString();
  const response = await api.get(`/analytics/brand/${brandId}${query ? `?${query}` : ''}`);
  return response.data;
};

/**
 * Comparer les agences d'une marque
 */
export const compareBranches = async (brandId, filter = {}) => {
  const params = new URLSearchParams();
  if (filter.period) params.append('period', filter.period);
  if (filter.startDate) params.append('startDate', filter.startDate);
  if (filter.endDate) params.append('endDate', filter.endDate);
  const query = params.toString();
  const response = await api.get(`/analytics/brand/${brandId}/compare${query ? `?${query}` : ''}`);
  return response.data;
};

/**
 * Obtenir le dashboard financier global (super_admin)
 */
export const getFinancialDashboard = async () => {
  const response = await api.get('/financial/dashboard');
  return response.data;
};
