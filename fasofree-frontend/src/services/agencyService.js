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

// ─── 📣 APPEL D'OFFRES MULTI-AGENCES (bloc A4) ───────────────────
// À T+0, FasoFree diffuse la course à TOUTES les agences éligibles.
// La première qui accepte gagne : les offres concurrentes sont closes.

/**
 * Offres d'appel d'offres encore ouvertes pour mon agence (AGENCY)
 * Chaque offre porte `secondsRemaining` (compte à rebours de la fenêtre).
 */
export const getAgencyOpenOffers = async () => {
  const response = await api.get('/agencies/offers');
  return response.data;
};

/**
 * Accepter une offre — « premier qui accepte gagne » (AGENCY).
 * Renvoie 400 si une autre agence a accepté avant, ou si la fenêtre est écoulée.
 */
export const acceptAgencyOffer = async (orderId) => {
  const response = await api.post(`/agencies/deliveries/${orderId}/accept`);
  return response.data;
};

/**
 * Refuser une offre (AGENCY). L'appel d'offres continue pour les autres.
 */
export const refuseAgencyOffer = async (orderId) => {
  const response = await api.post(`/agencies/deliveries/${orderId}/refuse`);
  return response.data;
};

// ─── ⚖️ SANCTIONS QUALITÉ (bloc C) ───────────────────────────────

/**
 * Sanctions qualité de mon agence (AGENCY)
 */
export const getAgencyPenalties = async () => {
  const response = await api.get('/agencies/penalties');
  return response.data;
};

// ─── 📍 GÉOLOCALISATION (bloc E) ────────────────────────────────

/**
 * Carte temps réel de l'agence : positions de SES chauffeurs et de ses
 * courses actives. Le périmètre est borné à l'agence connectée.
 */
export const getAgencyMap = async () => {
  const response = await api.get('/agencies/map');
  return response.data;
};
