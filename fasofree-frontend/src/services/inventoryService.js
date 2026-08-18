/**
 * FasoFree — Inventory / Products Service
 * Routes marked (⏳ NOT YET IMPLEMENTED) require backend endpoints.
 * They return null gracefully if the backend returns 404.
 */
import api from './api';

/**
 * Get products for a business
 * Backend route: GET /products/business/:businessId
 */
export const getBusinessProducts = async (businessId, filters = {}) => {
  const params = new URLSearchParams();
  if (filters.category) params.append('category', filters.category);

  const response = await api.get(`/products/business/${businessId}?${params.toString()}`);
  return response.data;
};

/**
 * Create new product
 * Backend route: POST /products
 */
export const createProduct = async (productData) => {
  const response = await api.post('/products', {
    name: productData.name,
    description: productData.description,
    price: productData.price,
    imageUrl: productData.imageUrl,
    category: productData.category,
    isAvailable: productData.isAvailable ?? true,
    businessId: productData.businessId,
  });
  return response.data;
};

/**
 * Update product
 * Backend route: PATCH /products/:id
 */
export const updateProduct = async (productId, productData) => {
  const response = await api.patch(`/products/${productId}`, productData);
  return response.data;
};

/**
 * Delete product
 * Backend route: DELETE /products/:id
 */
export const deleteProduct = async (productId) => {
  const response = await api.delete(`/products/${productId}`);
  return response.data;
};

/**
 * Toggle product availability
 * Backend route: PATCH /products/:id/toggle-availability
 */
export const toggleProductAvailability = async (productId) => {
  const response = await api.patch(`/products/${productId}/toggle-availability`);
  return response.data;
};

// ─── FUNCTIONS BELOW REQUIRE BACKEND ROUTES NOT YET IMPLEMENTED ────────
// They return null gracefully if the endpoint is missing.

/**
 * Update stock quantity (⏳ NOT YET IMPLEMENTED on backend)
 * Expected route: POST /products/:id/stock
 */
export const updateStock = async (productId, quantity, reason = 'MANUAL_ADJUSTMENT') => {
  try {
    const response = await api.post(`/products/${productId}/stock`, { quantity, reason });
    return response.data;
  } catch {
    return null;
  }
};

/**
 * Get low stock alerts (⏳ NOT YET IMPLEMENTED on backend)
 * Expected route: GET /products/business/:businessId/low-stock
 */
export const getLowStockAlerts = async (businessId) => {
  try {
    const response = await api.get(`/products/business/${businessId}/low-stock`);
    return response.data;
  } catch {
    return [];
  }
};

/**
 * Generate SKU (⏳ NOT YET IMPLEMENTED on backend)
 * Expected route: POST /products/generate-sku
 */
export const generateSKU = async (businessId, productName, category) => {
  try {
    const response = await api.post('/products/generate-sku', { businessId, productName, category });
    return response.data?.sku || null;
  } catch {
    return null;
  }
};
