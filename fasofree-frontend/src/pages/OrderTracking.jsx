/**
 * FasoFree — Suivi de commande (Client)
 * Récupère le statut réel via l'API et affiche la progression
 */
import React, { useState, useEffect, useCallback } from 'react';
// ✅ CORRECT
import { useNavigate, useLocation, useParams, Link } from 'react-router-dom';
import { CheckCircle, Clock, Package, Truck, Home, ArrowLeft, MapPin, RefreshCw } from 'lucide-react';
import Footer from '../components/Footer';
import { getOrderById, ORDER_STATUS } from '../services/orderService';

// Définition des étapes
const STEPS = [
  { id: 'PENDING', label: 'En attente', icon: Clock },
  { id: 'PAID', label: 'Confirmée', icon: CheckCircle },
  { id: 'IN_PREPARATION', label: 'En préparation', icon: Package },
  { id: 'PROCESSING', label: 'En route', icon: Truck },
  { id: 'DELIVERED', label: 'Livré', icon: Home },
  { id: 'COMPLETED', label: 'Terminé', icon: Home },
];

const getStepIndex = (status) => {
  if (status === 'COMPLETED') return 4;
  return STEPS.findIndex(s => s.id === status);
};

const OrderTracking = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('id');

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadOrder = useCallback(async () => {
    if (!orderId) {
      setError("Numéro de commande manquant.");
      setLoading(false);
      return;
    }
    try {
      const data = await getOrderById(orderId);
      setOrder(data);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  // Polling toutes les 15 secondes
  useEffect(() => {
    loadOrder();
    const interval = setInterval(loadOrder, 15000);
    return () => clearInterval(interval);
  }, [loadOrder]);

  if (loading && !order) {
    return (
      <div className="min-h-screen bg-background-primary flex items-center justify-center">
        <span className="w-8 h-8 border-4 border-accent-primary/30 border-t-accent-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-background-primary p-6">
        <button onClick={() => navigate(-1)} className="btn-icon mb-4"><ArrowLeft size={18} /></button>
        <div className="card p-6 text-center text-status-error">{error || 'Commande introuvable'}</div>
      </div>
    );
  }

  const isCancelled = ['CANCELLED', 'FAILED'].includes(order.status);
  const currentIndex = getStepIndex(order.status);
  // Afficher la progression sur 4 étapes (PENDING, IN_PREP, PROCESSING, DELIVERED)
  const displayIndex = isCancelled ? -1 : Math.max(0, currentIndex);
  const progress = isCancelled ? 0 : (displayIndex / 4) * 100;

  return (
    <div className="min-h-screen bg-background-primary flex flex-col">
      {/* ─── HEADER ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-background-card/90 backdrop-blur-glass border-b border-border-light">
        <div className="content-wrapper py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="btn-icon"><ArrowLeft size={18} /></button>
            <h1 className="text-lg font-bold text-text-primary">Suivi commande #{orderId.slice(-8)}</h1>
          </div>
          <button onClick={loadOrder} className="btn-icon">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      <main className="flex-1 content-wrapper py-8 max-w-2xl mx-auto w-full">
        <div className="animate-slide-up space-y-6">

          {/* ─── PROGRESSION ────────────────────────────────────────── */}
          <div className="card p-6 relative overflow-hidden">
            {isCancelled && (
              <div className="absolute inset-0 bg-status-error/10 backdrop-blur-[2px] flex items-center justify-center z-10">
                <span className="bg-status-error text-white font-bold px-4 py-2 rounded-md">Commande annulée</span>
              </div>
            )}

            <div className="flex items-center justify-between mb-8">
              <h2 className="text-sm font-bold text-text-secondary uppercase">Statut</h2>
              <span className="badge-paid">{ORDER_STATUS[order.status]?.label || order.status}</span>
            </div>

            <div className="relative pt-4 pb-8">
              {/* Ligne de fond */}
              <div className="absolute top-8 left-0 w-full h-1.5 bg-background-secondary rounded-full" />
              {/* Ligne de progression */}
              <div 
                className="absolute top-8 left-0 h-1.5 bg-accent-primary rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${progress}%` }}
              />
              
              <div className="flex justify-between relative z-10">
                {[STEPS[0], STEPS[2], STEPS[3], STEPS[4]].map((step, i) => {
                  const isActive = displayIndex >= i;
                  const Icon = step.icon;
                  return (
                    <div key={step.id} className="flex flex-col items-center gap-2">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center border-[3px] transition-all duration-500 bg-background-card ${
                        isActive ? 'border-accent-primary text-accent-primary' : 'border-background-secondary text-text-tertiary'
                      }`}>
                        <Icon size={14} />
                      </div>
                      <span className={`text-[10px] font-bold uppercase hidden sm:block ${isActive ? 'text-accent-primary' : 'text-text-tertiary'}`}>
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ─── TEMPS ESTIMÉ ───────────────────────────────────────── */}
          {!isCancelled && displayIndex < 4 && (
            <div className="card p-6 flex items-center gap-4 bg-accent-glow border-accent-primary/30">
              <div className="w-12 h-12 rounded-full bg-accent-primary/20 flex items-center justify-center text-accent-primary">
                <Clock size={20} />
              </div>
              <div>
                <p className="text-text-secondary text-xs font-semibold uppercase">Temps estimé</p>
                <p className="text-2xl font-bold text-text-primary font-mono">20-40 min</p>
              </div>
            </div>
          )}

          {/* ─── DÉTAILS COMMANDE ───────────────────────────────────── */}
          <div className="card p-6">
            <h2 className="text-sm font-bold text-text-secondary uppercase mb-4">Récapitulatif</h2>
            <div className="space-y-3">
              <div className="flex justify-between text-sm text-text-secondary">
                <span>Total de la commande</span>
                <span className="font-mono text-text-primary font-bold">{(order.totalAmount || 0).toLocaleString()} FCFA</span>
              </div>
              <div className="flex justify-between text-sm text-text-secondary">
                <span>Frais de livraison</span>
                <span className="font-mono text-text-primary font-bold">{(order.deliveryFee || 0).toLocaleString()} FCFA</span>
              </div>
              <div className="border-t border-border-light pt-3 mt-3 flex justify-between text-base font-bold text-text-primary">
                <span>Total Payé</span>
                <span className="font-mono text-accent-primary">{(order.totalAmount + (order.deliveryFee || 0)).toLocaleString()} FCFA</span>
              </div>
            </div>
          </div>

          {/* ─── INFOS LIVRAISON ────────────────────────────────────── */}
          <div className="card p-6">
            <h2 className="text-sm font-bold text-text-secondary uppercase mb-4">Adresse de livraison</h2>
            <div className="flex items-start gap-3">
              <MapPin size={18} className="text-accent-primary mt-0.5 flex-shrink-0" />
              <p className="text-sm text-text-primary leading-relaxed">
                {order.deliveryAddress || `${order.deliveryLatitude}, ${order.deliveryLongitude}`}
              </p>
            </div>
          </div>

          {/* ─── ACTIONS ────────────────────────────────────────────── */}
          <div className="flex gap-4">
            <button onClick={() => navigate('/order-history')} className="btn-secondary flex-1">
              Historique
            </button>
            <button onClick={() => navigate('/')} className="btn-primary flex-1">
              Nouvelle commande
            </button>
          </div>

        </div>
      </main>

      <Footer />
    </div>
  );
};

export default OrderTracking;
