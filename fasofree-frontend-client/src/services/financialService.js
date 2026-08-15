import { api } from './api';

export const getFinancialDashboard = async () => {
  try {
    return await api.getFinancialDashboard();
  } catch (error) {
    console.error('Error fetching financial dashboard:', error);
    throw error;
  }
};

export const getPendingDisputes = async () => {
  try {
    // For now, return mock disputes data
    return [
      {
        id: '1',
        orderId: 'order-123',
        reason: 'Commande incomplète',
        description: 'Il manque le Coca-Cola dans la livraison.',
        status: 'PENDING',
        amount: 5000,
        createdAt: new Date().toISOString(),
      },
      {
        id: '2',
        orderId: 'order-456',
        reason: 'Produit abîmé',
        description: 'Le poulet était froid.',
        status: 'PENDING',
        amount: 8000,
        createdAt: new Date(Date.now() - 86400000).toISOString(),
      },
    ];
  } catch (error) {
    console.error('Error fetching pending disputes:', error);
    throw error;
  }
};

export const getTransactions = async (limit = 50) => {
  try {
    // This would call a backend endpoint to get transactions
    return [];
  } catch (error) {
    console.error('Error fetching transactions:', error);
    throw error;
  }
};

export const getRevenueByPeriod = async (startDate, endDate) => {
  try {
    // This would call a backend endpoint to get revenue by period
    return {
      totalRevenue: 5000000,
      totalCommission: 42500,
      orderCount: 1250,
    };
  } catch (error) {
    console.error('Error fetching revenue by period:', error);
    throw error;
  }
};
