/**
 * FasoFree — Service Businesses (Commerces)
 * Endpoints: /businesses
 */
import api from './api';

/**
 * Rechercher les commerces à proximité
 * @param {number} latitude
 * @param {number} longitude
 * @param {number} radiusInKm - Rayon en km (défaut: 5)
 */
export const getNearbyBusinesses = async (latitude, longitude, radiusInKm = 5) => {
  const response = await api.get('/businesses/nearby', {
    params: { latitude, longitude, radiusInKm },
  });
  return response.data;
};

/**
 * Obtenir un commerce avec son catalogue complet
 * @param {string} id - ID du commerce
 */
export const getBusinessById = async (id) => {
  const response = await api.get(`/businesses/${id}`);
  return response.data;
};

/**
 * Créer un nouveau commerce (business_admin)
 * @param {Object} data - { name, address, phone, latitude, longitude }
 */
export const createBusiness = async (data) => {
  const response = await api.post('/businesses', data);
  return response.data;
};
