import { api } from './api';

export const getBusinessProducts = async (businessId) => {
  try {
    return await api.getBusinessProducts(businessId);
  } catch (error) {
    console.error('Error fetching business products:', error);
    throw error;
  }
};

export const getLowStockAlerts = async (businessId) => {
  try {
    const products = await api.getBusinessProducts(businessId);
    return products.filter(p => p.stock !== undefined && p.stock < 10);
  } catch (error) {
    console.error('Error fetching low stock alerts:', error);
    throw error;
  }
};

export const updateStock = async (productId, quantity) => {
  try {
    return await api.updateProduct(productId, { stock: quantity });
  } catch (error) {
    console.error('Error updating stock:', error);
    throw error;
  }
};

export const generateSKU = (productName, businessId) => {
  const prefix = 'FF';
  const businessCode = businessId.substring(0, 4).toUpperCase();
  const productCode = productName.substring(0, 3).toUpperCase();
  const timestamp = Date.now().toString().slice(-4);
  return `${prefix}-${businessCode}-${productCode}-${timestamp}`;
};
