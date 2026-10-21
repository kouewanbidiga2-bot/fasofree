/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import api from './api';

/**
 * 📣 Service Campagnes Push
 *
 * Endpoints backend (prefix /api/v1/admin/push-campaigns) :
 * - POST  /admin/push-campaigns        → créer (immédiat, programmé ou récurrent)
 * - GET   /admin/push-campaigns        → historique (paginé)
 * - PATCH /admin/push-campaigns/:id/stop → arrêter une campagne récurrente
 *
 * Accessible : SUPER_ADMIN, ADMIN
 */
export const pushCampaignService = {
  /**
   * Crée (et envoie/programme) une campagne push.
   * @param {Object} dto - { title, body, target, scheduledAt?, recurrence?, timeOfDay?, daysOfWeek?, timeZone?, endsAt? }
   * @param {string} dto.title - Titre (3-200 chars)
   * @param {string} dto.body - Corps (3-1000 chars)
   * @param {string} dto.target - 'ALL' | 'CLIENT' | 'DRIVER' | 'MERCHANT'
   * @param {string} [dto.scheduledAt] - ISO : 1ʳᵉ diffusion (mode programmé/récurrent)
   * @param {string} [dto.recurrence] - 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY'
   * @param {string} [dto.timeOfDay] - 'HH:MM' (heure de Ouagadougou)
   * @param {number[]} [dto.daysOfWeek] - jours 0-6 (WEEKLY)
   * @param {string} [dto.timeZone] - fuseau IANA (défaut Africa/Ouagadougou)
   * @param {string} [dto.endsAt] - ISO : fin de la récurrence
   * @returns {Promise<Object>} Campagne créée
   */
  async createCampaign(dto) {
    const res = await api.post('/admin/push-campaigns', dto);
    return res.data;
  },

  /**
   * Liste l'historique des campagnes.
   * @param {number} limit - Max résultats (défaut 50, max 200)
   * @returns {Promise<Array>} Liste des campagnes
   */
  async listCampaigns(limit = 50) {
    const res = await api.get('/admin/push-campaigns', { params: { limit } });
    return res.data;
  },

  /**
   * Arrête une campagne récurrente (passe la campagne à COMPLETED).
   * @param {string} id - Identifiant de la campagne
   * @returns {Promise<Object>} Campagne mise à jour
   */
  async stopCampaign(id) {
    const res = await api.patch(`/admin/push-campaigns/${id}/stop`);
    return res.data;
  },
};

export default pushCampaignService;