import React, { useEffect, useRef } from 'react';
import { Bell, Check, CheckCheck, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import useNotificationStore from '../store/notificationStore';

const TYPE_LABELS = {
  ORDER_UPDATE: { label: 'Commande', color: 'text-accent-primary' },
  DELIVERY: { label: 'Livraison', color: 'text-status-success' },
  PROMOTION: { label: 'Promo', color: 'text-purple-500' },
  ACCOUNT: { label: 'Compte', color: 'text-status-warning' },
  SYSTEM: { label: 'Système', color: 'text-text-tertiary' },
};

export default function NotificationDropdown({ open, onClose }) {
  const navigate = useNavigate();
  const { items, unreadCount, loading, fetch: fetchNotifs, markAsRead, markAllAsRead } = useNotificationStore();
  const panelRef = useRef(null);

  useEffect(() => {
    if (open) fetchNotifs();
  }, [open, fetchNotifs]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const handleNotifClick = (notif) => {
    if (!notif.isRead) markAsRead(notif.id);
    if (notif.actionUrl) {
      navigate(notif.actionUrl);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end items-start pt-16 px-4" onClick={onClose}>
      <div
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-background-card border border-border-light rounded-xl shadow-2xl overflow-hidden fade-in"
      >
        {/* Header */}
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
              onClick={onClose}
              className="p-1.5 hover:bg-background-secondary rounded-lg transition-colors"
            >
              <X size={14} className="text-text-tertiary" />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="max-h-80 overflow-y-auto">
          {loading && items.length === 0 ? (
            <div className="p-6 space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 bg-background-secondary rounded-lg animate-pulse" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center">
              <Bell size={32} className="mx-auto text-text-tertiary mb-2" strokeWidth={1} />
              <p className="text-xs text-text-secondary">Aucune notification</p>
            </div>
          ) : (
            items.map((n) => {
              const meta = TYPE_LABELS[n.type] || TYPE_LABELS.SYSTEM;
              return (
                <button
                  key={n.id}
                  onClick={() => handleNotifClick(n)}
                  className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-background-secondary transition-colors ${
                    !n.isRead ? 'bg-accent-primary/5' : ''
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {!n.isRead ? (
                      <span className="block w-2 h-2 rounded-full bg-accent-primary" />
                    ) : (
                      <Check size={12} className="text-text-tertiary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-[10px] font-semibold ${meta.color}`}>{meta.label}</span>
                      <span className="text-[10px] text-text-tertiary">
                        {new Date(n.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
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
    </div>
  );
}
