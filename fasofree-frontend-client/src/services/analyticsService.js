import { api } from './api';

export const getBusinessAnalytics = async (businessId) => {
  try {
    // For now, return mock analytics data
    // This would call a backend endpoint when ready
    return {
      overview: {
        totalOrders: 156,
        totalRevenue: 1250000,
        averageOrderValue: 8012,
        completionRate: 94.5,
      },
      daily: [
        { date: '2026-08-08', orders: 22, revenue: 180000 },
        { date: '2026-08-09', orders: 18, revenue: 145000 },
        { date: '2026-08-10', orders: 25, revenue: 210000 },
        { date: '2026-08-11', orders: 20, revenue: 160000 },
        { date: '2026-08-12', orders: 28, revenue: 230000 },
        { date: '2026-08-13', orders: 23, revenue: 185000 },
        { date: '2026-08-14', orders: 20, revenue: 140000 },
      ],
      topProducts: [
        { id: '1', name: 'Riz Sauce Gras', orders: 45, revenue: 360000 },
        { id: '2', name: 'Tô', orders: 38, revenue: 190000 },
        { id: '3', name: 'Poulet Braisé', orders: 32, revenue: 320000 },
        { id: '4', name: 'Brochettes', orders: 28, revenue: 140000 },
        { id: '5', name: 'Salade', orders: 13, revenue: 40000 },
      ],
      peakHours: [
        { hour: '12:00', orders: 35 },
        { hour: '13:00', orders: 42 },
        { hour: '19:00', orders: 38 },
        { hour: '20:00', orders: 41 },
      ],
    };
  } catch (error) {
    console.error('Error fetching business analytics:', error);
    throw error;
  }
};

export const getFinancialDashboard = async () => {
  try {
    // For now, return mock financial data
    return {
      totalRevenue: 5000000,
      totalCommission: 42500,
      activeMerchants: 45,
      totalOrders: 1250,
      monthlyRevenue: [
        { month: 'Jan', revenue: 350000 },
        { month: 'Feb', revenue: 420000 },
        { month: 'Mar', revenue: 380000 },
        { month: 'Apr', revenue: 450000 },
        { month: 'May', revenue: 520000 },
        { month: 'Jun', revenue: 480000 },
        { month: 'Jul', revenue: 550000 },
        { month: 'Aug', revenue: 600000 },
      ],
    };
  } catch (error) {
    console.error('Error fetching financial dashboard:', error);
    throw error;
  }
};
