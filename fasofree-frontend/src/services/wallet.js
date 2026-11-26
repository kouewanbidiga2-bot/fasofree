/**
 * Copyright (c) 2026 BIDIGA Imrane - Koliwa. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

/**
 * Koliwa Coursier — portefeuille du livreur.
 */
import api from './api';

export const fetchWallet = async (userId) => {
  const { data } = await api.get(`/wallets/DRIVER/${userId}`);
  return data;
};

export const fetchWalletTransactions = async (walletId, limit = 20) => {
  const { data } = await api.get(`/wallets/${walletId}/transactions`, { params: { limit } });
  return Array.isArray(data) ? data : (data?.transactions ?? data?.items ?? []);
};
