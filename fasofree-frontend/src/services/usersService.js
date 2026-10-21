/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import api from './api';

export const getUsers = async (params = {}) => {
  const response = await api.get('/users', { params });
  return response.data;
};

export const createUser = async (data) => {
  const response = await api.post('/users', data);
  return response.data;
};

export const updateUserStatus = async (id, isActive, banReason) => {
  const response = await api.patch(`/users/${id}/status`, { isActive, banReason });
  return response.data;
};

export const updateUserRole = async (id, role) => {
  const response = await api.patch(`/users/${id}/role`, { role });
  return response.data;
};

export const deleteUser = async (id) => {
  const response = await api.delete(`/users/${id}`);
  return response.data;
};

// ─── Ban Requests ──────────────────────────────────────────────
export const getPlatformStats = async () => {
  const response = await api.get('/users/platform-stats');
  return response.data;
};

export const getBanRequests = async (status) => {
  const params = status ? { status } : {};
  const response = await api.get('/ban-requests', { params });
  return response.data;
};

export const createBanRequest = async (data) => {
  const response = await api.post('/ban-requests', data);
  return response.data;
};

export const reviewBanRequest = async (id, data) => {
  const response = await api.post(`/ban-requests/${id}/review`, data);
  return response.data;
};

/**
 * Nombre de demandes de bannissement en attente (badge).
 *
 * ⚠️ Endpoint réservé au SUPER_ADMIN côté backend (`@Roles(SUPER_ADMIN)`).
 * Pour ADMIN / SUPPORT la réponse est 403 : on renvoie `null` — et non `0` —
 * afin de distinguer « aucune demande » de « compteur indisponible » et
 * d'éviter d'afficher un badge trompeur. Ne lève jamais d'exception.
 *
 * @returns {Promise<number|null>}
 */
export const getBanRequestPendingCount = async () => {
  try {
    const response = await api.get('/ban-requests/pending-count');
    const data = response.data;
    if (typeof data === 'number') return data;
    if (data && typeof data.count === 'number') return data.count;
    return null;
  } catch {
    return null;
  }
};

// ─── Chat (Admin/Support) ──────────────────────────────────────
export const getActiveConversations = async () => {
  const response = await api.get('/chat');
  return response.data;
};

export const getChatHistory = async (orderId, channel) => {
  const params = channel ? { channel } : {};
  const response = await api.get(`/chat/${orderId}`, { params });
  return response.data;
};
