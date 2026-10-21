/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Bell, Check, CheckCheck, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import useNotificationStore from '../store/notificationStore';

const TYPE_LABELS = {
  ORDER_UPDATE: { label: 'Commande', color: 'text-accent-primary' },
  DELIVERY: { label: 'Livraison', color: 'text-status-success' },
  PROMOTION: { label: 'Promo', color: 'text-purple-400' },
  ACCOUNT: { label: 'Compte', color: 'text-status-warning' },
  SYSTEM: { label: 'Système', color: 'text-text-tertiary' },
};

/**
 * Cloche + panneau des notifications in-app (back-office).
 * Les notifications admin / super_admin / support sont créées côté backend
 * via `NotificationStoreService` (ex. POST /notifications/broadcast) puis
 * lues ici via GET /notifications.
 */
export default function NotificationBell({ className = '' }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const {
    items,
    unreadCount,
    loading,
    fetch: fetchNotifs,
    markAsRead,
    markAllAsRead,
  } = useNotificationStore();
  const panelRef = useRef(null);
  const btnRef = useRef(null);

  // Chargement initial + rafraîchissement périodique du compteur non-lu.
  useEffect(() => {
    fetchNotifs();
    const timer = setInterval(fetchNotifs, 60000);
    return () => clearInterval(timer);
  }, [fetchNotifs]);

  // Fermeture au clic extérieur + refresh à l'ouverture.
  useEffect(() => {
    if (!open) return;
    fetchNotifs();
    const handler = (e) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target) &&
        btnRef.current &&
        !btnRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, fetchNotifs]);

  const handleNotifClick = (notif) => {
    if (!notif.isRead) markAsRead(notif.id);
    if (notif.actionUrl) {
      try {
        navigate(notif.actionUrl);
      } catch {
        // actionUrl hors périmètre de l'admin : on ignore.
      }
    }
    setOpen(false);
  };

  return (
    <div className={`relative ${className}`}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg hover:bg-background-secondary transition-colors"
        aria-label="Notifications"
      >
        <Bell size={18} className="text-text-secondary" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-accent-primary text-white text-[9px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-background-card border border-border-light rounded-xl shadow-card overflow-hidden z-50"
        >
          {/* En-tête */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-light">
            <div className="flex items-center gap-2">
              <Bell size={16} className="text-accent-primary" />
              <span className="text-sm font-bold text-text-primary">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-accent-primary text-white text-[10px] font-bold">
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="p-1.5 hover:bg-background-secondary rounded-lg transition-colors"
                  title="Tout marquer comme lu"
                >
                  <CheckCheck size={14} className="text-accent-primary" />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 hover:bg-background-secondary rounded-lg transition-colors"
                aria-label="Fermer"
              >
                <X size={14} className="text-text-tertiary" />
              </button>
            </div>
          </div>

          {/* Liste */}
          <div className="max-h-80 overflow-y-auto">
            {loading && items.length === 0 ? (
              <div className="p-6 space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 bg-background-secondary rounded-lg animate-pulse" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="p-6 text-center">
                <Bell size={28} className="mx-auto text-text-tertiary mb-2" strokeWidth={1} />
                <p className="text-xs text-text-tertiary">Aucune notification</p>
              </div>
            ) : (
              items.map((n) => {
                const meta = TYPE_LABELS[n.type] || TYPE_LABELS.SYSTEM;
                return (
                  <button
                    key={n.id}
                    onClick={() => handleNotifClick(n)}
                    className={`w-full text-left px-4 py-3 flex gap-3 border-b border-border-light/60 last:border-b-0 hover:bg-background-secondary transition-colors ${
                      !n.isRead ? 'bg-accent-primary/5' : ''
                    }`}
                  >
                    <div className="pt-0.5">
                      {n.isRead ? (
                        <Check size={12} className="text-text-tertiary" />
                      ) : (
                        <span className="block w-2 h-2 rounded-full bg-accent-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-[10px] font-semibold ${meta.color}`}>{meta.label}</span>
                        <span className="text-[10px] text-text-tertiary">
                          {new Date(n.createdAt).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-text-primary truncate">{n.title}</p>
                      <p className="text-[11px] text-text-secondary truncate">{n.body}</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
