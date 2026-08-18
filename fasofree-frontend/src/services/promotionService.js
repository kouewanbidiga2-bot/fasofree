import api from './api';

/**
 * Get promotion quote (discount calculation).
 * Backend route: GET /promotions/quote
 */
export const getPromotionQuote = async (code, amount) => {
  const response = await api.get(`/promotions/quote?code=${encodeURIComponent(code)}&amount=${amount}`);
  return response.data;
};

/**
 * Create a new promotion (SUPER_ADMIN only).
 * Backend route: POST /promotions
 */
export const createPromotion = async (data) => {
  const response = await api.post('/promotions', data);
  return response.data;
};
