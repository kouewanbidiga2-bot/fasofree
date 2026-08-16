import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Check,
  X,
  MapPin,
  Phone,
  Clock,
  Package,
  Home,
  LogOut,
  Navigation,
  Power,
  Car,
} from 'lucide-react';
import { getDispatchSocket } from '../services/realtime';
import { api } from '../services/api';
import useAuthStore from '../store/authStore';

const DriverDashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const [online, setOnline] = useState(false);
  const [pending, setPending] = useState([]);
  const [active, setActive] = useState([]);
  const [completed, setCompleted] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [liveGps, setLiveGps] = useState(null);
  const [gpsWatch, setGpsWatch] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const gpsWatchRef = useRef(null);
  const socketRef = useRef(null);

  const fullName =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
    user?.email ||
    'Livreur';

  const stopGps = useCallback(() => {
    if (gpsWatchRef.current != null) {
      navigator.geolocation.clearWatch(gpsWatchRef.current);
      gpsWatchRef.current = null;
    }
    setGpsWatch(null);
    setLiveGps(null);
  }, []);

  const startGpsStreaming = useCallback((orderId) => {
    const socket = getDispatchSocket();
    if (!socket.connected) socket.connect();
    socketRef.current = socket;

    if (!navigator.geolocation) {
      setLiveGps({ error: 'Position indisponible' });
      return;
    }

    gpsWatchRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const payload = {
          orderId,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          heading: position.coords.heading || undefined,
        };
        socket.emit('updateDriverLocation', payload);
        setLiveGps({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timestamp: new Date().toISOString(),
        });
      },
      () => setLiveGps({ error: 'Position indisponible' }),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 },
    );
    setGpsWatch(gpsWatchRef.current);
  }, []);

  // ─── Réception des opportunités de courses (socket /dispatch) ─────────
  useEffect(() => {
    const socket = getDispatchSocket();
    const token = localStorage.getItem('access_token');
    if (token && socket.auth?.token !== token) {
      socket.auth = { token };
      if (socket.connected) socket.disconnect();
    }
    if (!socket.connected) socket.connect();

    const onOffer = (data) => {
      if (!data || !data.orderId) return;
      setPending((prev) => {
        if (prev.some((o) => o.orderId === data.orderId)) return prev;
        return [data, ...prev];
      });
    };

    socket.on('deliveryOpportunity', onOffer);
    socketRef.current = socket;

    return () => {
      socket.off('deliveryOpportunity', onOffer);
    };
  }, []);

  // Nettoyage GPS au démontage
  useEffect(() => () => stopGps(), [stopGps]);

  const handleToggleOnline = async () => {
    setConnecting(true);
    try {
      if (!online) {
        const position = await new Promise((resolve, reject) => {
          if (!navigator.geolocation) reject(new Error('Géolocalisation indisponible'));
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
          });
        });
        await api.updateDriverStatus({
          isOnline: true,
          isAvailable: true,
          latitude: Number(position.coords.latitude.toFixed(6)),
          longitude: Number(position.coords.longitude.toFixed(6)),
          vehicleType: 'MOTO',
        });
        setOnline(true);
      } else {
        await api.updateDriverStatus({ isOnline: false, isAvailable: false });
        setOnline(false);
      }
    } catch (error) {
      window.alert(error?.message || 'Impossible de modifier votre statut');
    } finally {
      setConnecting(false);
    }
  };

  const handleAcceptOrder = async (offer) => {
    try {
      const order = await api.acceptOrder(offer.orderId);
      const activeOrder = {
        orderId: offer.orderId,
        orderType: offer.orderType,
        pickupAddress: order.pickupLocation?.address || offer.pickupAddress,
        pickupContact: order.pickupLocation?.contactName || 'Client',
        pickupPhone: order.pickupLocation?.contactPhone || '',
        dropoffAddress: order.dropoffLocation?.address || offer.dropoffAddress,
        earningXOF: offer.earningXOF,
        totalAmount: order.totalAmount ?? offer.totalAmount,
        coordinates: {
          lat: offer.pickupLatitude,
          lng: offer.pickupLongitude,
        },
        status: 'pending_start',
      };
      setPending((prev) => prev.filter((o) => o.orderId !== offer.orderId));
      setActive((prev) => [...prev, activeOrder]);
      setSelectedOrder(activeOrder);
    } catch (error) {
      setPending((prev) => prev.filter((o) => o.orderId !== offer.orderId));
      window.alert(
        error?.message || 'Cette course vient d\'être prise par un autre chauffeur.',
      );
    }
  };

  const handleStartRide = (orderId) => {
    setActive((prev) =>
      prev.map((o) =>
        o.orderId === orderId ? { ...o, status: 'delivering' } : o,
      ),
    );
    setSelectedOrder((prev) =>
      prev && prev.orderId === orderId ? { ...prev, status: 'delivering' } : prev,
    );
    startGpsStreaming(orderId);
  };

  const handleCompleteDelivery = async (orderId) => {
    stopGps();
    try {
      await api.driverValidateDelivery(orderId);
    } catch (error) {
      console.warn('Livraison complétée localement :', error.message);
    }
    setActive((prev) => prev.filter((o) => o.orderId !== orderId));
    setCompleted((prev) => [
      ...prev,
      { orderId, completedAt: new Date().toISOString() },
    ]);
    setSelectedOrder(null);
  };

  const handleRejectOrder = (orderId) => {
    if (window.confirm('Êtes-vous sûr de vouloir refuser cette course ?')) {
      setPending((prev) => prev.filter((o) => o.orderId !== orderId));
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
      case 'pending_start':
        return (
          <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium">
            En attente
          </span>
        );
      case 'delivering':
        return (
          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium">
            En livraison
          </span>
        );
      default:
        return null;
    }
  };

  const typeBadge = (orderType) =>
    orderType === 'RIDE' ? (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold uppercase tracking-wide rounded">
        <Car size={11} /> Course
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-50 text-orange-700 text-[10px] font-bold uppercase tracking-wide rounded">
        <Package size={11} /> Repas
      </span>
    );

  const handleLogout = () => {
    if (online) api.updateDriverStatus({ isOnline: false }).catch(() => {});
    stopGps();
    logout();
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-background-primary">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background-primary border-b border-border-light">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-display font-bold text-text-primary">
                Espace Livreur
              </h1>
              <p className="text-xs text-text-secondary">
                {fullName} ·{' '}
                {online ? (
                  <span className="text-status-success font-medium">
                    En ligne
                  </span>
                ) : (
                  <span className="text-text-tertiary">Hors ligne</span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/')}
                className="p-2 hover:bg-background-secondary transition-colors"
              >
                <Home size={18} className="text-text-primary" strokeWidth={1.5} />
              </button>
              <button
                onClick={handleLogout}
                className="p-2 hover:bg-background-secondary transition-colors"
              >
                <LogOut size={18} className="text-text-primary" strokeWidth={1.5} />
              </button>
            </div>
          </div>

          <div className="mt-4">
            <button
              onClick={handleToggleOnline}
              disabled={connecting}
              className={`w-full sm:w-auto px-6 py-3 text-sm font-medium text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${
                online ? 'bg-status-error' : 'bg-status-success'
              }`}
            >
              <Power size={16} strokeWidth={1.5} />
              {connecting
                ? 'Connexion...'
                : online
                  ? 'Se déconnecter'
                  : 'Se mettre en ligne'}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white border border-border-light p-4">
            <p className="text-xs text-text-secondary mb-1">En attente</p>
            <p className="text-2xl font-mono font-bold text-text-primary">
              {pending.length}
            </p>
          </div>
          <div className="bg-white border border-border-light p-4">
            <p className="text-xs text-text-secondary mb-1">En livraison</p>
            <p className="text-2xl font-mono font-bold text-text-primary">
              {active.length}
            </p>
          </div>
          <div className="bg-white border border-border-light p-4">
            <p className="text-xs text-text-secondary mb-1">Livrées</p>
            <p className="text-2xl font-mono font-bold text-text-primary">
              {completed.length}
            </p>
          </div>
        </div>

        {!online && pending.length === 0 && active.length === 0 && (
          <div className="text-center py-12">
            <Power size={48} className="text-text-secondary mx-auto mb-4" strokeWidth={1.5} />
            <p className="text-text-secondary">
              Mettez-vous en ligne pour recevoir les demandes de courses.
            </p>
          </div>
        )}

        {/* Active Delivery */}
        {selectedOrder && (
          <div className="bg-white border border-border-light p-6 mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-base font-medium text-text-primary">
                Livraison en cours
              </h2>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-sm text-text-secondary hover:text-text-primary"
              >
                Fermer
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="mb-4 flex items-center gap-2">
                  <p className="text-sm font-mono font-bold text-text-primary">
                    {selectedOrder.orderId}
                  </p>
                  {typeBadge(selectedOrder.orderType)}
                </div>

                <div className="mb-4">
                  <p className="text-xs text-text-secondary mb-1">Départ</p>
                  <p className="text-sm text-text-primary">
                    {selectedOrder.pickupAddress}
                  </p>
                </div>

                <div className="mb-4">
                  <p className="text-xs text-text-secondary mb-1">Destination</p>
                  <p className="text-sm text-text-primary">
                    {selectedOrder.dropoffAddress}
                  </p>
                </div>

                <div className="mb-4">
                  <p className="text-xs text-text-secondary mb-1">Contact</p>
                  <div className="flex items-center gap-2">
                    <Phone size={16} className="text-text-secondary" strokeWidth={1.5} />
                    <p className="text-sm text-text-primary">
                      {selectedOrder.pickupContact}{' '}
                      {selectedOrder.pickupPhone && (
                        <span className="text-text-secondary">
                          · {selectedOrder.pickupPhone}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-text-secondary mb-1">Gain</p>
                  <p className="text-lg font-mono font-bold text-text-primary">
                    {Number(selectedOrder.earningXOF || 0).toLocaleString('fr-FR')}{' '}
                    FCFA
                  </p>
                </div>
              </div>

              <div className="flex flex-col justify-center items-center bg-background-secondary p-6">
                <div className="w-32 h-32 bg-background-primary rounded-full flex items-center justify-center mb-4">
                  <MapPin size={48} className="text-text-secondary" strokeWidth={1.5} />
                </div>
                <p className="text-sm text-text-secondary mb-2">Statut GPS</p>
                {gpsWatch != null ? (
                  <div className="mt-4 w-full text-center">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: '#5C6B3C' }}>
                      <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                      GPS diffusé en direct
                    </span>
                    {liveGps?.latitude != null && (
                      <p className="text-[10px] text-text-secondary mt-1 font-mono">
                        {liveGps.latitude.toFixed(5)}, {liveGps.longitude.toFixed(5)}
                      </p>
                    )}
                    {liveGps?.error && (
                      <p className="text-[10px] text-red-500 mt-1">{liveGps.error}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-text-secondary">
                    GPS non démarré
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-4 mt-6">
              {selectedOrder.status !== 'delivering' ? (
                <button
                  onClick={() => handleStartRide(selectedOrder.orderId)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-white transition-colors"
                  style={{ backgroundColor: '#C1652E' }}
                >
                  <Navigation size={18} strokeWidth={1.5} />
                  <span className="text-sm font-medium">Démarrer la course (GPS)</span>
                </button>
              ) : (
                <button
                  onClick={() => handleCompleteDelivery(selectedOrder.orderId)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-white transition-colors"
                  style={{ backgroundColor: '#5C6B3C' }}
                >
                  <Check size={18} strokeWidth={1.5} />
                  <span className="text-sm font-medium">Confirmer la livraison</span>
                </button>
              )}
              <button
                onClick={() => handleRejectOrder(selectedOrder.orderId)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border border-border-light text-text-secondary hover:border-red-500 hover:text-red-500 transition-colors"
              >
                <X size={18} strokeWidth={1.5} />
                <span className="text-sm font-medium">Problème</span>
              </button>
            </div>
          </div>
        )}

        {/* Pending Orders */}
        {pending.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-medium text-text-secondary mb-4 flex items-center gap-2">
              <Clock size={16} strokeWidth={1.5} />
              Courses en attente ({pending.length})
            </h2>
            <div className="space-y-4">
              {pending.map((order) => (
                <div key={order.orderId} className="bg-white border border-border-light p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-mono font-bold text-text-primary">
                          {order.orderId}
                        </p>
                        {typeBadge(order.orderType)}
                      </div>
                      <p className="text-sm text-text-primary">
                        {order.pickupAddress} → {order.dropoffAddress}
                      </p>
                      <p className="text-xs text-text-secondary mt-1">
                        {order.orderType === 'RIDE' ? 'Course passager' : 'Livraison repas'}
                      </p>
                    </div>
                    {getStatusBadge('pending')}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-xs text-text-secondary">
                      <span className="font-mono">
                        {Number(order.earningXOF || 0).toLocaleString('fr-FR')} FCFA
                      </span>
                      <span>•</span>
                      <span className="font-mono">
                        {Number(order.totalAmount || 0).toLocaleString('fr-FR')} FCFA total
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAcceptOrder(order)}
                        className="px-3 py-2 text-xs font-medium text-white transition-colors"
                        style={{ backgroundColor: '#C1652E' }}
                      >
                        Accepter
                      </button>
                      <button
                        onClick={() => handleRejectOrder(order.orderId)}
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
        {!selectedOrder && active.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-medium text-text-secondary mb-4 flex items-center gap-2">
              <Package size={16} strokeWidth={1.5} />
              En cours de livraison ({active.length})
            </h2>
            <div className="space-y-4">
              {active.map((order) => (
                <div key={order.orderId} className="bg-white border border-border-light p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-mono font-bold text-text-primary">
                          {order.orderId}
                        </p>
                        {typeBadge(order.orderType)}
                      </div>
                      <p className="text-sm text-text-primary">
                        {order.pickupAddress} → {order.dropoffAddress}
                      </p>
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
        {completed.length > 0 && (
          <div>
            <h2 className="text-sm font-medium text-text-secondary mb-4 flex items-center gap-2">
              <Check size={16} strokeWidth={1.5} />
              Livrées aujourd'hui ({completed.length})
            </h2>
            <div className="space-y-4">
              {completed.map((order) => (
                <div key={order.orderId} className="bg-white border border-border-light p-4 opacity-60">
                  <div className="flex items-start justify-between mb-3">
                    <p className="text-sm font-mono font-bold text-text-primary">
                      {order.orderId}
                    </p>
                    <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium">
                      Livré
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary">
                    Terminé à{' '}
                    {new Date(order.completedAt).toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DriverDashboard;
