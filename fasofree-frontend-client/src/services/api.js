/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { API_URL } from './apiBase';
const ASSISTANT_API_URL = (import.meta.env.VITE_ASSISTANT_API_BASE_URL || API_URL).replace(/\/+$/, '');

export async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem('access_token');

  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

  const defaultHeaders = {
    'Accept': 'application/json',
  };

  // ⚠️ Ne PAS forcer Content-Type pour un FormData (multipart) :
  // le navigateur pose automatiquement la bonne boundary.
  if (!isFormData) {
    defaultHeaders['Content-Type'] = 'application/json';
  }

  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  // Stringify body if it's an object (mais jamais un FormData)
  if (!isFormData && config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }

  try {
    const response = await fetch(`${API_URL}${endpoint}`, config);
    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = {};
    }

    if (!response.ok) {
      if (response.status === 401) {
        // Ne rebondir vers /auth que si c'était une session réelle (token +
        // profil présents). Un 401 anonyme (ex. endpoint protégé appelé depuis
        // une page publique) ne doit pas éjecter un visiteur : il doit pouvoir
        // continuer à consulter.
        const wasAuthenticated = !!localStorage.getItem('access_token') && !!localStorage.getItem('fasofree_user');
        localStorage.removeItem('access_token');
        localStorage.removeItem('fasofree_user');
        if (wasAuthenticated && !window.location.pathname.includes('/auth')) {
          const { toast } = await import('sonner');
          toast.error('Session expirée. Veuillez vous reconnecter.');
          window.location.href = '/auth';
        }
      }
      const message = Array.isArray(data?.message) ? data.message.join(' ') : data?.message;
      const error = new Error(message || 'Une erreur est survenue');
      error.status = response.status;
      throw error;
    }

    return data;
  } catch (error) {
    if (error instanceof TypeError) {
      const unavailable = new Error('Impossible de joindre le service. Réessayez dans un instant.', { cause: error });
      unavailable.code = 'NETWORK_ERROR';
      throw unavailable;
    }
    if (error?.name !== 'AbortError') console.error(`[API Error] on ${endpoint}:`, error);
    throw error;
  }
}

export const api = {
  // Auth
  register: (data) => apiFetch('/auth/register', { method: 'POST', body: data }),
  // Le backend accepte l'identifiant dans `email` : il détecte lui-même si
  // c'est un numéro de téléphone (regex) et bascule sur la recherche par phone.
  login: (phoneOrEmail, password) => apiFetch('/auth/login', { method: 'POST', body: { email: phoneOrEmail, password } }),
  getProfile: () => apiFetch('/users/me', { method: 'GET' }),
  updateProfile: (data) => apiFetch('/users/me', { method: 'PATCH', body: data }),
  updatePaymentInfo: (data) => apiFetch('/users/me/payment-info', { method: 'PATCH', body: data }),
  forgotPassword: (email) => apiFetch('/auth/forgot-password', { method: 'POST', body: { email } }),
  resetPassword: (token, newPassword) => apiFetch('/auth/reset-password', { method: 'POST', body: { token, newPassword } }),
  changePassword: (currentPassword, newPassword) => apiFetch('/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } }),
  deleteAccount: () => apiFetch('/users/me', { method: 'DELETE' }),
  exportData: () => apiFetch('/users/me/export', { method: 'GET' }),

  // ⚖️ Documents légaux (servis par le backend — la DB est la source de vérité)
  getLegalDocuments: () => apiFetch('/legal/documents', { method: 'GET' }),
  getLegalDocument: (docCode) => apiFetch(`/legal/documents/${encodeURIComponent(docCode)}`, { method: 'GET' }),

  // OTP Verification
  sendOtp: () => apiFetch('/auth/send-otp', { method: 'POST' }),
  verifyOtp: (code) => apiFetch('/auth/verify-otp', { method: 'POST', body: { code } }),
  checkVerification: () => apiFetch('/auth/check-verification', { method: 'POST' }),

  // Candidature Marchand / Livreur (multipart, avec fichiers KYC)
  apply: (formData) => apiFetch('/auth/apply', { method: 'POST', body: formData }),
  
  // Orders
  createOrder: (orderData) => apiFetch('/orders', { method: 'POST', body: orderData }),
  quoteOrder: (quoteData) => apiFetch('/orders/quote', { method: 'POST', body: quoteData }),
  getMyOrders: (status) =>
    apiFetch(
      `/orders/my-orders${status ? `?status=${encodeURIComponent(status)}` : ''}`,
      { method: 'GET' },
    ),
  getAvailableOrders: () => apiFetch('/dispatch/available', { method: 'GET' }),
  getOrder: (orderId) => apiFetch(`/orders/${orderId}`, { method: 'GET' }),
  getOrderTracking: (orderId) => apiFetch(`/orders/${orderId}/tracking`, { method: 'GET' }),
  createGuestDelivery: (data) => apiFetch('/public-tracking/guest-delivery', { method: 'POST', body: data }),
  resendPublicReceiptCode: (token) => apiFetch(`/public-tracking/${encodeURIComponent(token)}/receipt-code`, { method: 'POST' }),
  getPublicTracking: (token, signal) => apiFetch(`/public-tracking/${encodeURIComponent(token)}`, { method: 'GET', signal }),
  getActiveTrackingByReference: (reference, signal) => apiFetch('/public-tracking/lookup', { method: 'POST', body: { reference }, signal }),
  confirmPublicTracking: (token, pinCode) => apiFetch(`/public-tracking/${encodeURIComponent(token)}/confirm`, { method: 'POST', body: { pinCode } }),
  updateOrderStatus: (id, status) => apiFetch(`/orders/${id}/status`, { method: 'PATCH', body: { status } }),
  acceptOrder: (id) => apiFetch(`/orders/${id}/accept`, { method: 'POST' }),
  driverValidateDelivery: (id) => apiFetch(`/orders/${id}/driver-validate`, { method: 'POST' }),
  clientValidateWithPin: (id, pinCode) => apiFetch(`/orders/${id}/client-validate`, { method: 'POST', body: { pinCode } }),
  updateDriverStatus: (data) => apiFetch('/users/me/driver-status', { method: 'PATCH', body: data }),

  // Paiement
  initiatePayment: (data) => apiFetch('/payments/initiate', { method: 'POST', body: data }),
  // Statut RÉEL du paiement : le serveur interroge l'agrégateur et confirme
  // la commande si le webhook n'est pas encore arrivé (retour de checkout).
  reconcilePayment: (orderId) => apiFetch(`/payments/status/${orderId}`, { method: 'GET' }),

  // Chat éphémère
  getChatHistory: (orderId, channel = 'driver') => apiFetch(`/chat/${orderId}?channel=${channel}`, { method: 'GET' }),
  
  // Disputes
  openDispute: (orderId, data) => apiFetch(`/disputes/orders/${orderId}`, { method: 'POST', body: data }),

  // FasoFree Pass VIP (abonnements)
  getPlans: (subjectType) =>
    apiFetch(`/subscriptions/plans${subjectType ? `?subjectType=${subjectType}` : ''}`, { method: 'GET' }),
  getVipStatus: () => apiFetch('/subscriptions/me', { method: 'GET' }),
  subscribeVip: (planCode = 'VIP', autoRenew = true) =>
    apiFetch('/subscriptions/subscribe', { method: 'POST', body: { planCode, autoRenew } }),

  // Portefeuille FasoFree
  getWallet: (userId) => apiFetch(`/wallets/CUSTOMER/${userId}`, { method: 'GET' }),
  topupWallet: (data) => apiFetch('/payments/topup', { method: 'POST', body: data }),

  // KYC
  uploadKycDocument: (type, formData) => apiFetch(`/kyc/documents/${type}`, { method: 'POST', body: formData }),
  getMyKyc: () => apiFetch('/kyc/me', { method: 'GET' }),
  getKycDocumentUrl: (id) => apiFetch(`/kyc/documents/${id}/url`, { method: 'GET' }),

  // Reviews
  submitReview: (data) => apiFetch('/reviews', { method: 'POST', body: data }),
  getTargetReviews: (targetId) => apiFetch(`/reviews/target/${targetId}`, { method: 'GET' }),
  getTargetAverage: (targetId) => apiFetch(`/reviews/target/${targetId}/average`, { method: 'GET' }),
  getOrderReview: (orderId) => apiFetch(`/reviews/order/${orderId}`, { method: 'GET' }),

  // Disputes
  getMyDispute: (id) => apiFetch(`/disputes/me/${id}`, { method: 'GET' }),
  getMyDisputes: () => apiFetch('/disputes/me', { method: 'GET' }),
  getEligibleDisputeOrders: () =>
    apiFetch('/disputes/eligible-orders', { method: 'GET' }),

  // Chat support des litiges (client ↔ support / administration)
  getDispute: (id) => apiFetch(`/disputes/${id}`, { method: 'GET' }),
  getDisputeMessages: (id) =>
    apiFetch(`/disputes/${id}/messages`, { method: 'GET' }),
  sendDisputeMessage: (id, message) =>
    apiFetch(`/disputes/${id}/messages`, { method: 'POST', body: { message } }),

  // Promotions
  getPromotionQuote: (data) => apiFetch(`/promotions/quote?code=${encodeURIComponent(data.code)}&amount=${data.amount || 0}`, { method: 'GET' }),

  // Subscriptions marchand
  subscribeMerchant: (businessId, planCode = 'PRO', autoRenew = true) =>
    apiFetch('/subscriptions/merchant/subscribe', { method: 'POST', body: { businessId, planCode, autoRenew } }),

  // Orders (updateOrderStatus declared above)
  cancelOrder: (id, reason) => apiFetch(`/orders/${id}/status`, { method: 'PATCH', body: { status: 'CANCELLED', reason } }),
  disputeOrder: (id, data) => apiFetch(`/disputes/orders/${id}`, { method: 'POST', body: data }),

  // Notifications
  registerFcmToken: (token) => apiFetch('/notifications/fcm-token', { method: 'POST', body: { fcmToken: token } }),

  // OTP Verification
  getMe: () => apiFetch('/auth/me', { method: 'GET' }),

  // Stories
  getStories: () => apiFetch('/stories', { method: 'GET' }),
  createStory: (data) => apiFetch('/stories', { method: 'POST', body: data }),
  viewStory: (storyId) => apiFetch(`/stories/${storyId}/view`, { method: 'POST' }),
  likeStory: (storyId) => apiFetch(`/stories/${storyId}/like`, { method: 'POST' }),
  unlikeStory: (storyId) => apiFetch(`/stories/${storyId}/like`, { method: 'DELETE' }),
  getStoryViewers: (storyId) => apiFetch(`/stories/${storyId}/viewers`, { method: 'GET' }),
  deleteStory: (storyId) => apiFetch(`/stories/${storyId}`, { method: 'DELETE' }),

  // Loyalty
  getLoyaltyPoints: () => apiFetch('/loyalty/me', { method: 'GET' }),
  getLoyaltyHistory: () => apiFetch('/loyalty/me/history', { method: 'GET' }),
  getReferralCode: () => apiFetch('/loyalty/referral/code', { method: 'GET' }),
  getReferralStats: () => apiFetch('/loyalty/referral/stats', { method: 'GET' }),
  applyReferralCode: (code) => apiFetch('/loyalty/referral/apply', { method: 'POST', body: { code } }),

  // Upload (image directe) — ✅ FIX #22 : vérifier response.ok
  uploadImage: (formData, folder = 'stories') => {
    const token = localStorage.getItem('access_token');
    // Allow-list côté client : le dossier ne doit contenir que des caractères
    // sûrs (évite l'injection dans la query string). Le backend re-valide.
    const safeFolder = /^[a-zA-Z0-9_-]+$/.test(String(folder || '')) ? folder : 'stories';
    return fetch(`${API_URL}/uploads/image?folder=${encodeURIComponent(safeFolder)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    }).then((r) => {
      if (!r.ok) throw new Error(`Upload échoué (${r.status})`);
      return r.json();
    });
  },

  // Avatar de profil
  uploadAvatar: (formData) => {
    const token = localStorage.getItem('access_token');
    return fetch(`${API_URL}/users/me/avatar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    }).then(async (r) => {
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.message || `Upload échoué (${r.status})`);
      return data;
    });
  },

  // Adresses de livraison
  getAddresses: () => apiFetch('/users/me/addresses', { method: 'GET' }),
  createAddress: (data) => apiFetch('/users/me/addresses', { method: 'POST', body: data }),
  updateAddress: (id, data) => apiFetch(`/users/me/addresses/${id}`, { method: 'PATCH', body: data }),
  deleteAddress: (id) => apiFetch(`/users/me/addresses/${id}`, { method: 'DELETE' }),

  // Le guide est public : aucun jeton de session ne part vers cette URL.
  async askAssistant(question, signal) {
    const response = await fetch(`${ASSISTANT_API_URL}/assistant/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ question }),
      signal,
    });
    if (!response.ok) throw new Error('Assistant indisponible');
    return response.json();
  },

  // Action structurée pour les demandes formulées à l'oral
  voiceAction: (question) =>
    apiFetch('/assistant/voice-action', { method: 'POST', body: { question } }),
};

export default api;
