/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { create } from 'zustand';
import api from '../services/api';

/**
 * Store des notifications in-app du back-office.
 * Miroir de `fasofree-frontend-client/src/store/notificationStore.js`
 * mais branché sur le client axios de l'admin.
 */
const useNotificationStore = create((set, get) => ({
  items: [],
  unreadCount: 0,
  loading: false,
  loaded: false,

  fetch: async () => {
    set({ loading: true });
    try {
      const { data } = await api.get('/notifications?limit=30');
      set({
        items: data.items || [],
        unreadCount: data.unreadCount || 0,
        loaded: true,
      });
    } catch {
      // Silencieux : une erreur de chargement ne doit pas casser le dashboard.
    } finally {
      set({ loading: false });
    }
  },

  markAsRead: async (id) => {
    // Optimiste : on marque localement d'abord.
    set((s) => ({
      items: s.items.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      unreadCount: Math.max(0, s.unreadCount - 1),
    }));
    try {
      await api.patch(`/notifications/${id}/read`);
    } catch {
      // Rollback si l'appel échoue.
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
      await api.patch('/notifications/read-all');
    } catch {
      get().fetch(); // Rechargement complet en cas d'échec.
    }
  },

  incrementUnread: () => set((s) => ({ unreadCount: s.unreadCount + 1 })),
}));

export default useNotificationStore;
