import { api, apiFetch } from './api';

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
    return await api.getAvailableOrders();
  } catch (error) {
    console.error('Error fetching available orders:', error);
    throw error;
  }
};

export const acceptOrder = async (orderId) => {
  try {
    // ✅ FIX #20 : Utiliser le vrai endpoint d'acceptation
    return await api.acceptOrder(orderId);
  } catch (error) {
    console.error('Error accepting order:', error);
    throw error;
  }
};

export const confirmDelivery = async (orderId) => {
  try {
    // ✅ FIX #20 : Utiliser la validation livreur (driver-validate)
    return await api.driverValidateDelivery(orderId);
  } catch (error) {
    console.error('Error confirming delivery:', error);
    throw error;
  }
};

export const updateDriverLocation = async (orderId, location) => {
  try {
    return await apiFetch(`/orders/${orderId}/driver-location`, {
      method: 'POST',
      body: { latitude: location.latitude, longitude: location.longitude },
    });
  } catch (error) {
    console.error('Error updating driver location:', error);
    throw error;
  }
};

export const startDelivery = async (orderId) => {
  try {
    // IN_TRANSIT = PROCESSING côté backend
    return await api.updateOrderStatus(orderId, 'PROCESSING');
  } catch (error) {
    console.error('Error starting delivery:', error);
    throw error;
  }
};

export const completeDelivery = async (orderId) => {
  try {
    return await api.driverValidateDelivery(orderId);
  } catch (error) {
    console.error('Error completing delivery:', error);
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

// ✅ FIX #20 : Statuts backend réels (Machine à États FSM)
export const getStatusInfo = (status) => {
  const statusMap = {
    PENDING: { label: 'En attente', color: 'yellow', icon: 'Clock' },
    PAID: { label: 'Payé', color: 'blue', icon: 'CreditCard' },
    IN_PREPARATION: { label: 'En préparation', color: 'orange', icon: 'Package' },
    READY_FOR_PICKUP: { label: 'Prêt', color: 'cyan', icon: 'Check' },
    DRIVER_ASSIGNED: { label: 'Livreur assigné', color: 'indigo', icon: 'User' },
    PROCESSING: { label: 'En cours', color: 'blue', icon: 'Loader' },
    IN_DELIVERY: { label: 'En livraison', color: 'purple', icon: 'Navigation' },
    DELIVERED_PENDING_CONFIRMATION: { label: 'Livré (en attente)', color: 'amber', icon: 'Clock' },
    DELIVERED: { label: 'Livré', color: 'green', icon: 'CheckCircle' },
    COMPLETED: { label: 'Terminé', color: 'green', icon: 'CheckCircle' },
    CANCELLED: { label: 'Annulé', color: 'red', icon: 'XCircle' },
    FAILED: { label: 'Échoué', color: 'red', icon: 'AlertTriangle' },
    DISPUTED: { label: 'Litige', color: 'orange', icon: 'AlertTriangle' },
    REFUNDED: { label: 'Remboursé', color: 'gray', icon: 'RotateCcw' },
  };
  return statusMap[status] || { label: status, color: 'gray', icon: 'AlertCircle' };
};

// ✅ FIX #20 : Étapes réelles du FSM backend
export const getOrderSteps = (currentStatus) => {
  const steps = [
    { key: 'PENDING', label: 'En attente' },
    { key: 'PAID', label: 'Payé' },
    { key: 'IN_PREPARATION', label: 'En préparation' },
    { key: 'READY_FOR_PICKUP', label: 'Prêt' },
    { key: 'IN_DELIVERY', label: 'En livraison' },
    { key: 'COMPLETED', label: 'Terminé' },
  ];

  const currentIndex = steps.findIndex(step => step.key === currentStatus);
  return steps.map((step, index) => ({
    ...step,
    completed: index <= currentIndex,
    current: index === currentIndex,
  }));
};

// ✅ FIX #20 : Transitions réelles du FSM backend
export const getNextPossibleStatuses = (currentStatus) => {
  const transitions = {
    PENDING: ['PAID', 'CANCELLED'],
    PAID: ['IN_PREPARATION', 'CANCELLED'],
    IN_PREPARATION: ['READY_FOR_PICKUP', 'CANCELLED'],
    READY_FOR_PICKUP: ['DRIVER_ASSIGNED', 'CANCELLED'],
    DRIVER_ASSIGNED: ['IN_DELIVERY', 'CANCELLED'],
    IN_DELIVERY: ['DELIVERED_PENDING_CONFIRMATION', 'CANCELLED'],
    DELIVERED_PENDING_CONFIRMATION: ['DELIVERED', 'COMPLETED', 'DISPUTED'],
    DELIVERED: ['COMPLETED', 'DISPUTED', 'REFUNDED'],
    COMPLETED: [],
    CANCELLED: [],
    FAILED: [],
    DISPUTED: ['REFUNDED', 'COMPLETED'],
    REFUNDED: [],
  };
  return transitions[currentStatus] || [];
};
