import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Package, Clock, Calendar, CheckCircle, XCircle, ChevronRight } from 'lucide-react';
import Loading from './Loading';
import Footer from '../components/Footer';
import { api } from '../services/api';
import useAuthStore from '../store/authStore';
import CallSupportButton from '../components/CallSupportButton';

const STATUS_CONFIG = {
  PENDING: { label: 'En attente', color: 'text-amber-600', bg: 'bg-amber-50', icon: Clock },
  SCHEDULED: { label: 'Programmée', color: 'text-teal-600', bg: 'bg-teal-50', icon: Calendar },
  PAID: { label: 'Payée', color: 'text-indigo-600', bg: 'bg-indigo-50', icon: CheckCircle },
  IN_PREPARATION: { label: 'En préparation', color: 'text-orange-600', bg: 'bg-orange-50', icon: Package },
  READY_FOR_PICKUP: { label: 'Prête', color: 'text-teal-600', bg: 'bg-teal-50', icon: CheckCircle },
  DRIVER_ASSIGNED: { label: 'Livreur en chemin', color: 'text-indigo-600', bg: 'bg-indigo-50', icon: Package },
  IN_DELIVERY: { label: 'En livraison', color: 'text-purple-600', bg: 'bg-purple-50', icon: Package },
  PROCESSING: { label: 'En livraison', color: 'text-purple-600', bg: 'bg-purple-50', icon: Package },
  READY: { label: 'Prête', color: 'text-teal-600', bg: 'bg-teal-50', icon: CheckCircle },
  DELIVERED_PENDING_CONFIRMATION: { label: 'Arrivée', color: 'text-blue-600', bg: 'bg-blue-50', icon: CheckCircle },
  DELIVERED: { label: 'Livrée', color: 'text-green-600', bg: 'bg-green-50', icon: CheckCircle },
  COMPLETED: { label: 'Terminée', color: 'text-green-700', bg: 'bg-green-50', icon: CheckCircle },
  CANCELLED: { label: 'Annulée', color: 'text-red-600', bg: 'bg-red-50', icon: XCircle },
  FAILED: { label: 'Échouée', color: 'text-red-600', bg: 'bg-red-50', icon: XCircle },
};

const Orders = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [filter, setFilter] = useState('all');

  // Cache TanStack Query : la page « Mes Commandes » s'affiche instantanément
  // au retour arrière (données en cache) puis se resynchronise en arrière-plan.
  // La queryKey inclut l'id utilisateur : jamais de commandes d'un autre compte
  // dans le cache (le store purge aussi tout le cache au login/logout).
  const {
    data: orders = [],
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['orders', 'my', user?.id || null],
    queryFn: async () => {
      const res = await api.getMyOrders();
      return res.data || res;
    },
    staleTime: 15_000, // commandes fraîches 15 s (statut suivi par push/realtime)
  });

  // Spinner visible UNIQUEMENT au 1er chargement ou sur « Réessayer » — jamais
  // lors d'une resync d'arrière-plan (les cartes restent affichées).
  const loading = isLoading || (isError && isFetching);
  const error = isError ? 'Impossible de charger vos commandes' : null;

  const filteredOrders = orders.filter((o) => filter === 'all' || o.status === filter);

  const filters = [
    { value: 'all', label: 'Toutes' },
    { value: 'PENDING', label: 'En attente' },
    { value: 'PAID', label: 'Payées' },
    { value: 'IN_PREPARATION', label: 'En préparation' },
    { value: 'PROCESSING', label: 'En livraison' },
    { value: 'DELIVERED', label: 'Livrées' },
    { value: 'COMPLETED', label: 'Terminées' },
    { value: 'CANCELLED', label: 'Annulées' },
  ];

  return (
    <div className="min-h-screen bg-background-primary font-sans">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between gap-3 mb-6">
          <h1 className="text-2xl font-semibold text-text-primary">Mes Commandes</h1>
          <CallSupportButton variant="outline" label="Aide · Appeler" />
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {filters.map((s) => (
            <button
              key={s.value}
              onClick={() => setFilter(s.value)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                filter === s.value
                  ? 'bg-accent-primary text-white'
                  : 'bg-background-card text-text-secondary border border-border-light hover:border-accent-primary'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {loading ? (
          <Loading text="Chargement des commandes..." />
        ) : error ? (
          <div className="text-center py-12 bg-background-card rounded-xl border border-border-light">
            <p className="text-text-secondary mb-4">{error}</p>
            <button onClick={refetch} className="px-6 py-2 bg-accent-primary text-white rounded-lg text-sm font-medium">Reessayer</button>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-12 bg-background-card rounded-xl border border-border-light">
            <Package size={48} className="mx-auto text-text-secondary mb-4" />
            <p className="text-text-secondary text-lg mb-2">
              {filter === 'all' ? "Aucune commande pour le moment" : `Aucune commande ${filter.toLowerCase()}`}
            </p>
            <Link to="/" className="inline-block px-6 py-2 bg-[#C1652E] text-white rounded-lg text-sm font-medium mt-2">
              Commander
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredOrders.map((order) => {
              const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.PENDING;
              const Icon = cfg.icon;
              return (
                <button
                  key={order.id}
                  onClick={() => navigate('/order-tracking', { state: { orderId: order.id } })}
                  className="w-full flex items-center gap-4 bg-background-card rounded-xl border border-border-light p-4 text-left hover:border-accent-primary transition"
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${cfg.bg}`}>
                    <Icon size={18} className={cfg.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">
                      Commande #{order.id?.slice(0, 8)}
                    </p>
                    <p className="text-xs text-text-secondary mt-0.5">
                      {cfg.label} &middot; {new Date(order.createdAt).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-[#2D2A26]">{order.totalAmount?.toLocaleString()} F</p>
                  </div>
                  <ChevronRight size={16} className="text-[#C4B8AA]" />
                </button>
              );
            })}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default Orders;
