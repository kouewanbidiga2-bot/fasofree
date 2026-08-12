/**
 * FasoFree — Client Axios centralisé
 * Toutes les requêtes passent par ce client.
 * Le JWT est automatiquement injecté depuis localStorage.
 */
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
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
        // Redirection vers login si pas déjà dessus
        if (!window.location.pathname.includes('/auth')) {
          window.location.href = '/auth';
        }
      }

      // Formater le message d'erreur proprement
      const message =
        error.response.data?.message ||
        error.response.data?.error ||
        `Erreur ${status}`;
      return Promise.reject(new Error(Array.isArray(message) ? message.join(', ') : message));
    }

    if (error.code === 'ECONNABORTED') {
      return Promise.reject(new Error('Délai de connexion dépassé. Vérifiez votre réseau.'));
    }

    return Promise.reject(new Error('Impossible de contacter le serveur. Réessayez.'));
  }
);

export default api;
