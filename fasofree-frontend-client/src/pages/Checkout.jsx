import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Phone, CreditCard, Loader2, Truck, ShoppingBag, Utensils } from 'lucide-react';
import Footer from '../components/Footer';
import { PaymentLogo, paymentMethods } from '../components/PaymentLogos';
import ImageWithFallback from '../components/ImageWithFallback';
import useCartStore from '../store/cartStore';
import useAuthStore from '../store/authStore';
import { api } from '../services/api';
import {
  fetchQuote,
  getCartSubtotal,
  DEFAULT_DELIVERY_COORDS,
} from '../services/pricingService';

const FULFILLMENT_OPTIONS = [
  { id: 'DELIVERY', label: 'Me faire livrer', icon: Truck, description: 'Livraison à votre adresse' },
  { id: 'PICKUP', label: 'Venir récupérer', icon: ShoppingBag, description: 'À emporter' },
  { id: 'DINE_IN', label: 'Manger sur place', icon: Utensils, description: 'Consommation au restaurant' },
];

const Checkout = () => {
  const navigate = useNavigate();
  const { items, restaurantId } = useCartStore();
  const { addOrder } = useAuthStore();
  const [restaurant, setRestaurant] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    notes: '',
    tableNumber: '',
    numberOfGuests: '',
  });
  const [useCurrentLocation, setUseCurrentLocation] = useState(false);
  const [deliveryCoords, setDeliveryCoords] = useState(null);
  const [fulfillmentType, setFulfillmentType] = useState('DELIVERY');

  const subtotal = getCartSubtotal(items);
  const isDelivery = fulfillmentType === 'DELIVERY';

  const [quote, setQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  useEffect(() => {
    if (!restaurantId) return;
    let cancelled = false;
    api.getBusiness(restaurantId).then((b) => {
      if (!cancelled) {
        setRestaurant({ id: b.id, name: b.name, latitude: b.latitude, longitude: b.longitude, deliveryFee: b.deliveryFee });
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [restaurantId]);

  useEffect(() => {
    if (!isDelivery) {
      setQuote({ deliveryFee: 0, platformFee: 100, total: subtotal + 100 });
      return;
    }
    let cancelled = false;
    setQuoteLoading(true);
    fetchQuote({
      restaurant,
      items,
      deliveryCoords: deliveryCoords ?? DEFAULT_DELIVERY_COORDS,
    })
      .then((result) => {
        if (!cancelled) setQuote(result);
      })
      .finally(() => {
        if (!cancelled) setQuoteLoading(false);
      });
    return () => { cancelled = true; };
  }, [restaurantId, items, deliveryCoords, useCurrentLocation, isDelivery, subtotal]);

  const deliveryFee = isDelivery ? (quote?.deliveryFee ?? 0) : 0;
  const platformFee = quote?.platformFee ?? 0;
  const finalTotal = quote?.total ?? subtotal;

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    const paymentMethodRaw = e.target.payment?.value || 'orange';
    const paymentMethodMap = {
      orange: 'ORANGE_MONEY',
      moov: 'MOOV_MONEY',
      telecel: 'TELECEL_MONEY',
      wave: 'WAVE',
      visa: 'CARD',
      mastercard: 'CARD',
    };
    const paymentMethod = paymentMethodMap[paymentMethodRaw] || paymentMethodRaw.toUpperCase();
    const coords = deliveryCoords || DEFAULT_DELIVERY_COORDS;

    setSubmitting(true);
    try {
      const orderItems = items.map((item) => ({
        productId: item.id,
        productName: item.name,
        quantity: item.quantity,
        unitPrice: item.price,
      }));

      const payload = {
        businessId: restaurantId,
        totalAmount: subtotal,
        items: orderItems,
        orderType: 'MERCHANT',
        fulfillmentType,
        fulfillmentDetails: { notes: formData.notes || undefined },
      };

      if (isDelivery) {
        payload.deliveryLatitude = coords.latitude;
        payload.deliveryLongitude = coords.longitude;
      }
      if (fulfillmentType === 'DINE_IN' && formData.tableNumber) {
        payload.fulfillmentDetails.tableNumber = formData.tableNumber;
      }
      if (fulfillmentType === 'DINE_IN' && formData.numberOfGuests) {
        payload.fulfillmentDetails.numberOfGuests = Number(formData.numberOfGuests);
      }

      const order = await api.createOrder(payload);

      addOrder({
        id: order.id,
        restaurant: restaurant?.name || 'Restaurant',
        items,
        subtotal,
        deliveryFee,
        platformFee,
        total: finalTotal,
        address: isDelivery ? formData.address : 'À récupérer',
        phone: formData.phone,
        paymentMethod,
        fulfillmentType,
        status: order.status || 'pending',
      });

      try {
        const payResult = await api.initiatePayment({
          orderId: order.id,
          paymentMethod,
          phoneNumber: formData.phone || undefined,
        });

        if (payResult?.checkoutUrl) {
          window.location.href = payResult.checkoutUrl;
          return;
        }
      } catch (payErr) {
        console.warn('Payment initiate skipped (mock or provider unavailable):', payErr?.message);
      }

      navigate('/receipt', {
        replace: true,
        state: {
          orderId: order.id,
          items,
          subtotal,
          deliveryFee,
          platformFee,
          total: finalTotal,
          paymentMethod,
          status: order.status,
          fulfillmentType,
        },
      });
    } catch (err) {
      console.error('Order creation failed:', err);
      alert(err.message || 'Erreur lors de la commande. Veuillez réessayer.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGetCurrentLocation = () => {
    setUseCurrentLocation(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setDeliveryCoords({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
          setFormData({ ...formData, address: 'Position actuelle (GPS)' });
        },
        (error) => {
          console.error('Error getting location:', error);
          alert('Impossible de récupérer votre position');
        }
      );
    }
  };

  return (
    <div className="app-page">
      <header className="app-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-background-secondary transition-colors"
            >
              <ArrowLeft size={18} className="text-text-primary" strokeWidth={1.5} />
            </button>
            <h1 className="text-lg font-display font-bold text-text-primary">Commander</h1>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit}>
              {/* Fulfillment Type */}
              <div className="app-panel rounded-lg p-5 mb-6">
                <h2 className="text-sm font-medium text-text-secondary mb-4">Comment souhaitez-vous votre commande ?</h2>
                <div className="grid grid-cols-3 gap-3">
                  {FULFILLMENT_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    const isActive = fulfillmentType === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setFulfillmentType(opt.id)}
                        className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                          isActive
                            ? 'border-accent-primary bg-accent-primary/5'
                            : 'border-border-light bg-background-secondary hover:border-border-medium'
                        }`}
                      >
                        <Icon size={24} className={isActive ? 'text-accent-primary' : 'text-text-secondary'} strokeWidth={1.5} />
                        <span className={`text-sm font-medium ${isActive ? 'text-accent-primary' : 'text-text-primary'}`}>
                          {opt.label}
                        </span>
                        <span className="text-xs text-text-tertiary text-center">{opt.description}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Delivery Address — only for DELIVERY */}
              {isDelivery && (
                <div className="app-panel rounded-lg p-5 mb-6">
                  <h2 className="text-sm font-medium text-text-secondary mb-6 flex items-center gap-2">
                    <MapPin size={16} className="text-accent-primary" strokeWidth={1.5} />
                    Adresse de livraison
                  </h2>

                  <button
                    className="app-action-secondary w-full mb-4"
                    onClick={handleGetCurrentLocation}
                    type="button"
                  >
                    Utiliser ma position actuelle
                  </button>

                  <div className="mb-4">
                    <label className="block text-xs text-text-secondary mb-2">Adresse complète</label>
                    <input
                      type="text"
                      placeholder="Quartier, rue, numéro..."
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      required
                      className="app-input"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-text-secondary mb-2">Instructions de livraison (optionnel)</label>
                    <input
                      type="text"
                      placeholder="Ex: Sonnette en panne, code d'accès..."
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="app-input"
                    />
                  </div>
                </div>
              )}

              {/* Pickup info */}
              {fulfillmentType === 'PICKUP' && (
                <div className="app-panel rounded-lg p-5 mb-6">
                  <h2 className="text-sm font-medium text-text-secondary mb-4 flex items-center gap-2">
                    <ShoppingBag size={16} className="text-accent-primary" strokeWidth={1.5} />
                    Récupération
                  </h2>
                  <p className="text-sm text-text-secondary mb-3">
                    Récupérez votre commande au restaurant. Un code QR vous sera fourni.
                  </p>
                  <div>
                    <label className="block text-xs text-text-secondary mb-2">Instructions (optionnel)</label>
                    <input
                      type="text"
                      placeholder="Ex: Je arrive dans 15 min..."
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="app-input"
                    />
                  </div>
                </div>
              )}

              {/* Dine-in info */}
              {fulfillmentType === 'DINE_IN' && (
                <div className="app-panel rounded-lg p-5 mb-6">
                  <h2 className="text-sm font-medium text-text-secondary mb-6 flex items-center gap-2">
                    <Utensils size={16} className="text-accent-primary" strokeWidth={1.5} />
                    Sur place
                  </h2>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-xs text-text-secondary mb-2">Numéro de table (optionnel)</label>
                      <input
                        type="text"
                        placeholder="Ex: 5"
                        value={formData.tableNumber}
                        onChange={(e) => setFormData({ ...formData, tableNumber: e.target.value })}
                        className="app-input"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-text-secondary mb-2">Nombre de convives</label>
                      <input
                        type="number"
                        placeholder="Ex: 2"
                        min="1"
                        value={formData.numberOfGuests}
                        onChange={(e) => setFormData({ ...formData, numberOfGuests: e.target.value })}
                        className="app-input"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-text-secondary mb-2">Demande spéciale (optionnel)</label>
                    <input
                      type="text"
                      placeholder="Ex: Alliance d'allergie, chaise bébé..."
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="app-input"
                    />
                  </div>
                </div>
              )}

              {/* Contact Info */}
              <div className="app-panel rounded-lg p-5 mb-6">
                <h2 className="text-sm font-medium text-text-secondary mb-6 flex items-center gap-2">
                  <Phone size={16} className="text-accent-primary" strokeWidth={1.5} />
                  Informations de contact
                </h2>

                <div className="mb-4">
                  <label className="block text-xs text-text-secondary mb-2">Nom complet</label>
                  <input
                    type="text"
                    placeholder="Votre nom"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="app-input"
                  />
                </div>

                <div>
                  <label className="block text-xs text-text-secondary mb-2">Numéro de téléphone</label>
                  <input
                    type="text"
                    placeholder="+226 XX XX XX XX"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    required
                    className="app-input"
                  />
                </div>
              </div>

              {/* Payment Method */}
              <div className="app-panel rounded-lg p-5 mb-6">
                <h2 className="text-sm font-medium text-text-secondary mb-6 flex items-center gap-2">
                  <CreditCard size={16} className="text-accent-primary" strokeWidth={1.5} />
                  Mode de paiement
                </h2>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {paymentMethods.map((method) => (
                    <label key={method.id} className="relative cursor-pointer group">
                      <input
                        type="radio"
                        name="payment"
                        value={method.id}
                        className="sr-only peer"
                        required
                      />
                      <div className="relative flex min-h-[104px] flex-col justify-between rounded-md border border-border-light bg-background-secondary p-3 transition duration-200 hover:-translate-y-0.5 hover:border-border-medium hover:shadow-subtle peer-checked:border-accent-primary peer-checked:bg-white peer-focus-visible:ring-2 peer-focus-visible:ring-accent-primary peer-focus-visible:ring-offset-2">
                        <div className="h-10 w-full">
                          <PaymentLogo method={method.id} />
                        </div>
                        <span className="mt-3 text-xs font-semibold text-text-secondary group-has-[:checked]:text-accent-primary">{method.name}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <button type="submit" className="app-action w-full mt-6" disabled={submitting}>
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 size={18} className="animate-spin" strokeWidth={1.5} />
                    Envoi en cours…
                  </span>
                ) : (
                  'Confirmer la commande'
                )}
              </button>
            </form>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="app-panel sticky top-24 rounded-lg p-5">
              <h2 className="text-sm font-medium text-text-secondary mb-6">Récapitulatif</h2>

              {restaurant && (
                <div className="flex items-center gap-3 mb-4 pb-4 border-b border-border-light">
                  <ImageWithFallback
                    src={restaurant.logo}
                    alt={restaurant.name}
                    className="w-10 h-10 object-cover rounded-photo"
                  />
                  <div>
                    <h3 className="font-medium text-text-primary text-sm">{restaurant.name}</h3>
                    <p className="text-xs text-text-secondary">{restaurant.deliveryTime}</p>
                  </div>
                </div>
              )}

              <div className="mb-2">
                <span className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium bg-accent-primary/10 text-accent-primary rounded">
                  {FULFILLMENT_OPTIONS.find(o => o.id === fulfillmentType)?.icon && React.createElement(
                    FULFILLMENT_OPTIONS.find(o => o.id === fulfillmentType).icon,
                    { size: 12, strokeWidth: 1.5 }
                  )}
                  {FULFILLMENT_OPTIONS.find(o => o.id === fulfillmentType)?.label}
                </span>
              </div>

              <div className="space-y-3 mb-4 mt-3">
                {items.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-text-secondary">
                      {item.name} x{item.quantity}
                    </span>
                    <span className="font-mono text-text-primary">
                      {(item.price * item.quantity).toLocaleString()} FCFA
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-t border-border-light pt-3 space-y-3">
                <div className="flex justify-between text-sm text-text-secondary">
                  <span>Sous-total</span>
                  <span className="font-mono text-text-primary">{subtotal.toLocaleString()} FCFA</span>
                </div>
                {isDelivery && (
                  <div className="flex justify-between text-sm text-text-secondary">
                    <span>Frais de livraison</span>
                    <span className="font-mono text-text-primary">
                      {quoteLoading ? '…' : `${deliveryFee.toLocaleString()} FCFA`}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm text-text-secondary">
                  <span>Frais de service</span>
                  <span className="font-mono text-text-primary">
                    {quoteLoading ? '…' : `${platformFee.toLocaleString()} FCFA`}
                  </span>
                </div>
                <div className="border-t border-border-light pt-3 flex justify-between text-base font-medium text-text-primary">
                  <span>Total</span>
                  <span className="font-mono text-text-primary">
                    {quoteLoading ? '…' : `${finalTotal.toLocaleString()} FCFA`}
                  </span>
                </div>
                {quoteLoading && (
                  <p className="flex items-center gap-2 text-xs text-text-secondary">
                    <Loader2 size={14} className="animate-spin" strokeWidth={1.5} />
                    Calcul du prix…
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Checkout;
