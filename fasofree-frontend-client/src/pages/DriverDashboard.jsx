import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X, MapPin, Phone, Clock, Package, Home, LogOut } from 'lucide-react';

const DriverDashboard = () => {
  const navigate = useNavigate();
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orders, setOrders] = useState([
    {
      id: 'FF12345678',
      customerName: 'Aminata Ouédraogo',
      customerPhone: '+226 70 12 34 56',
      address: 'Patte d Oie, Ouagadougou',
      restaurant: 'Cesar',
      items: ['Cesar Burger x2', 'Frites x1'],
      total: 9000,
      status: 'delivering',
      estimatedTime: 15,
      coordinates: { lat: 12.3714, lng: -1.5197 }
    },
    {
      id: 'FF87654321',
      customerName: 'Koumba Sanou',
      customerPhone: '+226 70 98 76 54',
      address: 'Koulouba, Ouagadougou',
      restaurant: 'Gusto',
      items: ['Sushi set x1', 'Riz x1'],
      total: 12000,
      status: 'pending',
      estimatedTime: 30,
      coordinates: { lat: 12.3582, lng: -1.5341 }
    },
    {
      id: 'FF11223344',
      customerName: 'Issa Zongo',
      customerPhone: '+226 70 55 44 33',
      address: 'Wemtenga, Ouagadougou',
      restaurant: 'BelChiken',
      items: ['8 Wings x2', 'Coca-Cola x2'],
      total: 11000,
      status: 'pending',
      estimatedTime: 25,
      coordinates: { lat: 12.3654, lng: -1.5234 }
    }
  ]);

  const handleAcceptOrder = (orderId) => {
    setOrders(orders.map(order => 
      order.id === orderId 
        ? { ...order, status: 'delivering' }
        : order
    ));
  };

  const handleCompleteDelivery = (orderId) => {
    setOrders(orders.map(order => 
      order.id === orderId 
        ? { ...order, status: 'delivered' }
        : order
    ));
    setSelectedOrder(null);
  };

  const handleRejectOrder = (orderId) => {
    if (window.confirm('Êtes-vous sûr de vouloir refuser cette commande ?')) {
      setOrders(orders.filter(order => order.id !== orderId));
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium">En attente</span>;
      case 'delivering':
        return <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium">En livraison</span>;
      case 'delivered':
        return <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium">Livré</span>;
      default:
        return null;
    }
  };

  const pendingOrders = orders.filter(o => o.status === 'pending');
  const activeOrders = orders.filter(o => o.status === 'delivering');
  const completedOrders = orders.filter(o => o.status === 'delivered');

  return (
    <div className="min-h-screen bg-background-primary">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background-primary border-b border-border-light">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-display font-bold text-text-primary">Tableau de bord Livreur</h1>
              <p className="text-xs text-text-secondary">Gérez vos livraisons</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/')}
                className="p-2 hover:bg-background-secondary transition-colors"
              >
                <Home size={18} className="text-text-primary" strokeWidth={1.5} />
              </button>
              <button className="p-2 hover:bg-background-secondary transition-colors">
                <LogOut size={18} className="text-text-primary" strokeWidth={1.5} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white border border-border-light p-4">
            <p className="text-xs text-text-secondary mb-1">En attente</p>
            <p className="text-2xl font-mono font-bold text-text-primary">{pendingOrders.length}</p>
          </div>
          <div className="bg-white border border-border-light p-4">
            <p className="text-xs text-text-secondary mb-1">En livraison</p>
            <p className="text-2xl font-mono font-bold text-text-primary">{activeOrders.length}</p>
          </div>
          <div className="bg-white border border-border-light p-4">
            <p className="text-xs text-text-secondary mb-1">Livré aujourd'hui</p>
            <p className="text-2xl font-mono font-bold text-text-primary">{completedOrders.length}</p>
          </div>
        </div>

        {/* Active Delivery */}
        {selectedOrder && (
          <div className="bg-white border border-border-light p-6 mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-base font-medium text-text-primary">Livraison en cours</h2>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-sm text-text-secondary hover:text-text-primary"
              >
                Fermer
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="mb-4">
                  <p className="text-xs text-text-secondary mb-1">Numéro de commande</p>
                  <p className="text-sm font-mono font-bold text-text-primary">{selectedOrder.id}</p>
                </div>

                <div className="mb-4">
                  <p className="text-xs text-text-secondary mb-1">Client</p>
                  <p className="text-sm font-medium text-text-primary">{selectedOrder.customerName}</p>
                </div>

                <div className="mb-4">
                  <p className="text-xs text-text-secondary mb-1">Téléphone</p>
                  <div className="flex items-center gap-2">
                    <Phone size={16} className="text-text-secondary" strokeWidth={1.5} />
                    <p className="text-sm text-text-primary">{selectedOrder.customerPhone}</p>
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-xs text-text-secondary mb-1">Adresse</p>
                  <div className="flex items-center gap-2">
                    <MapPin size={16} className="text-text-secondary" strokeWidth={1.5} />
                    <p className="text-sm text-text-primary">{selectedOrder.address}</p>
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-xs text-text-secondary mb-1">Restaurant</p>
                  <p className="text-sm text-text-primary">{selectedOrder.restaurant}</p>
                </div>

                <div className="mb-4">
                  <p className="text-xs text-text-secondary mb-1">Articles</p>
                  {selectedOrder.items.map((item, index) => (
                    <p key={index} className="text-sm text-text-primary">• {item}</p>
                  ))}
                </div>

                <div>
                  <p className="text-xs text-text-secondary mb-1">Total</p>
                  <p className="text-lg font-mono font-bold text-text-primary">{selectedOrder.total.toLocaleString()} FCFA</p>
                </div>
              </div>

              <div className="flex flex-col justify-center items-center bg-background-secondary p-6">
                <div className="w-32 h-32 bg-background-primary rounded-full flex items-center justify-center mb-4">
                  <MapPin size={48} className="text-text-secondary" strokeWidth={1.5} />
                </div>
                <p className="text-sm text-text-secondary mb-2">Temps estimé</p>
                <p className="text-3xl font-mono font-bold text-text-primary">{selectedOrder.estimatedTime} min</p>
                <button
                  onClick={() => window.open(`https://maps.google.com/?q=${selectedOrder.coordinates.lat},${selectedOrder.coordinates.lng}`)}
                  className="mt-4 px-4 py-2 text-sm font-medium border border-border-light text-text-secondary hover:border-accent-primary hover:text-accent-primary transition-colors"
                  style={{ borderColor: '#C1652E' }}
                >
                  Ouvrir Maps
                </button>
              </div>
            </div>

            <div className="flex gap-4 mt-6">
              <button
                onClick={() => handleCompleteDelivery(selectedOrder.id)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-white transition-colors"
                style={{ backgroundColor: '#5C6B3C' }}
              >
                <Check size={18} strokeWidth={1.5} />
                <span className="text-sm font-medium">Confirmer la livraison</span>
              </button>
              <button
                onClick={() => handleRejectOrder(selectedOrder.id)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border border-border-light text-text-secondary hover:border-red-500 hover:text-red-500 transition-colors"
              >
                <X size={18} strokeWidth={1.5} />
                <span className="text-sm font-medium">Problème</span>
              </button>
            </div>
          </div>
        )}

        {/* Pending Orders */}
        {pendingOrders.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-medium text-text-secondary mb-4 flex items-center gap-2">
              <Clock size={16} strokeWidth={1.5} />
              Commandes en attente ({pendingOrders.length})
            </h2>
            <div className="space-y-4">
              {pendingOrders.map((order) => (
                <div key={order.id} className="bg-white border border-border-light p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm font-mono font-bold text-text-primary mb-1">{order.id}</p>
                      <p className="text-sm text-text-primary">{order.customerName}</p>
                      <p className="text-xs text-text-secondary">{order.address}</p>
                    </div>
                    {getStatusBadge(order.status)}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-xs text-text-secondary">
                      <span>{order.restaurant}</span>
                      <span>•</span>
                      <span>{order.estimatedTime} min</span>
                      <span>•</span>
                      <span className="font-mono">{order.total.toLocaleString()} FCFA</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAcceptOrder(order.id)}
                        className="px-3 py-2 text-xs font-medium text-white transition-colors"
                        style={{ backgroundColor: '#C1652E' }}
                      >
                        Accepter
                      </button>
                      <button
                        onClick={() => handleRejectOrder(order.id)}
                        className="px-3 py-2 text-xs font-medium border border-border-light text-text-secondary hover:border-red-500 hover:text-red-500 transition-colors"
                      >
                        Refuser
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active Orders (if not selected) */}
        {!selectedOrder && activeOrders.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-medium text-text-secondary mb-4 flex items-center gap-2">
              <Package size={16} strokeWidth={1.5} />
              En cours de livraison ({activeOrders.length})
            </h2>
            <div className="space-y-4">
              {activeOrders.map((order) => (
                <div key={order.id} className="bg-white border border-border-light p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm font-mono font-bold text-text-primary mb-1">{order.id}</p>
                      <p className="text-sm text-text-primary">{order.customerName}</p>
                      <p className="text-xs text-text-secondary">{order.address}</p>
                    </div>
                    {getStatusBadge(order.status)}
                  </div>
                  <button
                    onClick={() => setSelectedOrder(order)}
                    className="w-full px-3 py-2 text-xs font-medium border border-border-light text-text-secondary hover:border-accent-primary hover:text-accent-primary transition-colors"
                    style={{ borderColor: '#C1652E' }}
                  >
                    Voir les détails
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Completed Orders */}
        {completedOrders.length > 0 && (
          <div>
            <h2 className="text-sm font-medium text-text-secondary mb-4 flex items-center gap-2">
              <Check size={16} strokeWidth={1.5} />
              Livrées aujourd'hui ({completedOrders.length})
            </h2>
            <div className="space-y-4">
              {completedOrders.map((order) => (
                <div key={order.id} className="bg-white border border-border-light p-4 opacity-60">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm font-mono font-bold text-text-primary mb-1">{order.id}</p>
                      <p className="text-sm text-text-primary">{order.customerName}</p>
                      <p className="text-xs text-text-secondary">{order.address}</p>
                    </div>
                    {getStatusBadge(order.status)}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-text-secondary">
                    <span>{order.restaurant}</span>
                    <span>•</span>
                    <span className="font-mono">{order.total.toLocaleString()} FCFA</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {orders.length === 0 && (
          <div className="text-center py-12">
            <Package size={48} className="text-text-secondary mx-auto mb-4" strokeWidth={1.5} />
            <p className="text-text-secondary">Aucune commande disponible</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DriverDashboard;
