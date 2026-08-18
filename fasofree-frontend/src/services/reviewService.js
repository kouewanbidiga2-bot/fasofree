import api from './api';

/**
 * Get reviews for a target (driver/business/courier).
 * Backend route: GET /reviews/target/:targetId
 */
export const getReviewsByTarget = async (targetId) => {
  const response = await api.get(`/reviews/target/${targetId}`);
  return response.data;
};

/**
 * Get average rating for a target.
 * Backend route: GET /reviews/target/:targetId/average
 */
export const getReviewAverage = async (targetId) => {
  const response = await api.get(`/reviews/target/${targetId}/average`);
  return response.data;
};
