import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, MapPin, ArrowLeft, Repeat } from 'lucide-react';
import Footer from '../components/Footer';

const OrderHistory = () => {
  const navigate = useNavigate();

  const orders = [
    {
      id: '12345',
      restaurant: 'Cesar',
      restaurantLogo: 'https://images.unsplash.com/photo-1552566626-52f8b828add9?w=400',
      date: '2024-01-15',
      time: '12:30',
      status: 'delivered',
      total: 11400,
      items: ['Cesar Burger x2', 'Chicken Sandwich x1'],
      address: 'Patte d Oie, Ouagadougou',
    },
    {
      id: '12344',
      restaurant: 'BelChiken',
      restaurantLogo: 'https://images.unsplash.com/photo-1594007654729-407eedc4be65?w=400',
      date: '2024-01-10',
      time: '19:45',
      status: 'delivered',
      total: 8500,
      items: ['8 Wings x1', 'Bel Burger x1'],
      address: 'Projet Zaca, Ouagadougou',
    },
    {
      id: '12343',
      restaurant: 'ChitirChiken',
      restaurantLogo: 'https://images.unsplash.com/photo-1561758033-d89a9ad46330?w=400',
      date: '2024-01-05',
      time: '14:20',
      status: 'cancelled',
      total: 6700,
      items: ['Chitir Burger x1', 'Tornado Wrap x1'],
      address: 'Ouaga 2000, Ouagadougou',
    },
  ];

  const getStatusBadge = (status) => {
    const statusMap = {
      delivered: { variant: 'success', label: 'Livré' },
      preparing: { variant: 'info', label: 'En préparation' },
      delivering: { variant: 'warning', label: 'En route' },
      cancelled: { variant: 'error', label: 'Annulé' },
    };
    return statusMap[status] || { variant: 'default', label: status };
  };

  return (
    <div className="min-h-screen bg-background-primary">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background-primary border-b border-border-light">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-background-secondary transition-colors"
            >
              <ArrowLeft size={18} className="text-text-primary" strokeWidth={1.5} />
            </button>
            <h1 className="text-lg font-display font-bold text-text-primary">Mes commandes</h1>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-3xl mx-auto space-y-3">
          {orders.map((order) => {
            const statusBadge = getStatusBadge(order.status);

            return (
              <div key={order.id}>
                <div className="border border-border-light p-4">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={order.restaurantLogo}
                        alt={order.restaurant}
                        className="w-10 h-10 object-cover rounded-photo"
                      />
                      <div>
                        <h3 className="font-medium text-text-primary text-sm">{order.restaurant}</h3>
                        <div className="flex items-center gap-2 mt-1 text-xs text-text-secondary">
                          <Calendar size={11} strokeWidth={1.5} />
                          <span>{order.date}</span>
                          <Clock size={11} strokeWidth={1.5} />
                          <span>{order.time}</span>
                        </div>
                      </div>
                    </div>
                    <div className="px-3 py-1 bg-background-secondary text-xs font-medium text-text-secondary">
                      {statusBadge.label}
                    </div>
                  </div>

                  <div className="border-t border-border-light pt-4">
                    <div className="space-y-2 mb-4">
                      {order.items.map((item, idx) => (
                        <p key={idx} className="text-text-secondary text-sm">
                          {item}
                        </p>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-text-secondary mb-4">
                      <MapPin size={11} strokeWidth={1.5} />
                      <span>{order.address}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-base font-medium text-text-primary">
                        {order.total.toLocaleString()} FCFA
                      </span>
                      {order.status === 'delivered' && (
                        <button className="px-3 py-1.5 text-xs font-medium border border-border-light text-text-secondary hover:border-accent-primary hover:text-accent-primary transition-colors">
                          <Repeat size={12} className="mr-2" strokeWidth={1.5} />
                          Commander à nouveau
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {orders.length === 0 && (
            <div className="text-center py-16">
              <p className="text-text-secondary text-sm">Aucune commande passée</p>
              <button onClick={() => navigate('/')} className="mt-4 px-6 py-3 text-sm font-medium text-white transition-colors" style={{ backgroundColor: '#C1652E' }}>
                Explorer les restaurants
              </button>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default OrderHistory;
