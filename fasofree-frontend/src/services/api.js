/**
 * Copyright (c) 2026 BIDIGA Imrane - Koliwa. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

/**
 * Koliwa Coursier — client HTTP centralisé.
 * Le JWT est relu depuis localStorage à chaque requête (jamais mis en cache),
 * et un 401 déconnecte proprement au lieu de laisser l'écran tourner à vide.
 */
import axios from 'axios';

const RAW_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3100/api/v1';

export const API_BASE = RAW_BASE.replace(/\/+$/, '');

/** Origine du serveur, nécessaire pour ouvrir le namespace socket `/dispatch`. */
export const SOCKET_BASE = (() => {
  try {
    return new URL(API_BASE).origin;
  } catch {
    return 'http://localhost:3100';
  }
})();

export const TOKEN_KEY = 'koliwa_courier_token';
export const USER_KEY = 'koliwa_courier_user';

const api = axios.create({ baseURL: API_BASE, timeout: 30000 });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      if (!window.location.pathname.startsWith('/login')) {
        window.location.assign('/login');
      }
    }

    const data = error.response?.data;
    const raw = data && (data.message ?? data.error);
    const message = Array.isArray(raw) ? raw.join(', ') : raw;

    if (!error.response) {
      return Promise.reject(new Error('Réseau indisponible. Réessayez.'));
    }
    return Promise.reject(new Error(message || `Erreur ${error.response.status}`));
  },
);

export default api;
