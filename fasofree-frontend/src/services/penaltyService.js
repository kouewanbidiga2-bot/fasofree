/**
 * FasoFree — Service Pénalités qualité & SLA de livraison (bloc C)
 * Endpoints: /delivery-penalties
 *
 * Rôles autorisés : SUPER_ADMIN, ADMIN, SUPPORT (le support traite les
 * litiges au quotidien et doit pouvoir sanctionner sans dépendre d'un admin).
 */
import api from './api';

/**
 * 🎚️ Vue consolidée : sanctions actives (3 crans) + retards observés.
 * Les libellés (livreur, société, commerce) sont déjà résolus côté serveur.
 *
 * @param {{ days?: number, targetType?: 'DRIVER'|'AGENCY', activeOnly?: boolean }} params
 */
export const getQualityOverview = async (params = {}) => {
  const response = await api.get('/delivery-penalties/quality-overview', {
    params,
  });
  return response.data;
};

/**
 * Liste brute des sanctions (filtrable). Conservée pour les usages ciblés :
 * l'écran de supervision utilise `getQualityOverview`.
 */
export const listPenalties = async (params = {}) => {
  const response = await api.get('/delivery-penalties', { params });
  return response.data;
};

/**
 * Appliquer une sanction.
 * `effectiveUntil` (ISO) est optionnel : sans lui, une SUSPENSION prend
 * 7 jours par défaut, les autres niveaux restent jusqu'à révocation.
 */
export const createPenalty = async (payload) => {
  const response = await api.post('/delivery-penalties', payload);
  return response.data;
};

/** Révoquer une sanction (contestation acceptée) — jamais de suppression. */
export const revokePenalty = async (id) => {
  const response = await api.patch(`/delivery-penalties/${id}/revoke`);
  return response.data;
};

/**
 * Livreurs/coursiers pour le sélecteur de cible.
 * Réutilise l'endpoint existant de l'assignation manuelle plutôt que d'en
 * créer un second : une seule source de vérité pour la liste des livreurs.
 */
export const getAvailableDrivers = async () => {
  const response = await api.get('/orders/available-drivers');
  return response.data;
};

/**
 * Mes sanctions en tant que livreur (DRIVER / COURIER).
 * Le livreur ne voit que les siennes — transparence sur les retards
 * constatés et les décisions prises à son encontre.
 */
export const getMyPenalties = async () => {
  const response = await api.get('/delivery-penalties/me');
  return response.data;
};
