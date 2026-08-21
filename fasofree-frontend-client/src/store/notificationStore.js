import { create } from 'zustand';
import { apiFetch } from '../services/api';

const useNotificationStore = create((set, get) => ({
  items: [],
  unreadCount: 0,
  loading: false,
  loaded: false,

  fetch: async () => {
    set({ loading: true });
    try {
      const data = await apiFetch('/notifications?limit=30');
      set({
        items: data.items || [],
        unreadCount: data.unreadCount || 0,
        loaded: true,
      });
    } catch {
      // silent — keep empty
    } finally {
      set({ loading: false });
    }
  },

  markAsRead: async (id) => {
    // Optimistic: mark locally first
    set((s) => ({
      items: s.items.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      unreadCount: Math.max(0, s.unreadCount - 1),
    }));
    try {
      await apiFetch(`/notifications/${id}/read`, { method: 'PATCH' });
    } catch {
      // rollback
      set((s) => ({
        items: s.items.map((n) => (n.id === id ? { ...n, isRead: false } : n)),
        unreadCount: s.unreadCount + 1,
      }));
    }
  },

  markAllAsRead: async () => {
    set((s) => ({
      items: s.items.map((n) => ({ ...n, isRead: true })),
      unreadCount: 0,
    }));
    try {
      await apiFetch('/notifications/read-all', { method: 'PATCH' });
    } catch {
      get().fetch(); // full reload on failure
    }
  },

  incrementUnread: () => set((s) => ({ unreadCount: s.unreadCount + 1 })),
}));

export default useNotificationStore;
