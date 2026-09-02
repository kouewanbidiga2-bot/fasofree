import api from './api';

export const getSubscriptionPlans = async () => {
  const response = await api.get('/subscriptions/plans');
  return response.data;
};

export const createSubscriptionPlan = async (data) => {
  const response = await api.post('/subscriptions/plans', data);
  return response.data;
};

export const updateSubscriptionPlan = async (code, data) => {
  const response = await api.patch(`/subscriptions/plans/${code}`, data);
  return response.data;
};

export const getSubscriptions = async () => {
  const response = await api.get('/subscriptions');
  return response.data;
};

export const assignSubscription = async (data) => {
  const response = await api.post('/subscriptions', data);
  return response.data;
};

export const getBusinesses = async () => {
  const response = await api.get('/businesses');
  return response.data;
};

export const deleteBusiness = async (id) => {
  const response = await api.delete(`/businesses/${id}`);
  return response.data;
};

export const getMySubscription = async () => {
  const response = await api.get('/subscriptions/me');
  return response.data;
};

// Brands & Branches (multi-agences)
export const getBrands = async () => {
  const response = await api.get('/brands');
  return response.data;
};

export const getBrandById = async (brandId) => {
  const response = await api.get(`/brands/${brandId}`);
  return response.data;
};

export const createBrand = async (data) => {
  const response = await api.post('/brands', data);
  return response.data;
};

export const updateBrand = async (brandId, data) => {
  const response = await api.patch(`/brands/${brandId}`, data);
  return response.data;
};

export const deleteBrand = async (brandId) => {
  const response = await api.delete(`/brands/${brandId}`);
  return response.data;
};

export const getBrandBranches = async (brandId, latitude, longitude) => {
  const params = new URLSearchParams();
  if (latitude) params.append('latitude', latitude);
  if (longitude) params.append('longitude', longitude);
  const query = params.toString();
  const response = await api.get(`/brands/${brandId}/branches${query ? `?${query}` : ''}`);
  return response.data;
};

export const createBranch = async (brandId, data) => {
  const response = await api.post('/businesses', { ...data, brandId });
  return response.data;
};

export const updateBranch = async (businessId, data) => {
  const response = await api.patch(`/businesses/${businessId}`, data);
  return response.data;
};

export const deleteBranch = async (businessId) => {
  const response = await api.delete(`/businesses/${businessId}`);
  return response.data;
};

export const seedChitirChicken = async () => {
  const response = await api.post('/seed/chitir-chicken');
  return response.data;
};
