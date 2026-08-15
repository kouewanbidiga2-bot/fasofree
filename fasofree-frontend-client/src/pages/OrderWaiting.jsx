import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Clock, MapPin, Phone, Check, X } from 'lucide-react';
import { getCurrentPosition, calculateDistanceAndTime, estimateDeliveryTime } from '../services/locationService';

const OrderWaiting = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const orderData = location.state || {};
  
  const [orderStatus, setOrderStatus] = useState('preparing');
  const [estimatedTime, setEstimatedTime] = useState(25);
  const [canConfirmReceipt, setCanConfirmReceipt] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [distance, setDistance] = useState(null);

  useEffect(() => {
    // Get user location and calculate delivery time
    const initLocation = async () => {
      try {
        const position = await getCurrentPosition();
        setUserLocation(position);
        
        // For demo, use restaurant coordinates (in real app, get from order)
        const restaurantCoords = { lat: 12.3714, lng: -1.5197 };
        
        const result = await calculateDistanceAndTime(position, restaurantCoords);
        if (result.distance > 0) {
          setDistance(result.distance);
          const timeEstimate = estimateDeliveryTime(result.distance);
          setEstimatedTime(timeEstimate.totalMinutes);
        }
      } catch (error) {
        console.error('Location error:', error);
        // Fallback to default time
        setEstimatedTime(25);
      }
    };

    initLocation();

    // Simulate order status changes
    const statusTimer = setTimeout(() => {
      setOrderStatus('delivering');
      setCanConfirmReceipt(true);
    }, 15000); // After 15 seconds, show as delivering

    return () => {
      clearTimeout(statusTimer);
    };
  }, []);

  const handleConfirmReceipt = () => {
    navigate('/order-history');
  };

  const handleCancelOrder = () => {
    if (window.confirm('Êtes-vous sûr de vouloir annuler cette commande ?')) {
      navigate('/');
    }
  };

  return (
    <div className="app-page">
      {/* Header */}
      <header className="app-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <h1 className="text-lg font-display font-bold text-text-primary">Suivi de commande</h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Order ID */}
        <div className="app-panel rounded-xl p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-text-secondary">Numéro de commande</p>
              <p className="text-lg font-mono font-bold text-text-primary">{orderData.orderId || 'FF' + Date.now().toString().slice(-8)}</p>
            </div>
            <div className={`px-3 py-1 rounded-full text-xs font-medium ${
              orderStatus === 'preparing' ? 'bg-yellow-100 text-yellow-800' :
              orderStatus === 'delivering' ? 'bg-blue-100 text-blue-800' :
              'bg-green-100 text-green-800'
            }`}>
              {orderStatus === 'preparing' ? 'En préparation' :
               orderStatus === 'delivering' ? 'En livraison' :
               'Livré'}
            </div>
          </div>
        </div>

        {/* Progress Timeline */}
        <div className="app-panel rounded-xl p-6 mb-6">
          <h2 className="text-sm font-medium text-text-secondary mb-6">Progression</h2>
          
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-success flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#5C6B3C' }}>
                <Check size={16} className="text-white" strokeWidth={2} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-text-primary">Commande confirmée</p>
                <p className="text-xs text-text-secondary">Votre paiement a été accepté</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                orderStatus === 'preparing' || orderStatus === 'delivering' || orderStatus === 'delivered'
                  ? 'bg-success text-white'
                  : 'bg-background-secondary text-text-secondary'
              }`} style={{ backgroundColor: orderStatus !== 'pending' ? '#5C6B3C' : undefined }}>
                {orderStatus !== 'pending' ? (
                  <Check size={16} className="text-white" strokeWidth={2} />
                ) : (
                  <Clock size={16} strokeWidth={1.5} />
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-text-primary">En préparation</p>
                <p className="text-xs text-text-secondary">Le restaurant prépare votre commande</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                orderStatus === 'delivering' || orderStatus === 'delivered'
                  ? 'bg-success text-white'
                  : 'bg-background-secondary text-text-secondary'
              }`} style={{ backgroundColor: orderStatus === 'delivering' || orderStatus === 'delivered' ? '#5C6B3C' : undefined }}>
                {orderStatus === 'delivering' || orderStatus === 'delivered' ? (
                  <Check size={16} className="text-white" strokeWidth={2} />
                ) : (
                  <MapPin size={16} strokeWidth={1.5} />
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-text-primary">En livraison</p>
                <p className="text-xs text-text-secondary">Le livreur est en route</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                orderStatus === 'delivered'
                  ? 'bg-success text-white'
                  : 'bg-background-secondary text-text-secondary'
              }`} style={{ backgroundColor: orderStatus === 'delivered' ? '#5C6B3C' : undefined }}>
                {orderStatus === 'delivered' ? (
                  <Check size={16} className="text-white" strokeWidth={2} />
                ) : (
                  <Phone size={16} strokeWidth={1.5} />
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-text-primary">Livré</p>
                <p className="text-xs text-text-secondary">Confirmez la réception</p>
              </div>
            </div>
          </div>
        </div>

        {/* Estimated Time */}
        <div className="app-panel rounded-xl p-6 mb-6">
          <div className="flex items-center gap-3">
            <Clock size={24} className="text-text-secondary" strokeWidth={1.5} />
            <div>
              <p className="text-sm text-text-secondary">Temps estimé</p>
              <p className="text-lg font-mono font-bold text-text-primary">{estimatedTime} min</p>
            </div>
          </div>
        </div>

        {/* Driver Info (shown when delivering) */}
        {orderStatus === 'delivering' && (
          <div className="app-panel rounded-xl p-6 mb-6">
            <h2 className="text-sm font-medium text-text-secondary mb-4">Informations du livreur</h2>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-background-secondary rounded-full flex items-center justify-center">
                <span className="text-lg font-bold text-text-primary">JD</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-text-primary">Jean Diallo</p>
                <p className="text-xs text-text-secondary">Livreur FasoFree</p>
              </div>
              <button className="p-2 bg-background-secondary hover:bg-background-tertiary transition-colors">
                <Phone size={18} className="text-text-primary" strokeWidth={1.5} />
              </button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          {canConfirmReceipt && (
            <button
              onClick={handleConfirmReceipt}
              className="app-action w-full gap-2"
            >
              <Check size={18} strokeWidth={1.5} />
              <span className="text-sm font-medium">Confirmer la réception</span>
            </button>
          )}
          
          <button
            onClick={handleCancelOrder}
            className="app-action-secondary w-full gap-2"
          >
            <X size={18} strokeWidth={1.5} />
            <span className="text-sm font-medium">Annuler la commande</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrderWaiting;
