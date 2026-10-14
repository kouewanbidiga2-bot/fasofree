import api from './api';

/**
 * 📣 Service Campagnes Push
 *
 * Endpoints backend (prefix /api/v1/admin/push-campaigns) :
 * - POST /admin/push-campaigns  → créer et envoyer une campagne
 * - GET  /admin/push-campaigns  → historique (paginé)
 *
 * Accessible : SUPER_ADMIN, ADMIN
 */
export const pushCampaignService = {
  /**
   * Crée et envoie une campagne push.
   * @param {Object} dto - { title, body, target }
   * @param {string} dto.title - Titre (3-200 chars)
   * @param {string} dto.body - Corps (3-1000 chars)
   * @param {string} dto.target - 'ALL' | 'CLIENT' | 'DRIVER' | 'MERCHANT'
   * @returns {Promise<Object>} Campagne créée avec recipientCount
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
};

export default pushCampaignService;