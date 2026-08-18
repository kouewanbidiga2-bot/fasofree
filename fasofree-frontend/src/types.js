/**
 * FasoFree — Shared type enums matching the backend
 */

export const OrderStatus = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  IN_PREPARATION: 'IN_PREPARATION',
  PROCESSING: 'PROCESSING',
  DELIVERED_PENDING_CONFIRMATION: 'DELIVERED_PENDING_CONFIRMATION',
  DELIVERED: 'DELIVERED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  FAILED: 'FAILED',
  DISPUTED: 'DISPUTED',
  REFUNDED: 'REFUNDED',
};

/**
 * Allowed status transitions (FSM).
 * From a given status, you may only move to the listed statuses.
 */
export const OrderStatusFlow = {
  [OrderStatus.PENDING]: [OrderStatus.PAID, OrderStatus.CANCELLED],
  [OrderStatus.PAID]: [OrderStatus.IN_PREPARATION, OrderStatus.CANCELLED],
  [OrderStatus.IN_PREPARATION]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
  [OrderStatus.PROCESSING]: [OrderStatus.DELIVERED_PENDING_CONFIRMATION, OrderStatus.CANCELLED],
  [OrderStatus.DELIVERED_PENDING_CONFIRMATION]: [OrderStatus.DELIVERED, OrderStatus.DISPUTED],
  [OrderStatus.DELIVERED]: [OrderStatus.COMPLETED, OrderStatus.DISPUTED],
  [OrderStatus.COMPLETED]: [OrderStatus.REFUNDED],
  [OrderStatus.CANCELLED]: [],
  [OrderStatus.FAILED]: [],
  [OrderStatus.DISPUTED]: [OrderStatus.REFUNDED],
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
