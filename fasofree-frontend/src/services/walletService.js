/**
 * FasoFree — Service Portefeuilles (Wallets)
 */
import api from './api';

/**
 * Obtenir ou créer le portefeuille d'un utilisateur
 */
export const getWallet = async (userRole, userId) => {
  const response = await api.get(`/wallets/${userRole}/${userId}`);
  return response.data;
};

/**
 * Obtenir le wallet d'une agence spécifique
 */
export const getWalletByBranch = async (userRole, userId, branchId) => {
  const response = await api.get(`/wallets/${userRole}/${userId}/branch/${branchId}`);
  return response.data;
};

/**
 * Obtenir les wallets agrégés d'une marque
 */
export const getBrandWallets = async (brandId) => {
  const response = await api.get(`/wallets/brand/${brandId}`);
  return response.data;
};

/**
 * Obtenir l'historique des transactions d'un portefeuille
 */
export const getWalletTransactions = async (walletId, limit = 20) => {
  const response = await api.get(`/wallets/${walletId}/transactions`, {
    params: { limit },
  });
  return response.data;
};

/**
 * Preview des frais de retrait
 */
export const previewPayoutFee = async (amountFcfa) => {
  const response = await api.post('/wallets/fee-preview', { amountFcfa });
  return response.data;
};

/**
 * Demander un retrait Mobile Money
 */
export const requestWithdrawal = async (data) => {
  const response = await api.post('/wallets/withdrawals', data);
  return response.data;
};
