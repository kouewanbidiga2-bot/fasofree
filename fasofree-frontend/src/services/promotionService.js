import api from './api';

export const getPromotions = async () => {
  const response = await api.get('/promotions');
  return response.data;
};

export const createPromotion = async (data) => {
  const response = await api.post('/promotions', data);
  return response.data;
};

export const getPromotion = async (id) => {
  const response = await api.get(`/promotions/${id}`);
  return response.data;
};

export const updatePromotion = async (id, data) => {
  const response = await api.patch(`/promotions/${id}`, data);
  return response.data;
};

export const deletePromotion = async (id) => {
  const response = await api.delete(`/promotions/${id}`);
  return response.data;
};
