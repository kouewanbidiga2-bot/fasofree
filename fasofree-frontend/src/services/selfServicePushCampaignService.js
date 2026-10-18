import api from './api';

/**
 * 💳 Service Campagnes Push AUTO-SERVICE (marchand / agence)
 *
 * Endpoints backend :
 *   marchand : /merchant/push-campaigns
 *   agence   : /agency/push-campaigns
 *
 * Chaque campagne envoyée coûte un montant fixe (100 FCFA par défaut),
 * débité du portefeuille du compte — JAMAIS par destinataire. Une campagne
 * récurrente est débitée à chaque exécution.
 */

const BASE_PATHS = {
  merchant: '/merchant/push-campaigns',
  agency: '/agency/push-campaigns',
};

/** Chemin d'API correspondant au rôle. Dépôt d'un défaut sûr : aucun 500. */
const basePath = (role) => BASE_PATHS[role] ?? BASE_PATHS.merchant;

export const selfServicePushCampaignService = {
  /**
   * Prix d'un envoi (FCFA) pour ce rôle.
   * @param {'merchant'|'agency'} role
   * @returns {Promise<{ unitPriceXof: number }>}
   */
  async pricing(role) {
    const res = await api.get(`${basePath(role)}/pricing`);
    return res.data;
  },

  /**
   * Mes campagnes (les plus récentes d'abord).
   * @param {'merchant'|'agency'} role
   * @param {number} limit
   * @returns {Promise<Array>}
   */
  async list(role, limit = 50) {
    const res = await api.get(basePath(role), { params: { limit } });
    return res.data;
  },

  /**
   * Crée (et envoie, facture, planifie) une campagne.
   * @param {'merchant'|'agency'} role
   * @param {Object} dto - { title, body, audience, scheduledAt?, recurrence?,
   *                         timeOfDay?, daysOfWeek?, timeZone?, endsAt? }
   * @returns {Promise<Object>} Campagne créée
   */
  async create(role, dto) {
    const res = await api.post(basePath(role), dto);
    return res.data;
  },

  /**
   * Arrête une de MES campagnes (passe à COMPLETED).
   * @param {'merchant'|'agency'} role
   * @param {string} id
   * @returns {Promise<Object>}
   */
  async stop(role, id) {
    const res = await api.patch(`${basePath(role)}/${id}/stop`);
    return res.data;
  },
};
