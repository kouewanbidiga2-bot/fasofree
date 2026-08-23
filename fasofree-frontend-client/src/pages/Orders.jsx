import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Package, Clock, CheckCircle, XCircle, ChevronRight } from 'lucide-react';
import Loading from './Loading';
import Footer from '../components/Footer';
import { api } from '../services/api';

const STATUS_CONFIG = {
  PENDING: { label: 'En attente', color: 'text-amber-600', bg: 'bg-amber-50', icon: Clock },
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
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => { loadOrders(); }, []);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const data = await api.getMyOrders();
      setOrders(data.data || data);
      setError(null);
    } catch (err) {
      setError('Impossible de charger vos commandes');
    } finally {
      setLoading(false);
    }
  };

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
    <div className="min-h-screen bg-[#FAF6F1] font-sans">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-semibold text-[#2D2A26] mb-6">Mes Commandes</h1>

        <div className="flex flex-wrap gap-2 mb-6">
          {filters.map((s) => (
            <button
              key={s.value}
              onClick={() => setFilter(s.value)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                filter === s.value
                  ? 'bg-[#C1652E] text-white'
                  : 'bg-white text-[#70645C] border border-[#E8E0D8] hover:border-[#C1652E]'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {loading ? (
          <Loading text="Chargement des commandes..." />
        ) : error ? (
          <div className="text-center py-12 bg-white rounded-xl border border-[#E8E0D8]">
            <p className="text-[#70645C] mb-4">{error}</p>
            <button onClick={loadOrders} className="px-6 py-2 bg-[#C1652E] text-white rounded-lg text-sm font-medium">Réessayer</button>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-[#E8E0D8]">
            <Package size={48} className="mx-auto text-[#C4B8AA] mb-4" />
            <p className="text-[#70645C] text-lg mb-2">
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
                  className="w-full flex items-center gap-4 bg-white rounded-xl border border-[#E8E0D8] p-4 text-left hover:border-[#C1652E] transition"
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${cfg.bg}`}>
                    <Icon size={18} className={cfg.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#2D2A26] truncate">
                      Commande #{order.id?.slice(0, 8)}
                    </p>
                    <p className="text-xs text-[#70645C] mt-0.5">
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
