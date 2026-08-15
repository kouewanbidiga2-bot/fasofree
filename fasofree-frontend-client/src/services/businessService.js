import api from './api';

export const businessService = {
  getAllBusinesses: async (params = {}) => {
    const response = await api.get('/businesses', { params });
    return response.data;
  },

  getBusinessById: async (id) => {
    const response = await api.get(`/businesses/${id}`);
    return response.data;
  },

  getBusinessMenu: async (businessId) => {
    const response = await api.get(`/businesses/${businessId}/menu`);
    return response.data;
  },

  searchBusinesses: async (query, filters = {}) => {
    const response = await api.get('/businesses/search', {
      params: { q: query, ...filters }
    });
    return response.data;
  },
};
