import { api } from './api';

export const getMyOrders = async () => {
  try {
    return await api.getMyOrders();
  } catch (error) {
    console.error('Error fetching my orders:', error);
    throw error;
  }
};

export const getAvailableOrders = async () => {
  try {
    return await api.getMyOrders();
  } catch (error) {
    console.error('Error fetching available orders:', error);
    throw error;
  }
};

export const acceptOrder = async (orderId) => {
  try {
    return await api.updateOrderStatus(orderId, 'CONFIRMED');
  } catch (error) {
    console.error('Error accepting order:', error);
    throw error;
  }
};

export const confirmDelivery = async (orderId) => {
  try {
    return await api.updateOrderStatus(orderId, 'DELIVERED');
  } catch (error) {
    console.error('Error confirming delivery:', error);
    throw error;
  }
};

export const updateDriverLocation = async (location) => {
  try {
    // This would be a backend endpoint to update driver location
    // For now, we'll store in localStorage
    localStorage.setItem('driverLocation', JSON.stringify(location));
    return { success: true };
  } catch (error) {
    console.error('Error updating driver location:', error);
    throw error;
  }
};

export const getOrderStatus = async (orderId) => {
  try {
    return await api.getOrder(orderId);
  } catch (error) {
    console.error('Error fetching order status:', error);
    throw error;
  }
};

export const updateOrderStatus = async (orderId, status) => {
  try {
    return await api.updateOrderStatus(orderId, status);
  } catch (error) {
    console.error('Error updating order status:', error);
    throw error;
  }
};

export const getStatusInfo = (status) => {
  const statusMap = {
    PENDING: { label: 'En attente', color: 'yellow', icon: 'Clock' },
    CONFIRMED: { label: 'Confirmé', color: 'blue', icon: 'CheckCircle' },
    PREPARING: { label: 'En préparation', color: 'orange', icon: 'Package' },
    DRIVING: { label: 'En livraison', color: 'purple', icon: 'Navigation' },
    DELIVERED: { label: 'Livré', color: 'green', icon: 'CheckCircle' },
    CANCELED: { label: 'Annulé', color: 'red', icon: 'XCircle' },
  };
  return statusMap[status] || { label: status, color: 'gray', icon: 'AlertCircle' };
};

export const getOrderSteps = (currentStatus) => {
  const steps = [
    { key: 'PENDING', label: 'En attente' },
    { key: 'CONFIRMED', label: 'Confirmé' },
    { key: 'PREPARING', label: 'En préparation' },
    { key: 'DRIVING', label: 'En livraison' },
    { key: 'DELIVERED', label: 'Livré' },
  ];
  
  const currentIndex = steps.findIndex(step => step.key === currentStatus);
  return steps.map((step, index) => ({
    ...step,
    completed: index <= currentIndex,
    current: index === currentIndex,
  }));
};

export const getNextPossibleStatuses = (currentStatus) => {
  const transitions = {
    PENDING: ['CONFIRMED', 'CANCELED'],
    CONFIRMED: ['PREPARING', 'CANCELED'],
    PREPARING: ['DRIVING', 'CANCELED'],
    DRIVING: ['DELIVERED'],
    DELIVERED: [],
    CANCELED: [],
  };
  return transitions[currentStatus] || [];
};
