import api from './api';

export const getReviews = async (params) => {
  const q = new URLSearchParams();
  if (params?.targetType) q.set('targetType', params.targetType);
  if (params?.targetId) q.set('targetId', params.targetId);
  const response = await api.get(`/reviews?${q.toString()}`);
  return response.data;
};

export const getReviewsByTarget = async (targetType, targetId) => {
  const response = await api.get(`/reviews/target/${targetType}/${targetId}`);
  return response.data;
};

export const getReviewAverage = async (targetType, targetId) => {
  const response = await api.get(`/reviews/target/${targetType}/${targetId}/average`);
  return response.data;
};
