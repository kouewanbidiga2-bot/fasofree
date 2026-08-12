/**
 * FasoFree — Service Portefeuilles (Wallets)
 * Endpoints: /wallets
 */
import api from './api';

/**
 * Obtenir ou créer le portefeuille d'un utilisateur
 * @param {string} userRole - Rôle de l'utilisateur (ex: 'client', 'driver', 'business_admin')
 * @param {string} userId - UUID de l'utilisateur
 */
export const getWallet = async (userRole, userId) => {
  const response = await api.get(`/wallets/${userRole}/${userId}`);
  return response.data;
};

/**
 * Obtenir l'historique des transactions d'un portefeuille
 * @param {string} walletId - UUID du portefeuille
 * @param {number} limit - Nombre de transactions à retourner
 */
export const getWalletTransactions = async (walletId, limit = 20) => {
  const response = await api.get(`/wallets/${walletId}/transactions`, {
    params: { limit },
  });
  return response.data;
};

/**
 * Obtenir le tableau de bord financier global (super_admin)
 */
export const getFinancialDashboard = async () => {
  const response = await api.get('/financial/dashboard');
  return response.data;
};
