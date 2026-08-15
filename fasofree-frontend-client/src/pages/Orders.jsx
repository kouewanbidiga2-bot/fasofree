import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import OrderItem from '../components/OrderItem';
import Loading from '../components/Loading';
import Error from '../components/Error';
import { orderService } from '../services/orderService';

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const data = await orderService.getMyOrders();
      setOrders(data.data || data);
      setError(null);
    } catch (err) {
      setError('Impossible de charger vos commandes');
      console.error('Error loading orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = orders.filter((order) => {
    if (filter === 'all') return true;
    return order.status === filter;
  });

  const statusFilters = [
    { value: 'all', label: 'Toutes' },
    { value: 'PENDING', label: 'En attente' },
    { value: 'CONFIRMED', label: 'Confirmées' },
    { value: 'PREPARING', label: 'En préparation' },
    { value: 'OUT_FOR_DELIVERY', label: 'En livraison' },
    { value: 'DELIVERED', label: 'Livrées' },
    { value: 'CANCELLED', label: 'Annulées' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Mes Commandes</h1>

        {/* Filter tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {statusFilters.map((status) => (
            <button
              key={status.value}
              onClick={() => setFilter(status.value)}
              className={`px-4 py-2 rounded-full transition ${
                filter === status.value
                  ? 'bg-orange-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-orange-50'
              }`}
            >
              {status.label}
            </button>
          ))}
        </div>

        {loading ? (
          <Loading text="Chargement des commandes..." />
        ) : error ? (
          <Error message={error} onRetry={loadOrders} />
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg mb-4">
              {filter === 'all' 
                ? 'Vous n\'avez aucune commande pour le moment' 
                : `Aucune commande ${filter.toLowerCase()}`}
            </p>
            <Link
              to="/"
              className="inline-block px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition"
            >
              Passer une commande
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => (
              <OrderItem key={order.id} order={order} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Orders;
