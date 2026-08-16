/**
 * FasoFree — Service Onboarding (Candidatures Marchands & Livreurs)
 * Endpoints: /users/applications (SUPER_ADMIN, ADMIN, SUPPORT)
 */
import api from './api';

/** Liste des candidatures (filtres optionnels : ?type= & ?status=) */
export const getApplications = async (params = {}) => {
  const response = await api.get('/users/applications', { params });
  return response.data;
};

/** Approuver une candidature (crée le profil marchand/livreur + portefeuille + identifiants) */
export const approveApplication = async (id) => {
  const response = await api.post(`/users/applications/${id}/approve`);
  return response.data;
};

/** Rejeter une candidature (le motif est obligatoire) */
export const rejectApplication = async (id, reason) => {
  const response = await api.post(`/users/applications/${id}/reject`, { reason });
  return response.data;
};
