/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

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

/**
 * Approuver une candidature (crée le profil marchand/livreur + portefeuille + identifiants)
 * @param {string} id - identifiant de la candidature
 * @param {string} [coverImage] - affiche du restaurant (optionnel, marchands
 *   uniquement) : transmise au business créé pour l'afficher sur l'app client.
 *   Le corps est TOUJOURS un objet : un POST sans corps déclencherait une
 *   erreur de validation côté serveur (class-validator sur undefined).
 */
export const approveApplication = async (id, coverImage) => {
  const response = await api.post(
    `/users/applications/${id}/approve`,
    coverImage ? { coverImage } : {},
  );
  return response.data;
};

/** Rejeter une candidature (le motif est obligatoire) */
export const rejectApplication = async (id, reason) => {
  const response = await api.post(`/users/applications/${id}/reject`, { reason });
  return response.data;
};
