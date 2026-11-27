/**
 * Copyright (c) 2026 BIDIGA Imrane - Koliwa. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

/**
 * Koliwa Coursier — session du livreur.
 *
 * Le rôle est TOUJOURS revalidé auprès du serveur au démarrage (`/users/me`) :
 * un rôle présent dans localStorage ne prouve rien, il peut être périmé ou
 * bricolé à la main.
 */
import { create } from 'zustand';
import api, { TOKEN_KEY, USER_KEY } from '../services/api';
import { disconnectDispatch } from '../services/realtime';

const COURSIER_ROLES = ['driver', 'courier', 'livreur'];

const persist = (token, user) => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

const clearStorage = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

const readInitial = () => {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const raw = localStorage.getItem(USER_KEY);
    if (token && raw) {
      return { token, user: JSON.parse(raw), isHydrated: false };
    }
  } catch {
    clearStorage();
  }
  return { token: null, user: null, isHydrated: true };
};

export const isCourierRole = (role) => COURSIER_ROLES.includes(String(role || '').toLowerCase());

export const useAuthStore = create((set, get) => ({
  ...readInitial(),
  isLoading: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.post('/auth/login', { email, password });
      const token = data.access_token || data.token;
      const user = data.user || { id: data.id, fullName: data.fullName, email, role: data.role };

      if (!isCourierRole(user?.role)) {
        throw new Error("Ce compte n'est pas un compte coursier.");
      }

      persist(token, user);
      set({ token, user, isHydrated: false, isLoading: false, error: null });
      return user;
    } catch (err) {
      set({ isLoading: false, error: err.message });
      throw err;
    }
  },

  /** Revalide la session et le rôle auprès du serveur. */
  refreshProfile: async () => {
    if (!get().token) {
      set({ isHydrated: true });
      return null;
    }
    try {
      const { data } = await api.get('/users/me');
      if (!isCourierRole(data?.role)) {
        get().logout();
        return null;
      }
      persist(get().token, data);
      set({ user: data, isHydrated: true });
      return data;
    } catch {
      set({ isHydrated: true });
      return null;
    }
  },

  updateAvailability: (userId, available) => {
    const { token, user } = get();
    if (!token || !user || user.id !== userId) return;
    const updated = { ...user, isOnline: available, isAvailable: available };
    persist(token, updated);
    set({ user: updated });
  },

  logout: () => {
    clearStorage();
    disconnectDispatch();
    set({ token: null, user: null, isHydrated: true, error: null });
  },

  clearError: () => set({ error: null }),
}));

export default useAuthStore;
