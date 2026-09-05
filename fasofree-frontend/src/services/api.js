/**
 * FasoFree — Client Axios centralisé
 * Toutes les requêtes passent par ce client.
 * Le JWT est automatiquement injecté depuis localStorage.
 */
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'https://api.fasofree.site/api/v1';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─── Intercepteur REQUEST : injecter le JWT ───────────────────────────────
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('fasofree_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Intercepteur RESPONSE : gérer les erreurs globalement ───────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const { status } = error.response;

      // Token expiré ou invalide → déconnexion automatique
      if (status === 401) {
        localStorage.removeItem('fasofree_token');
        localStorage.removeItem('fasofree_user');
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
      }

      // Reponse vide ou non-JSON
      const data = error.response.data;
      const message =
        (typeof data === 'object' && data !== null ? (data.message || data.error) : null) ||
        `Erreur ${status}`;
      return Promise.reject(new Error(Array.isArray(message) ? message.join(', ') : message));
    }

    if (error.code === 'ECONNABORTED') {
      return Promise.reject(new Error('Délai de connexion dépassé.'));
    }

    return Promise.reject(new Error('Impossible de contacter le serveur.'));
  }
);

export default api;
