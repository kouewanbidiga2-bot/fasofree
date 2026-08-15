/**
 * FasoFree — Service Financier (Super Admin)
 * Endpoints: /financial
 */
import api from './api';

/**
 * Obtenir le dashboard financier global
 * @returns {Promise<object>} Statistiques financières
 */
export const getFinancialDashboard = async () => {
  const response = await api.get('/financial/dashboard');
  return response.data;
};

/**
 * Obtenir les litiges en attente
 * @param {string} status - Statut du litige (optionnel)
 * @returns {Promise<Array>} Liste des litiges
 */
export const getPendingDisputes = async (status) => {
  const response = await api.get('/disputes', { params: status ? { status } : {} });
  return response.data;
};

/**
 * Obtenir la santé du système (float Mobile Money, etc.)
 * @returns {Promise<object>} État de santé
 */
export const getSystemHealth = async () => {
  const response = await api.get('/health');
  return response.data;
};
