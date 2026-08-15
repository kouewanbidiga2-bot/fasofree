/**
 * FasoFree — Service de gestion des litiges
 * Endpoints: /disputes
 */
import api from './api';

/**
 * Obtenir tous les litiges (optionnellement filtrés par statut)
 * @param {string} status - Statut du litige (OPEN, UNDER_INVESTIGATION, PENDING_ADMIN_APPROVAL, APPROVED, REJECTED)
 * @returns {Promise<Array>} Liste des litiges
 */
export const getDisputes = async (status) => {
  const params = status ? { status } : {};
  const response = await api.get('/disputes', { params });
  return response.data;
};

/**
 * Obtenir un litige spécifique pour un client
 * @param {string} disputeId - ID du litige
 * @returns {Promise<object>} Détails du litige
 */
export const getDisputeById = async (disputeId) => {
  const response = await api.get(`/disputes/me/${disputeId}`);
  return response.data;
};

/**
 * Créer un nouveau litige pour une commande
 * @param {string} orderId - ID de la commande
 * @param {object} data - Données du litige (reason, attachments)
 * @returns {Promise<object>} Litige créé
 */
export const createDispute = async (orderId, data) => {
  const response = await api.post(`/disputes/orders/${orderId}`, data);
  return response.data;
};

/**
 * Assigner un litige à un agent support
 * @param {string} disputeId - ID du litige
 * @param {string} note - Note de l'agent (optionnel)
 * @returns {Promise<object>} Litige assigné
 */
export const assignToSupport = async (disputeId, note) => {
  const response = await api.post(`/disputes/${disputeId}/assign-support`, { note });
  return response.data;
};

/**
 * Soumettre une recommandation de remboursement
 * @param {string} disputeId - ID du litige
 * @param {string} resolution - REFUND ou REJECT
 * @param {number} refundAmount - Montant du remboursement (optionnel)
 * @param {string} note - Note de l'agent (optionnel)
 * @returns {Promise<object>} Litige mis à jour
 */
export const submitRecommendation = async (disputeId, resolution, refundAmount, note) => {
  const response = await api.post(`/disputes/${disputeId}/submit-recommendation`, {
    resolution,
    refundAmount,
    note,
  });
  return response.data;
};

/**
 * Approuver et exécuter le remboursement (Admin uniquement)
 * @param {string} disputeId - ID du litige
 * @param {string} note - Note de l'admin (optionnel)
 * @returns {Promise<object>} Litige approuvé et remboursé
 */
export const approveRefund = async (disputeId, note) => {
  const response = await api.post(`/disputes/${disputeId}/approve`, { note });
  return response.data;
};

/**
 * Rejeter un litige (Admin uniquement)
 * @param {string} disputeId - ID du litige
 * @param {string} note - Note de l'admin (optionnel)
 * @returns {Promise<object>} Litige rejeté
 */
export const rejectDispute = async (disputeId, note) => {
  const response = await api.post(`/disputes/${disputeId}/reject`, { note });
  return response.data;
};

/**
 * Réviser un litige (méthode dépréciée - utiliser approve/reject)
 * @param {string} disputeId - ID du litige
 * @param {object} data - Données de révision (resolution, note, refundAmount)
 * @returns {Promise<object>} Litige mis à jour
 */
export const reviewDispute = async (disputeId, data) => {
  const response = await api.post(`/disputes/${disputeId}/review`, data);
  return response.data;
};
