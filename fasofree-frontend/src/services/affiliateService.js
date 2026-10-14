import api from './api';

/**
 * 🔗 Service Affiliation Marchand
 *
 * Endpoints backend (prefix /api/v1/affiliate):
 * - GET /affiliate/business/:id/link      → lien de suivi (créé si absent)
 * - GET /affiliate/business/:id/stats     → stats funnel (clics → clients → commandes)
 * - GET /affiliate/admin/stats            → stats globales (SUPER_ADMIN)
 * - GET /affiliate/resolve/:code          → résolution code (SUPER_ADMIN)
 *
 * Lien court public (hors préfixe /api/v1) : /r/:code
 * → redirige vers la page restaurant avec cookie aff_code (30j) + ?ref=
 */
export const affiliateService = {
  /**
   * Récupère (ou crée) le lien de suivi du commerce connecté.
   * Renvoie { code, url, restaurantUrl }
   */
  async getMyLink(businessId) {
    const res = await api.get(`/affiliate/business/${businessId}/link`);
    return res.data;
  },

  /**
   * Stats du funnel d'affiliation pour le commerce connecté.
   * Renvoie { businessId, businessName, code, url, clicks, signups, orders, revenue, conversionRate }
   */
  async getMyStats(businessId) {
    const res = await api.get(`/affiliate/business/${businessId}/stats`);
    return res.data;
  },

  /**
   * Stats globales (SUPER_ADMIN uniquement).
   * Renvoie { totalLinks, totalClicks, totalSignups, totalOrders, totalRevenue, topBusinesses[] }
   */
  async getGlobalStats() {
    const res = await api.get('/affiliate/admin/stats');
    return res.data;
  },

  /**
   * Résout un code affilié vers un businessId (SUPER_ADMIN).
   */
  async resolveCode(code) {
    const res = await api.get(`/affiliate/resolve/${code}`);
    return res.data;
  },

  /**
   * URL publique du lien court (pour partage WhatsApp/TikTok/QR Code).
   * Ex: https://api.fasofree.site/r/FF-ABC123
   */
  getShortLinkUrl(code) {
    const base = import.meta.env.VITE_API_URL || 'https://api.fasofree.site';
    return `${base.replace(/\/api\/v1$/, '')}/r/${code}`;
  },
};

export default affiliateService;