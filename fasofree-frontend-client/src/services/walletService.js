import { api } from './api';

export const getWallet = async (userRole, userId) => {
  try {
    // For now, return mock wallet data
    // This would call api.getWallet(userRole, userId) when backend is ready
    return {
      id: 'wallet-123',
      balance: 50000,
      currency: 'XOF',
      transactions: [
        {
          id: 'tx-1',
          type: 'CREDIT',
          amount: 15000,
          description: 'Livraison commande #1234',
          date: new Date().toISOString(),
        },
        {
          id: 'tx-2',
          type: 'DEBIT',
          amount: 2000,
          description: 'Retrait',
          date: new Date(Date.now() - 86400000).toISOString(),
        },
      ],
    };
  } catch (error) {
    console.error('Error fetching wallet:', error);
    throw error;
  }
};

export const getWalletTransactions = async (walletId, limit = 10) => {
  try {
    // This would call api.getWalletTransactions(walletId, limit) when backend is ready
    return [];
  } catch (error) {
    console.error('Error fetching wallet transactions:', error);
    throw error;
  }
};

export const requestPayout = async (amount) => {
  try {
    // This would be a backend endpoint to request payout
    return { success: true, message: 'Demande de retrait soumise' };
  } catch (error) {
    console.error('Error requesting payout:', error);
    throw error;
  }
};
