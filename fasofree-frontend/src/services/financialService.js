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
 * Obtenir les données financières agrégées par jour
 * @param {string} period - '7d' | '30d' | '90d'
 * @returns {Promise<{period, summary, chartData}>}
 */
export const getFinancialOverview = async (period = '30d') => {
  const response = await api.get('/financial/overview', { params: { period } });
  return response.data;
};

/**
 * Analytics produits (achats, livré/sur place, top/worst)
 */
export const getProductAnalytics = async ({ brandId, businessId, period = '30d' } = {}) => {
  const response = await api.get('/financial/products', { params: { brandId, businessId, period } });
  return response.data;
};

/**
 * Tous les flux d'argent (entrées, sorties, reversals)
 */
export const getMoneyFlows = async ({ brandId, businessId, period = '30d' } = {}) => {
  const response = await api.get('/financial/money-flows', { params: { brandId, businessId, period } });
  return response.data;
};

/**
 * Ventilation par marque et agence
 */
export const getBrandBreakdown = async (period = '30d') => {
  const response = await api.get('/financial/brands', { params: { period } });
  return response.data;
};

/**
 * Finances complètes d'un business (BusinessAdmin)
 */
export const getBusinessFinance = async (businessId, period = '30d') => {
  const response = await api.get(`/financial/business/${businessId}`, { params: { period } });
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
 * Obtenir l'historique des transactions d'un portefeuille
 * @param {string} walletId - ID du portefeuille
 * @param {number} limit - Nombre max de transactions
 */
export const getWalletTransactions = async (walletId, limit = 50) => {
  const response = await api.get(`/wallets/${walletId}/transactions`, { params: { limit } });
  return response.data;
};

/**
 * Obtenir la santé du système
 */
export const getSystemHealth = async () => {
  const response = await api.get('/health');
  return response.data;
};
