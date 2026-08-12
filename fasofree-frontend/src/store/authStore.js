/**
 * FasoFree — Auth Store (Zustand)
 * Gestion complète de l'authentification avec JWT réel
 * Persistance dans localStorage
 */
import { create } from 'zustand';
import { login as apiLogin, register as apiRegister, getMe } from '../services/authService';

// ─── Clés localStorage ──────────────────────────────────────────────────
const TOKEN_KEY = 'fasofree_token';
const USER_KEY = 'fasofree_user';

// ─── Helpers persistance ────────────────────────────────────────────────
const persistToken = (token) => localStorage.setItem(TOKEN_KEY, token);
const persistUser = (user) => localStorage.setItem(USER_KEY, JSON.stringify(user));
const clearStorage = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

// ─── Hydratation initiale depuis localStorage ────────────────────────────
const getInitialState = () => {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const userRaw = localStorage.getItem(USER_KEY);
    if (token && userRaw) {
      const user = JSON.parse(userRaw);
      return { token, user, isAuthenticated: true };
    }
  } catch {
    clearStorage();
  }
  return { token: null, user: null, isAuthenticated: false };
};

const useAuthStore = create((set, get) => ({
  // ─── State ──────────────────────────────────────────────────────────
  ...getInitialState(),
  isLoading: false,
  error: null,

  // ─── Actions ────────────────────────────────────────────────────────

  /**
   * Connexion avec email + password
   * @param {string} email
   * @param {string} password
   * @returns {Promise<object>} User avec son rôle
   */
  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const data = await apiLogin(email, password);
      // Le backend renvoie { access_token, user } ou { access_token, ...userFields }
      const token = data.access_token || data.token;
      const user = data.user || {
        id: data.id,
        fullName: data.fullName,
        email: data.email,
        phone: data.phone,
        role: data.role,
      };

      persistToken(token);
      persistUser(user);
      set({ token, user, isAuthenticated: true, isLoading: false, error: null });
      return user;
    } catch (err) {
      set({ isLoading: false, error: err.message });
      throw err;
    }
  },

  /**
   * Inscription
   * @param {Object} data - { fullName, email, phone, password, role }
   * @returns {Promise<object>}
   */
  register: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const result = await apiRegister(data);
      // Après inscription, on peut auto-login ou demander une connexion
      // Ici on stocke si le backend renvoie un token
      if (result.access_token) {
        const token = result.access_token;
        const user = result.user || { ...data, id: result.id };
        persistToken(token);
        persistUser(user);
        set({ token, user, isAuthenticated: true, isLoading: false, error: null });
        return user;
      }
      set({ isLoading: false });
      return result;
    } catch (err) {
      set({ isLoading: false, error: err.message });
      throw err;
    }
  },

  /**
   * Rafraîchir le profil depuis le backend
   */
  refreshProfile: async () => {
    try {
      const user = await getMe();
      persistUser(user);
      set({ user });
      return user;
    } catch {
      // Si ça échoue (token invalide), on déconnecte
      get().logout();
    }
  },

  /**
   * Déconnexion
   */
  logout: () => {
    clearStorage();
    set({ token: null, user: null, isAuthenticated: false, error: null });
  },

  /**
   * Effacer les erreurs
   */
  clearError: () => set({ error: null }),

  /**
   * Mettre à jour les données utilisateur localement
   */
  updateUser: (userData) =>
    set((state) => {
      const updated = { ...state.user, ...userData };
      persistUser(updated);
      return { user: updated };
    }),

  // ─── Getters dérivés ────────────────────────────────────────────────
  get role() {
    return get().user?.role || null;
  },
  get isBusinessAdmin() {
    const role = get().user?.role;
    return role === 'business_admin' || role === 'super_admin';
  },
  get isDriver() {
    return get().user?.role === 'driver';
  },
  get isSuperAdmin() {
    return get().user?.role === 'super_admin';
  },
}));

export default useAuthStore;
