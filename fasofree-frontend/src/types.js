/**
 * FasoFree — Shared type enums matching the backend
 */

export const OrderStatus = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  IN_PREPARATION: 'IN_PREPARATION',
  READY_FOR_PICKUP: 'READY_FOR_PICKUP',
  DRIVER_ASSIGNED: 'DRIVER_ASSIGNED',
  PROCESSING: 'PROCESSING',
  IN_DELIVERY: 'IN_DELIVERY',
  DELIVERED_PENDING_CONFIRMATION: 'DELIVERED_PENDING_CONFIRMATION',
  DELIVERED: 'DELIVERED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  FAILED: 'FAILED',
  DISPUTED: 'DISPUTED',
  REFUNDED: 'REFUNDED',
};

/**
 * Allowed status transitions (FSM) — mirrors backend ORDER_STATUS_FSM.
 */
export const OrderStatusFlow = {
  [OrderStatus.PENDING]: [OrderStatus.PAID, OrderStatus.CANCELLED],
  [OrderStatus.PAID]: [OrderStatus.IN_PREPARATION, OrderStatus.CANCELLED],
  [OrderStatus.IN_PREPARATION]: [OrderStatus.READY_FOR_PICKUP, OrderStatus.CANCELLED],
  [OrderStatus.READY_FOR_PICKUP]: [OrderStatus.DRIVER_ASSIGNED, OrderStatus.CANCELLED],
  [OrderStatus.DRIVER_ASSIGNED]: [OrderStatus.IN_DELIVERY, OrderStatus.CANCELLED],
  [OrderStatus.IN_DELIVERY]: [OrderStatus.DELIVERED_PENDING_CONFIRMATION, OrderStatus.CANCELLED],
  [OrderStatus.DELIVERED_PENDING_CONFIRMATION]: [OrderStatus.DELIVERED, OrderStatus.COMPLETED, OrderStatus.DISPUTED],
  [OrderStatus.DELIVERED]: [OrderStatus.COMPLETED, OrderStatus.DISPUTED, OrderStatus.REFUNDED],
  [OrderStatus.PROCESSING]: [OrderStatus.IN_DELIVERY, OrderStatus.DELIVERED_PENDING_CONFIRMATION, OrderStatus.CANCELLED],
  [OrderStatus.COMPLETED]: [],
  [OrderStatus.CANCELLED]: [],
  [OrderStatus.FAILED]: [],
  [OrderStatus.DISPUTED]: [OrderStatus.REFUNDED, OrderStatus.COMPLETED],
  [OrderStatus.REFUNDED]: [],
};

export const DriverStatus = {
  ONLINE: 'ONLINE',
  OFFLINE: 'OFFLINE',
  BUSY: 'BUSY',
};

export const ProductType = {
  RETAIL: 'RETAIL',
  FOOD: 'FOOD',
  PHARMACY: 'PHARMACY',
  SERVICE: 'SERVICE',
};

export const InventoryStatus = {
  IN_STOCK: 'IN_STOCK',
  LOW_STOCK: 'LOW_STOCK',
  OUT_OF_STOCK: 'OUT_OF_STOCK',
};
