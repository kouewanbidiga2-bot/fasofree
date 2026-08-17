import api from './api';

export const getProductsByBusiness = async (businessId, filters) => {
  const params = new URLSearchParams();
  if (filters?.category) params.set('category', filters.category);
  if (filters?.search) params.set('search', filters.search);
  const response = await api.get(`/products/business/${businessId}?${params.toString()}`);
  return response.data;
};

export const getProduct = async (productId) => {
  const response = await api.get(`/products/${productId}`);
  return response.data;
};

export const createProduct = async (data) => {
  const response = await api.post('/products', data);
  return response.data;
};

export const updateProduct = async (productId, data) => {
  const response = await api.patch(`/products/${productId}`, data);
  return response.data;
};

export const deleteProduct = async (productId) => {
  const response = await api.delete(`/products/${productId}`);
  return response.data;
};

export const toggleProductAvailability = async (productId) => {
  const response = await api.patch(`/products/${productId}/toggle-availability`);
  return response.data;
};
