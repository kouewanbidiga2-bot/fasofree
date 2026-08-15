import { api } from './api';

export const getProductsByBusiness = async (businessId) => {
  try {
    return await api.getBusinessProducts(businessId);
  } catch (error) {
    console.error('Error fetching products:', error);
    throw error;
  }
};

export const createProduct = async (productData) => {
  try {
    return await api.createProduct(productData);
  } catch (error) {
    console.error('Error creating product:', error);
    throw error;
  }
};

export const updateProduct = async (productId, productData) => {
  try {
    return await api.updateProduct(productId, productData);
  } catch (error) {
    console.error('Error updating product:', error);
    throw error;
  }
};

export const deleteProduct = async (productId) => {
  try {
    return await api.deleteProduct(productId);
  } catch (error) {
    console.error('Error deleting product:', error);
    throw error;
  }
};

export const toggleProductAvailability = async (productId) => {
  try {
    return await api.toggleProductAvailability(productId);
  } catch (error) {
    console.error('Error toggling product availability:', error);
    throw error;
  }
};
