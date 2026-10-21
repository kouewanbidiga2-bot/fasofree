/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

export const DriverStatus = {
  ONLINE: 'ONLINE',
  OFFLINE: 'OFFLINE',
  BUSY: 'BUSY',
};

export const OrderStatus = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  PREPARING: 'PREPARING',
  DRIVING: 'DRIVING',
  DELIVERED: 'DELIVERED',
  CANCELED: 'CANCELED',
};

export const UserRole = {
  CLIENT: 'CLIENT',
  BUSINESS_ADMIN: 'BUSINESS_ADMIN',
  DRIVER: 'DRIVER',
  COURIER: 'COURIER',
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
};

export const ProductType = {
  FOOD: 'FOOD',
  DRINK: 'DRINK',
  DESSERT: 'DESSERT',
  OTHER: 'OTHER',
};

export const InventoryStatus = {
  IN_STOCK: 'IN_STOCK',
  LOW_STOCK: 'LOW_STOCK',
  OUT_OF_STOCK: 'OUT_OF_STOCK',
};
