import { create } from 'zustand';
import { login as apiLogin, register as apiRegister, getMe } from '../services/authService';
import { UserRole } from '../types/roles';

const TOKEN_KEY = 'fasofree_token';
const USER_KEY = 'fasofree_user';

const persistToken = (token) => localStorage.setItem(TOKEN_KEY, token);
const persistUser = (user) => localStorage.setItem(USER_KEY, JSON.stringify(user));

const clearStorage = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

const getInitialState = () => {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const userRaw = localStorage.getItem(USER_KEY);
    if (token && userRaw) {
      const user = JSON.parse(userRaw);
      return { token, user, isAuthenticated: true };
    }
  } catch (e) {
    clearStorage();
  }
  return { token: null, user: null, isAuthenticated: false };
};

// EXPORT NOMMÉ ET EXPORT PAR DÉFAUT (Règle le problème d'importation définitivement)
export const useAuthStore = create((set, get) => ({
  ...getInitialState(),
  isLoading: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const data = await apiLogin(email, password);
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

  register: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const result = await apiRegister(data);
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

  refreshProfile: async () => {
    try {
      const user = await getMe();
      persistUser(user);
      set({ user });
      return user;
    } catch {
      get().logout();
    }
  },

  logout: () => {
    clearStorage();
    set({ token: null, user: null, isAuthenticated: false, error: null });
  },

  clearError: () => set({ error: null }),

  updateUser: (userData) =>
    set((state) => {
      const updated = { ...state.user, ...userData };
      persistUser(updated);
      return { user: updated };
    }),

  getRole: () => get().user?.role || null,
  
  // Get normalized role for consistent routing
  getNormalizedRole: () => {
    const role = get().user?.role;
    if (!role) return null;
    return String(role).toLowerCase().replace('-', '_');
  },
  
  // Determine dashboard route based on role
  getDashboardRoute: () => {
    const normalizedRole = get().getNormalizedRole();
    const roleRoutes = {
      'super_admin': '/admin/super',
      'superadmin': '/admin/super',
      'admin': '/admin/manager',
      'support': '/admin/support',
      'business_admin': '/designer',
      'business': '/designer',
      'merchant': '/designer',
      'restaurant': '/designer',
      'driver': '/livreur',
      'courier': '/livreur',
      'livreur': '/livreur',
    };
    return roleRoutes[normalizedRole] || '/login';
  },
  
  isBusinessAdmin: () => {
    const role = get().user?.role;
    return role === UserRole.BUSINESS_ADMIN || role === UserRole.SUPER_ADMIN;
  },
  isDriver: () => {
    const role = get().user?.role;
    return role === UserRole.DRIVER || role === UserRole.COURIER;
  },
  isSuperAdmin: () => get().user?.role === UserRole.SUPER_ADMIN,
  isAdmin: () => {
    const role = get().user?.role;
    return role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN;
  },
  isClient: () => {
    const role = get().user?.role;
    return role === UserRole.CLIENT || role === UserRole.CUSTOMER;
  },
}));

export default useAuthStore;