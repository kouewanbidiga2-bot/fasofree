/**
 * FasoFree - Inventory & Stock Management Types
 * Comprehensive type definitions for multi-entity inventory system
 */

// Product Types for different business models
export const ProductType = Object.freeze({
  RETAIL: 'RETAIL', // Retail, supermarkets, pharmacies (stock tracking)
  FOOD: 'FOOD', // Restaurants, fast-food (perishable, menus)
  SERVICE: 'SERVICE', // Services
  PHARMACY: 'PHARMACY', // Pharmacy (stock tracking, regulations)
});

// Inventory Tracking Status
export const InventoryStatus = Object.freeze({
  IN_STOCK: 'IN_STOCK',
  LOW_STOCK: 'LOW_STOCK',
  OUT_OF_STOCK: 'OUT_OF_STOCK',
  DISCONTINUED: 'DISCONTINUED',
});

// Order Status FSM (Finite State Machine)
export const OrderStatus = Object.freeze({
  CREATED: 'CREATED',
  CONFIRMED: 'CONFIRMED',
  PREPARING: 'PREPARING',
  READY_FOR_PICKUP: 'READY_FOR_PICKUP',
  IN_TRANSIT: 'IN_TRANSIT',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
  REFUNDED: 'REFUNDED',
});

// Order Status Flow (Valid transitions)
export const OrderStatusFlow = {
  [OrderStatus.CREATED]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  [OrderStatus.PREPARING]: [OrderStatus.READY_FOR_PICKUP, OrderStatus.CANCELLED],
  [OrderStatus.READY_FOR_PICKUP]: [OrderStatus.IN_TRANSIT, OrderStatus.CANCELLED],
  [OrderStatus.IN_TRANSIT]: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
  [OrderStatus.DELIVERED]: [OrderStatus.REFUNDED],
  [OrderStatus.CANCELLED]: [OrderStatus.REFUNDED],
  [OrderStatus.REFUNDED]: [],
};

// Variant Definition
export const ProductVariant = {
  name: 'string', // e.g., "Taille", "Couleur", "Poids"
  options: ['string'], // e.g., ["S", "M", "L"] or ["Rouge", "Bleu"]
};

// Stock Configuration
export const StockConfig = {
  trackInventory: 'boolean',
  stockQuantity: 'number',
  minStockAlert: 'number',
  maxStock: 'number',
  reorderPoint: 'number',
  reorderQuantity: 'number',
};

// Product Type Definition
export const Product = {
  id: 'string',
  name: 'string',
  description: 'string',
  type: ProductType, // RETAIL | FOOD | SERVICE | PHARMACY
  sku: 'string', // Barcode/Unique identifier
  barcode: 'string', // Physical barcode
  price: 'number',
  currency: 'string',
  imageUrl: 'string',
  category: 'string',
  subcategory: 'string',
  tags: ['string'],
  
  // Inventory Management
  trackInventory: 'boolean',
  stockQuantity: 'number',
  minStockAlert: 'number',
  maxStock: 'number',
  reorderPoint: 'number',
  reorderQuantity: 'number',
  inventoryStatus: InventoryStatus,
  
  // Variants (for retail/products with options)
  variants: [ProductVariant],
  selectedVariant: 'object', // Currently selected variant combination
  
  // Food-specific
  isPerishable: 'boolean',
  expiryDate: 'string', // ISO date
  preparationTime: 'number', // minutes
  allergens: ['string'],
  dietary: ['string'], // VEGAN, GLUTEN_FREE, etc.
  
  // Service-specific
  duration: 'number', // minutes
  bookingSlots: ['object'],
  
  // Business
  businessId: 'string',
  businessName: 'string',
  
  // Metadata
  isActive: 'boolean',
  isFeatured: 'boolean',
  createdAt: 'string',
  updatedAt: 'string',
};

// Order Type Definition
export const Order = {
  id: 'string',
  orderNumber: 'string',
  status: OrderStatus,
  type: 'DELIVERY' | 'PICKUP',
  
  // Customer
  customerId: 'string',
  customerName: 'string',
  customerPhone: 'string',
  customerEmail: 'string',
  
  // Delivery Info
  deliveryAddress: 'object',
  deliveryCoordinates: 'object',
  deliveryInstructions: 'string',
  deliveryFee: 'number',
  estimatedDeliveryTime: 'string',
  
  // Business
  businessId: 'string',
  businessName: 'string',
  businessAddress: 'object',
  businessCoordinates: 'object',
  
  // Items
  items: ['object'], // Array of OrderItem
  subtotal: 'number',
  tax: 'number',
  discount: 'number',
  totalAmount: 'number',
  
  // Payment
  paymentMethod: 'string',
  paymentStatus: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED',
  paymentId: 'string',
  
  // Timeline
  createdAt: 'string',
  confirmedAt: 'string',
  preparingAt: 'string',
  readyAt: 'string',
  pickedUpAt: 'string',
  deliveredAt: 'string',
  cancelledAt: 'string',
  
  // Driver
  driverId: 'string',
  driverName: 'string',
  driverPhone: 'string',
  driverLocation: 'object',
  
  // Metadata
  notes: 'string',
  rating: 'number',
  review: 'string',
};

// Order Item
export const OrderItem = {
  id: 'string',
  productId: 'string',
  productName: 'string',
  productImage: 'string',
  quantity: 'number',
  unitPrice: 'number',
  totalPrice: 'number',
  variant: 'object', // Selected variant info
  specialInstructions: 'string',
};

// Driver Status
export const DriverStatus = Object.freeze({
  OFFLINE: 'OFFLINE',
  ONLINE: 'ONLINE',
  BUSY: 'BUSY',
  ON_BREAK: 'ON_BREAK',
});

// Financial Summary
export const FinancialSummary = {
  totalRevenue: 'number',
  totalOrders: 'number',
  totalCommission: 'number',
  totalPayouts: 'number',
  pendingPayouts: 'number',
  averageOrderValue: 'number',
  currency: 'string',
  period: 'string', // TODAY, WEEK, MONTH, YEAR
};

// Business Analytics
export const BusinessAnalytics = {
  businessId: 'string',
  totalOrders: 'number',
  totalRevenue: 'number',
  totalProducts: 'number',
  totalClients: 'number',
  averageRating: 'number',
  topProducts: ['object'],
  revenueByCategory: ['object'],
  ordersByStatus: ['object'],
  period: 'string',
};