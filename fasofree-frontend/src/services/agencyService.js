/**
 * FasoFree — Service Agences partenaires (Niveau 2 du dispatch)
 * Endpoints: /agencies
 */
import api from './api';

/**
 * Liste des agences (SUPER_ADMIN)
 */
export const getAgencies = async () => {
  const response = await api.get('/agencies');
  return response.data;
};

/**
 * Créer une agence (SUPER_ADMIN)
 */
export const createAgency = async (payload) => {
  const response = await api.post('/agencies', payload);
  return response.data;
};

/**
 * Mettre à jour une agence (SUPER_ADMIN)
 */
export const updateAgency = async (id, payload) => {
  const response = await api.patch(`/agencies/${id}`, payload);
  return response.data;
};

/**
 * Profil de mon agence (AGENCY)
 */
export const getMyAgency = async () => {
  const response = await api.get('/agencies/me');
  return response.data;
};

/**
 * Courses routées vers mon agence (AGENCY)
 */
export const getAgencyDeliveries = async () => {
  const response = await api.get('/agencies/deliveries');
  return response.data;
};

/**
 * Chauffeurs rattachés à mon agence (AGENCY)
 */
export const getAgencyDrivers = async () => {
  const response = await api.get('/agencies/drivers');
  return response.data;
};

/**
 * Assigner une course à un de mes chauffeurs (AGENCY)
 */
export const assignAgencyDelivery = async (orderId, driverId) => {
  const response = await api.post(`/agencies/deliveries/${orderId}/assign`, { driverId });
  return response.data;
};
