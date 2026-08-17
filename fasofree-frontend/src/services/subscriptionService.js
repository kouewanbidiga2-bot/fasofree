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

export const getMySubscription = async () => {
  const response = await api.get('/subscriptions/me');
  return response.data;
};
