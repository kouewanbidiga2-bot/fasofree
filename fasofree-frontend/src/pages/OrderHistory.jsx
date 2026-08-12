/**
 * FasoFree — Historique des commandes (Client)
 * API: getMyOrders
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, MapPin, ArrowLeft, RefreshCw, ShoppingBag, Eye } from 'lucide-react';
import Footer from '../components/Footer';
import { getMyOrders, ORDER_STATUS } from '../services/orderService';

const OrderHistory = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const getStatusBadge = (status) => {
    const info = ORDER_STATUS[status] || { label: status, color: 'default' };
    const cls = {
      success: 'badge-completed',
      warning: 'badge-pending',
      info: 'badge-paid',
      processing: 'badge-preparation',
      error: 'badge-cancelled',
    };
    return <span className={cls[info.color] || 'badge'}>{info.label}</span>;
  };

  return (
    <div className="min-h-screen bg-background-primary flex flex-col">
      {/* ─── HEADER ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-background-card/90 backdrop-blur-glass border-b border-border-light">
        <div className="content-wrapper py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="btn-icon">
              <ArrowLeft size={18} />
            </button>
            <h1 className="text-lg font-bold text-text-primary">Mes commandes</h1>
          </div>
          <button onClick={loadOrders} className="btn-icon">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      <main className="flex-1 content-wrapper py-8 max-w-3xl mx-auto w-full">
        {error && (
          <div className="mb-6 p-4 bg-status-errorBg border border-status-error/30 rounded-md text-status-error flex items-center gap-2">
            <span className="text-xl">⚠</span> {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="card p-5 animate-pulse">
                <div className="h-10 bg-background-secondary rounded mb-4" />
                <div className="h-20 bg-background-secondary rounded" />
              </div>
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="card flex flex-col items-center justify-center py-20 text-center">
            <ShoppingBag size={48} className="text-text-tertiary mb-4" strokeWidth={1} />
            <p className="text-text-secondary font-bold text-base mb-2">Aucune commande</p>
            <p className="text-text-tertiary text-sm mb-6">Vous n'avez pas encore passé de commande.</p>
            <button onClick={() => navigate('/')} className="btn-primary">
              Explorer les restaurants
            </button>
          </div>
        ) : (
          <div className="space-y-4 animate-slide-up">
            {orders.map((order) => {
              const date = order.createdAt ? new Date(order.createdAt) : null;
              
              return (
                <div key={order.id} className="card p-5 transition-transform hover:-translate-y-0.5 duration-200">
                  <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-bold text-text-primary">Commande #{order.id?.slice(-8)}</span>
                        {getStatusBadge(order.status)}
                      </div>
                      {date && (
                        <div className="flex items-center gap-3 mt-2 text-xs font-semibold text-text-secondary">
                          <span className="flex items-center gap-1"><Calendar size={12} /> {date.toLocaleDateString('fr-FR')}</span>
                          <span className="flex items-center gap-1"><Clock size={12} /> {date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      )}
                    </div>
                    <button 
                      onClick={() => navigate(`/order-tracking?id=${order.id}`)}
                      className="btn-secondary py-1.5 px-3 text-xs gap-1.5"
                    >
                      <Eye size={12} /> Suivre
                    </button>
                  </div>

                  <div className="border-t border-border-light pt-4 mt-2">
                    <div className="flex items-start gap-2 text-sm text-text-secondary mb-4">
                      <MapPin size={14} className="text-accent-primary flex-shrink-0 mt-0.5" />
                      <span className="line-clamp-2 leading-relaxed">
                        {order.deliveryAddress || `${order.deliveryLatitude}, ${order.deliveryLongitude}`}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-text-secondary text-sm">Total Payé</span>
                      <span className="text-lg font-bold text-accent-primary font-mono">
                        {(order.totalAmount + (order.deliveryFee || 0)).toLocaleString()} FCFA
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default OrderHistory;
