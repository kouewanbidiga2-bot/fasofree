/**
 * FasoFree - Inventory Management Service
 * Handles all inventory-related operations including stock tracking,
 * SKU management, variants, and automatic stock decrements
 */

import api from './api';

/**
 * Get products for a business with inventory data
 */
export const getBusinessProducts = async (businessId, filters = {}) => {
  const params = new URLSearchParams();
  if (filters.type) params.append('type', filters.type);
  if (filters.category) params.append('category', filters.category);
  if (filters.status) params.append('status', filters.status);
  if (filters.lowStock) params.append('lowStock', 'true');
  
  const response = await api.get(`/products/business/${businessId}?${params.toString()}`);
  return response.data;
};

/**
 * Get single product with inventory details
 */
export const getProduct = async (productId) => {
  const response = await api.get(`/products/${productId}`);
  return response.data;
};

/**
 * Create new product with inventory configuration
 */
export const createProduct = async (productData) => {
  const response = await api.post('/products', {
    ...productData,
    // Ensure inventory fields are properly set
    trackInventory: productData.trackInventory ?? true,
    stockQuantity: productData.stockQuantity ?? 0,
    minStockAlert: productData.minStockAlert ?? 5,
  });
  return response.data;
};

/**
 * Update product including inventory data
 */
export const updateProduct = async (productId, productData) => {
  const response = await api.patch(`/products/${productId}`, productData);
  return response.data;
};

/**
 * Delete product
 */
export const deleteProduct = async (productId) => {
  const response = await api.delete(`/products/${productId}`);
  return response.data;
};

/**
 * Toggle product availability
 */
export const toggleProductAvailability = async (productId) => {
  const response = await api.patch(`/products/${productId}/toggle-availability`);
  return response.data;
};

/**
 * Update stock quantity (manual adjustment)
 */
export const updateStock = async (productId, quantity, reason = 'MANUAL_ADJUSTMENT') => {
  const response = await api.post(`/products/${productId}/stock`, {
    quantity,
    reason,
  });
  return response.data;
};

/**
 * Get low stock alerts for a business
 */
export const getLowStockAlerts = async (businessId) => {
  const response = await api.get(`/products/business/${businessId}/low-stock`);
  return response.data;
};

/**
 * Get stock movement history
 */
export const getStockHistory = async (productId, filters = {}) => {
  const params = new URLSearchParams();
  if (filters.startDate) params.append('startDate', filters.startDate);
  if (filters.endDate) params.append('endDate', filters.endDate);
  if (filters.limit) params.append('limit', filters.limit);
  
  const response = await api.get(`/products/${productId}/stock-history?${params.toString()}`);
  return response.data;
};

/**
 * Bulk update stock (for order confirmation)
 */
export const bulkUpdateStock = async (items) => {
  const response = await api.post('/products/bulk-stock-update', {
    items: items.map(item => ({
      productId: item.productId,
      quantity: item.quantity,
      reason: 'ORDER_CONFIRMATION',
    })),
  });
  return response.data;
};

/**
 * Generate SKU for a product
 */
export const generateSKU = async (businessId, productName, category) => {
  const response = await api.post('/products/generate-sku', {
    businessId,
    productName,
    category,
  });
  return response.data.sku;
};

/**
 * Validate SKU uniqueness
 */
export const validateSKU = async (sku, excludeProductId = null) => {
  const params = new URLSearchParams();
  params.append('sku', sku);
  if (excludeProductId) params.append('exclude', excludeProductId);
  
  const response = await api.get(`/products/validate-sku?${params.toString()}`);
  return response.data;
};

/**
 * Get inventory statistics for a business
 */
export const getInventoryStats = async (businessId) => {
  const response = await api.get(`/products/business/${businessId}/stats`);
  return response.data;
};

/**
 * Search products by SKU or barcode
 */
export const searchBySKU = async (sku) => {
  const response = await api.get(`/products/search/sku/${sku}`);
  return response.data;
};