import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ShoppingBag,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Package,
} from 'lucide-react';
import Loading from './Loading';
import { api } from '../services/api';

const STATUS_CONFIG = {
  PENDING: { label: 'En attente', bg: 'bg-warning/15', text: 'text-warning', icon: Clock },
  PAID: { label: 'Payée', bg: 'bg-info/15', text: 'text-info', icon: CheckCircle2 },
  IN_PREPARATION: { label: 'En préparation', bg: 'bg-[#B8862E]/15', text: 'text-[#B8862E]', icon: Package },
  DELIVERED: { label: 'Livrée', bg: 'bg-success/15', text: 'text-success', icon: CheckCircle2 },
  CANCELLED: { label: 'Annulée', bg: 'bg-error/15', text: 'text-error', icon: XCircle },
};

const FILTER_TABS = [
  { value: 'all', label: 'Toutes' },
  { value: 'PENDING', label: 'En attente' },
  { value: 'IN_PREPARATION', label: 'En préparation' },
  { value: 'DELIVERED', label: 'Livrées' },
];

function formatFCFA(amount) {
  return new Intl.NumberFormat('fr-BF').format(amount) + ' FCFA';
}

function relativeTime(dateStr) {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "À l'instant";
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `Il y a ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `Il y a ${diffD}j`;
  return new Date(dateStr).toLocaleDateString('fr-FR');
}

const MerchantOrders = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const business = await api.getMyBusiness();
      const data = await api.getBusinessOrders(business.id);
      setOrders(data.data || data);
      setError(null);
    } catch (err) {
      setError('Impossible de charger les commandes');
    } finally {
      setLoading(false);
    }
  };

  const handleStartPreparation = async (orderId) => {
    try {
      setUpdatingId(orderId);
      await api.updateOrderStatus(orderId, 'IN_PREPARATION');
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: 'IN_PREPARATION' } : o))
      );
    } catch {
      // silently fail
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredOrders = orders.filter((o) => filter === 'all' || o.status === filter);

  return (
    <div className="min-h-screen bg-background-primary">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background-primary border-b border-border-light">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-background-secondary transition-colors rounded-lg"
            >
              <ArrowLeft size={18} className="text-text-primary" strokeWidth={1.5} />
            </button>
            <div className="flex items-center gap-3">
              <ShoppingBag size={20} className="text-accent-primary" strokeWidth={1.5} />
              <h1 className="text-lg font-display font-bold text-text-primary">Commandes</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Filter tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                filter === tab.value
                  ? 'bg-accent-primary text-white'
                  : 'bg-background-card text-text-secondary border border-border-light hover:border-accent-primary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <Loading text="Chargement des commandes..." />
        ) : error ? (
          <div className="text-center py-16 bg-background-card rounded-xl border border-border-light">
            <p className="text-text-secondary mb-4">{error}</p>
            <button
              onClick={loadOrders}
              className="px-6 py-2 bg-accent-primary text-white rounded-lg text-sm font-medium hover:opacity-90 transition"
            >
              Réessayer
            </button>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-16 bg-background-card rounded-xl border border-border-light">
            <ShoppingBag size={48} className="mx-auto text-text-secondary/40 mb-4" strokeWidth={1} />
            <p className="text-text-secondary text-lg mb-1">
              {filter === 'all' ? 'Aucune commande' : 'Aucune commande dans cette catégorie'}
            </p>
            <p className="text-text-secondary/60 text-sm">Les commandes apparaîtront ici.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredOrders.map((order) => {
              const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.PENDING;
              const Icon = cfg.icon;
              const expanded = expandedId === order.id;
              const canPrepare = order.status === 'PENDING' || order.status === 'PAID';
              const items = order.items || order.orderItems || [];
              const itemsSummary =
                items.length > 0
                  ? items.map((it) => it.productName || it.name || 'Produit').join(', ')
                  : `${items.length} article(s)`;

              return (
                <div
                  key={order.id}
                  className="bg-background-card rounded-xl border border-border-light shadow-subtle overflow-hidden"
                >
                  {/* Card */}
                  <button
                    onClick={() => setExpandedId(expanded ? null : order.id)}
                    className="w-full flex items-center gap-4 p-4 text-left hover:bg-background-secondary/50 transition-colors"
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${cfg.bg}`}>
                      <Icon size={18} className={cfg.text} strokeWidth={1.5} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-semibold text-text-primary truncate">
                          #{order.id?.slice(0, 8)}
                        </p>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${cfg.bg} ${cfg.text}`}>
                          {cfg.label}
                        </span>
                      </div>
                      <p className="text-xs text-text-secondary truncate">
                        {itemsSummary}
                      </p>
                      <p className="text-[11px] text-text-secondary/60 mt-0.5">
                        {relativeTime(order.createdAt || order.created_at)}
                      </p>
                    </div>

                    <p className="text-sm font-bold text-text-primary shrink-0">
                      {formatFCFA(order.totalAmount || order.total || 0)}
                    </p>

                    {expanded ? (
                      <ChevronUp size={16} className="text-text-secondary shrink-0" />
                    ) : (
                      <ChevronDown size={16} className="text-text-secondary shrink-0" />
                    )}
                  </button>

                  {/* Expanded details */}
                  {expanded && (
                    <div className="border-t border-border-light bg-background-secondary/30 px-4 py-4 space-y-4">
                      {/* Client info */}
                      {order.client && (
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-text-secondary/60 font-semibold mb-1">
                            Client
                          </p>
                          <p className="text-sm text-text-primary">
                            {order.client.firstName || ''} {order.client.lastName || ''}
                            {order.client.phone && (
                              <span className="text-text-secondary ml-2">
                                {order.client.phone}
                              </span>
                            )}
                          </p>
                        </div>
                      )}

                      {/* Items */}
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-text-secondary/60 font-semibold mb-2">
                          Articles
                        </p>
                        <div className="space-y-2">
                          {items.map((item, idx) => (
                            <div
                              key={item.id || idx}
                              className="flex items-center justify-between bg-background-card rounded-lg px-3 py-2 border border-border-light"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-text-primary truncate">
                                  {item.productName || item.name || 'Produit'}
                                </p>
                                <p className="text-xs text-text-secondary">
                                  {item.quantity || item.qty || 1} × {formatFCFA(item.unitPrice || item.price || 0)}
                                </p>
                              </div>
                              <p className="text-sm font-semibold text-text-primary ml-3 shrink-0">
                                {formatFCFA(
                                  (item.unitPrice || item.price || 0) * (item.quantity || item.qty || 1)
                                )}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Totals */}
                      <div className="border-t border-border-light pt-3 space-y-1">
                        {order.deliveryFee != null && (
                          <div className="flex justify-between text-xs text-text-secondary">
                            <span>Livraison</span>
                            <span>{formatFCFA(order.deliveryFee)}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-sm font-semibold text-text-primary">Total</span>
                          <span className="text-sm font-bold text-accent-primary">
                            {formatFCFA(order.totalAmount || order.total || 0)}
                          </span>
                        </div>
                      </div>

                      {/* Action button */}
                      {canPrepare && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartPreparation(order.id);
                          }}
                          disabled={updatingId === order.id}
                          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-accent-primary text-white text-sm font-semibold hover:opacity-90 transition disabled:opacity-50"
                        >
                          {updatingId === order.id ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <Package size={16} strokeWidth={1.5} />
                          )}
                          Marquer en préparation
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MerchantOrders;
