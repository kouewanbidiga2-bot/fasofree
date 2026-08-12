/**
 * FasoFree — Dashboard Livreur (driver)
 * Commandes assignées depuis l'API, mise à jour statut réelle
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MapPin, Phone, Package, LogOut, RefreshCw,
  CheckCircle, XCircle, Bike, Clock, Wallet,
  AlertCircle, Navigation, TrendingUp,
} from 'lucide-react';
import useAuthStore from '../store/authStore';
import { getMyOrders, updateOrderStatus, getStatusInfo } from '../services/orderService';
import { getWallet } from '../services/walletService';

const StatusBadge = ({ status }) => {
  const info = getStatusInfo(status);
  const cls = {
    success: 'badge-completed',
    warning: 'badge-pending',
    info: 'badge-processing',
    processing: 'badge-preparation',
    error: 'badge-cancelled',
  };
  return <span className={cls[info.color] || 'badge'}>{info.label}</span>;
};

const Skeleton = ({ className = '' }) => (
  <div className={`skeleton rounded-md ${className}`} />
);

const DriverDashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const [orders, setOrders] = useState([]);
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState({});
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('active'); // active | completed

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getMyOrders();
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadWallet = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await getWallet('driver', user.id);
      setWallet(data);
    } catch {}
  }, [user?.id]);

  useEffect(() => {
    loadOrders();
    loadWallet();
  }, [loadOrders, loadWallet]);

  const handleAccept = async (orderId) => {
    setUpdating(p => ({ ...p, [orderId]: true }));
    try {
      const updated = await updateOrderStatus(orderId, 'PROCESSING');
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updated } : o));
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdating(p => ({ ...p, [orderId]: false }));
    }
  };

  const handleDeliver = async (orderId) => {
    setUpdating(p => ({ ...p, [orderId]: true }));
    try {
      const updated = await updateOrderStatus(orderId, 'DELIVERED');
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updated } : o));
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdating(p => ({ ...p, [orderId]: false }));
    }
  };

  const handleDecline = async (orderId) => {
    if (!window.confirm('Refuser cette commande ?')) return;
    setUpdating(p => ({ ...p, [orderId]: true }));
    try {
      const updated = await updateOrderStatus(orderId, 'CANCELLED');
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updated } : o));
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdating(p => ({ ...p, [orderId]: false }));
    }
  };

  const handleLogout = () => { logout(); navigate('/auth'); };

  const activeOrders = orders.filter(o => ['PAID', 'IN_PREPARATION', 'PROCESSING'].includes(o.status));
  const pendingOrders = orders.filter(o => o.status === 'PENDING');
  const completedOrders = orders.filter(o => ['DELIVERED', 'COMPLETED'].includes(o.status));
  const displayedOrders = activeTab === 'active'
    ? [...pendingOrders, ...activeOrders]
    : completedOrders;

  const totalEarnings = completedOrders.reduce((s, o) => s + (o.deliveryFee || 0), 0);

  return (
    <div className="min-h-screen bg-background-primary">

      {/* ─── HEADER ────────────────────────────────────────────────── */}
      <header className="bg-background-card border-b border-border-light sticky top-0 z-20">
        <div className="content-wrapper py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'rgba(193,101,46,0.15)' }}>
                <Bike size={16} className="text-accent-primary" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-text-primary">
                  {user?.fullName || user?.name || 'Livreur'}
                </h1>
                <p className="text-text-tertiary text-xs">Dashboard Livreur</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={loadOrders} className="btn-icon" title="Actualiser">
                <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              </button>
              <button onClick={handleLogout} className="btn-icon">
                <LogOut size={15} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="content-wrapper py-6">

        {/* ─── KPIs ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'En attente', value: pendingOrders.length, icon: Clock, color: '#F59E0B' },
            { label: 'En cours', value: activeOrders.length, icon: Navigation, color: '#3B82F6' },
            { label: 'Livrées', value: completedOrders.length, icon: CheckCircle, color: '#22C55E' },
            {
              label: 'Gains estimés',
              value: `${totalEarnings.toLocaleString()} F`,
              icon: TrendingUp,
              color: '#C1652E',
            },
          ].map(item => (
            <div key={item.label} className="stat-card animate-slide-up">
              <div className="flex items-center gap-2 mb-2">
                <item.icon size={14} style={{ color: item.color }} strokeWidth={1.5} />
                <span className="text-text-tertiary text-xs">{item.label}</span>
              </div>
              <p className="text-lg font-bold text-text-primary">{item.value}</p>
            </div>
          ))}
        </div>

        {/* Portefeuille */}
        {wallet && (
          <div className="card p-4 mb-6 flex items-center gap-4" style={{ background: 'rgba(193,101,46,0.06)', borderColor: 'rgba(193,101,46,0.2)' }}>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(193,101,46,0.15)' }}>
              <Wallet size={18} className="text-accent-primary" />
            </div>
            <div>
              <p className="text-text-secondary text-xs">Solde portefeuille</p>
              <p className="text-accent-primary font-bold text-xl font-mono">{(wallet.balance || 0).toLocaleString()} FCFA</p>
            </div>
          </div>
        )}

        {/* Erreur */}
        {error && (
          <div className="mb-5 p-3 bg-status-errorBg border border-status-error/30 rounded-md text-status-error text-sm flex items-center gap-2 animate-fade-in">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        {/* ─── TABS ──────────────────────────────────────────────────── */}
        <div className="tabs-bar mb-5">
          <button
            onClick={() => setActiveTab('active')}
            className={`tab-btn flex items-center gap-1.5 ${activeTab === 'active' ? 'active' : ''}`}
          >
            <Bike size={14} /> Actives
            {(pendingOrders.length + activeOrders.length) > 0 && (
              <span className="w-5 h-5 bg-accent-primary text-white text-xs rounded-full flex items-center justify-center font-bold">
                {pendingOrders.length + activeOrders.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`tab-btn flex items-center gap-1.5 ${activeTab === 'completed' ? 'active' : ''}`}
          >
            <CheckCircle size={14} /> Terminées ({completedOrders.length})
          </button>
        </div>

        {/* ─── LISTE COMMANDES ───────────────────────────────────────── */}
        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <Skeleton key={i} className="h-36 w-full" />)}
          </div>
        ) : displayedOrders.length === 0 ? (
          <div className="card flex flex-col items-center justify-center py-20 text-center">
            <Bike size={48} className="text-text-tertiary mb-4" strokeWidth={1} />
            <p className="text-text-secondary font-semibold">
              {activeTab === 'active' ? 'Aucune commande à livrer' : 'Aucune livraison effectuée'}
            </p>
            <p className="text-text-tertiary text-sm mt-1">
              {activeTab === 'active' ? 'De nouvelles commandes apparaîtront ici.' : ''}
            </p>
            <button onClick={loadOrders} className="btn-secondary mt-4 gap-2">
              <RefreshCw size={14} /> Actualiser
            </button>
          </div>
        ) : (
          <div className="space-y-3 animate-slide-up">
            {displayedOrders.map(order => {
              const isUpdating = updating[order.id];
              const isPending = order.status === 'PENDING';
              const isProcessing = order.status === 'PROCESSING';
              const isDone = ['DELIVERED', 'COMPLETED'].includes(order.status);

              return (
                <div
                  key={order.id}
                  className={`card p-5 transition-all ${isDone ? 'opacity-70' : ''}`}
                >
                  {/* En-tête commande */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-bold text-text-primary font-mono text-sm">
                          #{order.id?.slice(-8)}
                        </p>
                        <StatusBadge status={order.status} />
                      </div>
                      <p className="text-text-tertiary text-xs flex items-center gap-1">
                        <Clock size={11} />
                        {order.createdAt ? new Date(order.createdAt).toLocaleString('fr-FR') : '—'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-accent-primary font-bold font-mono">
                        {(order.totalAmount || 0).toLocaleString()} FCFA
                      </p>
                      {order.deliveryFee > 0 && (
                        <p className="text-status-success text-xs font-semibold">
                          +{order.deliveryFee.toLocaleString()} FCFA livraison
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Adresse livraison */}
                  {(order.deliveryLatitude || order.deliveryAddress) && (
                    <div className="flex items-start gap-2 py-3 border-t border-b border-border-light mb-4">
                      <MapPin size={14} className="text-accent-primary flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-text-secondary text-xs font-semibold">Livraison</p>
                        <p className="text-text-primary text-sm">
                          {order.deliveryAddress || `${order.deliveryLatitude?.toFixed(4)}, ${order.deliveryLongitude?.toFixed(4)}`}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Type commande */}
                  <div className="flex items-center gap-4 mb-4 text-xs text-text-tertiary">
                    <span className="flex items-center gap-1">
                      <Package size={11} /> {order.orderType || '—'}
                    </span>
                  </div>

                  {/* Actions */}
                  {!isDone && (
                    <div className="flex gap-2 flex-wrap">
                      {isPending && (
                        <>
                          <button
                            disabled={isUpdating}
                            onClick={() => handleAccept(order.id)}
                            className="btn-primary flex-1 py-2.5"
                          >
                            {isUpdating ? (
                              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                              <CheckCircle size={15} />
                            )}
                            Accepter
                          </button>
                          <button
                            disabled={isUpdating}
                            onClick={() => handleDecline(order.id)}
                            className="btn-danger flex-1 py-2.5"
                          >
                            <XCircle size={15} /> Refuser
                          </button>
                        </>
                      )}
                      {isProcessing && (
                        <button
                          disabled={isUpdating}
                          onClick={() => handleDeliver(order.id)}
                          className="btn-primary w-full"
                          style={{ background: 'linear-gradient(135deg, #22C55E, #16A34A)' }}
                        >
                          {isUpdating ? (
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <CheckCircle size={15} />
                          )}
                          Marquer comme livré
                        </button>
                      )}
                      {['PAID', 'IN_PREPARATION'].includes(order.status) && (
                        <div className="w-full p-3 bg-background-secondary rounded-md text-center">
                          <p className="text-text-secondary text-xs">En attente de préparation par le commerce...</p>
                        </div>
                      )}
                    </div>
                  )}

                  {isDone && (
                    <div className="flex items-center gap-2 text-status-success text-sm font-semibold">
                      <CheckCircle size={14} />
                      Livraison effectuée
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

export default DriverDashboard;
