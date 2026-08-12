/**
 * FasoFree — Page Checkout (Client)
 * Création de commande via API et initiation du paiement
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Phone, CreditCard, ShieldCheck, AlertCircle, Check } from 'lucide-react';
import Footer from '../components/Footer';
import useCartStore from '../store/cartStore';
import useAuthStore from '../store/authStore';
import { getBusinessById } from '../services/businessService';
import { createOrder } from '../services/orderService';
import { initiatePayment, initiateLigdiCashPayin, PAYMENT_METHODS } from '../services/paymentService';

const Checkout = () => {
  const navigate = useNavigate();
  const { items, restaurantId, clearCart, getTotalPrice } = useCartStore();
  const { user } = useAuthStore();
  
  const [restaurant, setRestaurant] = useState(null);
  const [loadingBiz, setLoadingBiz] = useState(true);
  
  const [formData, setFormData] = useState({
    name: user?.fullName || '',
    phone: user?.phone || '',
    address: '',
    notes: '',
  });
  
  const [selectedPayment, setSelectedPayment] = useState('orange_money');
  const [paymentPhone, setPaymentPhone] = useState(user?.phone || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // 1. Charger les infos du commerce (pour les frais de livraison, etc.)
  useEffect(() => {
    if (!restaurantId || items.length === 0) {
      navigate('/cart');
      return;
    }
    const loadBiz = async () => {
      try {
        const biz = await getBusinessById(restaurantId);
        setRestaurant(biz);
      } catch (err) {
        setError("Erreur lors du chargement des informations du restaurant.");
      } finally {
        setLoadingBiz(false);
      }
    };
    loadBiz();
  }, [restaurantId, items, navigate]);

  const subtotal = getTotalPrice();
  // TODO: Frais de livraison réels calculés par le backend selon la distance
  const deliveryFee = 1000; 
  const finalTotal = subtotal + deliveryFee;

  const handleGetCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setFormData({
            ...formData,
            address: `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)} (Position GPS)`,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          });
        },
        () => alert('Impossible de récupérer votre position.')
      );
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.address || !formData.phone) {
      setError("Veuillez remplir l'adresse et le téléphone.");
      return;
    }
    
    setIsSubmitting(true);
    setError('');

    try {
      // 1. Créer la commande
      const orderPayload = {
        businessId: restaurantId,
        totalAmount: finalTotal,
        deliveryLatitude: formData.lat || 12.3714, // Par défaut Ouaga
        deliveryLongitude: formData.lng || -1.5197,
        orderType: 'DELIVERY',
        deliveryFee: deliveryFee,
      };
      
      const order = await createOrder(orderPayload);
      const orderId = order.id;

      // 2. Initier le paiement
      if (selectedPayment === 'ligdicash') {
        await initiateLigdiCashPayin({
          orderId,
          amount: finalTotal,
          customerName: formData.name || 'Client',
          customerEmail: user?.email || 'client@fasofree.bf'
        });
      } else {
        await initiatePayment({
          orderId,
          paymentMethod: selectedPayment,
          phoneNumber: paymentPhone || formData.phone,
        });
      }

      // 3. Vider le panier et rediriger vers le suivi
      clearCart();
      navigate(`/order-tracking?id=${orderId}`);

    } catch (err) {
      setError(err.message || "Une erreur est survenue lors de la commande.");
      setIsSubmitting(false);
    }
  };

  const activePaymentMethod = PAYMENT_METHODS.find(m => m.id === selectedPayment);

  if (loadingBiz) {
    return (
      <div className="min-h-screen bg-background-primary flex items-center justify-center">
        <span className="w-8 h-8 border-4 border-accent-primary/30 border-t-accent-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-primary flex flex-col">
      {/* ─── HEADER ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-background-card/90 backdrop-blur-glass border-b border-border-light">
        <div className="content-wrapper py-4 flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="btn-icon">
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-lg font-bold text-text-primary">Finaliser la commande</h1>
        </div>
      </header>

      <main className="flex-1 content-wrapper py-8">
        {error && (
          <div className="mb-6 p-4 bg-status-errorBg border border-status-error/30 rounded-md text-status-error flex items-center gap-2 animate-fade-in">
            <AlertCircle size={18} /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col lg:flex-row gap-8">
          
          {/* ─── COLONNE GAUCHE (Formulaire) ────────────────────────── */}
          <div className="flex-1 space-y-6">
            
            {/* Adresse */}
            <div className="card p-6">
              <h2 className="text-base font-bold text-text-primary mb-5 flex items-center gap-2 border-b border-border-light pb-3">
                <MapPin size={18} className="text-accent-primary" /> Adresse de livraison
              </h2>
              
              <button
                type="button"
                onClick={handleGetCurrentLocation}
                className="btn-secondary w-full mb-4 gap-2"
              >
                <MapPin size={14} /> Utiliser ma position actuelle
              </button>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase">Adresse complète *</label>
                  <input
                    type="text"
                    required
                    value={formData.address}
                    onChange={e => setFormData({...formData, address: e.target.value})}
                    placeholder="Quartier, Rue, Bâtiment..."
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase">Instructions pour le livreur</label>
                  <input
                    type="text"
                    value={formData.notes}
                    onChange={e => setFormData({...formData, notes: e.target.value})}
                    placeholder="Code portail, interphone, etc."
                    className="input-field"
                  />
                </div>
              </div>
            </div>

            {/* Contact */}
            <div className="card p-6">
              <h2 className="text-base font-bold text-text-primary mb-5 flex items-center gap-2 border-b border-border-light pb-3">
                <Phone size={18} className="text-accent-primary" /> Contact
              </h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase">Nom complet</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase">Téléphone *</label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                    className="input-field"
                  />
                </div>
              </div>
            </div>

            {/* Paiement */}
            <div className="card p-6">
              <h2 className="text-base font-bold text-text-primary mb-5 flex items-center gap-2 border-b border-border-light pb-3">
                <CreditCard size={18} className="text-accent-primary" /> Mode de paiement
              </h2>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                {PAYMENT_METHODS.map(method => (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => setSelectedPayment(method.id)}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      selectedPayment === method.id 
                        ? 'border-accent-primary bg-accent-glow shadow-glow-sm' 
                        : 'border-border-light bg-background-secondary hover:border-border-medium'
                    }`}
                  >
                    <div className="text-2xl mb-2">{method.icon}</div>
                    <p className={`text-xs font-bold ${selectedPayment === method.id ? 'text-accent-primary' : 'text-text-primary'}`}>
                      {method.label}
                    </p>
                  </button>
                ))}
              </div>

              {activePaymentMethod?.requiresPhone && (
                <div className="animate-slide-down">
                  <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase">
                    Numéro de paiement ({activePaymentMethod.label})
                  </label>
                  <input
                    type="tel"
                    required
                    value={paymentPhone}
                    onChange={e => setPaymentPhone(e.target.value)}
                    placeholder="+226 7X XX XX XX"
                    className="input-field border-accent-primary/50 focus:border-accent-primary"
                  />
                  <p className="text-xs text-text-tertiary mt-2 flex items-center gap-1">
                    <ShieldCheck size={12} className="text-status-success" /> Paiement sécurisé via API partenaire
                  </p>
                </div>
              )}
            </div>

          </div>

          {/* ─── COLONNE DROITE (Récapitulatif) ─────────────────────── */}
          <div className="w-full lg:w-[380px] flex-shrink-0">
            <div className="card p-6 sticky top-[88px]">
              <h2 className="text-base font-bold text-text-primary mb-5 border-b border-border-light pb-3">
                Votre commande
              </h2>

              {restaurant && (
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-md bg-background-secondary overflow-hidden">
                    {restaurant.logo || restaurant.imageUrl ? (
                      <img src={restaurant.logo || restaurant.imageUrl} alt={restaurant.name} className="w-full h-full object-cover" />
                    ) : null}
                  </div>
                  <div>
                    <p className="font-bold text-text-primary text-sm">{restaurant.name}</p>
                    <p className="text-text-tertiary text-xs">{restaurant.address}</p>
                  </div>
                </div>
              )}

              <div className="space-y-4 mb-6">
                {items.map(item => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <div className="flex gap-2 text-text-secondary">
                      <span className="font-bold text-text-primary">{item.quantity}x</span>
                      <span className="line-clamp-1">{item.name}</span>
                    </div>
                    <span className="font-mono text-text-primary whitespace-nowrap">
                      {(item.price * item.quantity).toLocaleString()} F
                    </span>
                  </div>
                ))}
              </div>

              <div className="space-y-3 border-t border-border-light pt-4 mb-6">
                <div className="flex justify-between text-sm text-text-secondary">
                  <span>Sous-total</span>
                  <span className="font-mono">{subtotal.toLocaleString()} F</span>
                </div>
                <div className="flex justify-between text-sm text-text-secondary">
                  <span>Frais de livraison</span>
                  <span className="font-mono">{deliveryFee.toLocaleString()} F</span>
                </div>
                <div className="flex justify-between items-end border-t border-border-light pt-4 mt-2">
                  <span className="text-base font-bold text-text-primary">Total</span>
                  <span className="text-xl font-mono font-bold text-accent-primary">
                    {finalTotal.toLocaleString()} FCFA
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary w-full py-4 shadow-elevated text-base"
              >
                {isSubmitting ? (
                  <><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Traitement...</>
                ) : (
                  <><Check size={18} /> Confirmer & Payer</>
                )}
              </button>
              <p className="text-center text-xs text-text-tertiary mt-4 flex justify-center items-center gap-1">
                <ShieldCheck size={12} /> Transaction sécurisée
              </p>
            </div>
          </div>

        </form>
      </main>

      <Footer />
    </div>
  );
};

export default Checkout;
