import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, Plus, Minus, ShoppingBag, Loader2 } from 'lucide-react';
import { Button } from '../components/ui';
import Footer from '../components/Footer';
import useCartStore from '../store/cartStore';
import api from '../services/api';
import { fetchQuote, getCartSubtotal } from '../services/pricingService';
import ImageWithFallback from '../components/ImageWithFallback';

const Cart = () => {
  const navigate = useNavigate();
  const { items, restaurantId, updateQuantity, removeItem, clearCart } = useCartStore();
  const [restaurant, setRestaurant] = useState(null);
  const subtotal = getCartSubtotal(items);

  useEffect(() => {
    if (!restaurantId) { setRestaurant(null); return; }
    let cancelled = false;
    api.getBusiness(restaurantId)
      .then((b) => { if (!cancelled) setRestaurant(b); })
      .catch(() => { if (!cancelled) setRestaurant(null); });
    return () => { cancelled = true; };
  }, [restaurantId]);

  // 💬 Devis tarifaire : les frais de livraison et plateforme viennent de l'API
  const [quote, setQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  useEffect(() => {
    if (items.length === 0) {
      setQuote(null);
      return;
    }
    let cancelled = false;
    setQuoteLoading(true);
    fetchQuote({ restaurant, items })
      .then((result) => {
        if (!cancelled) setQuote(result);
      })
      .finally(() => {
        if (!cancelled) setQuoteLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [restaurantId, items]);

  const deliveryFee = quote?.deliveryFee ?? 0;
  const platformFee = quote?.platformFee ?? 0;
  const finalTotal = quote?.total ?? subtotal;

  if (items.length === 0) {
    return (
      <div className="app-page flex flex-col items-center justify-center p-4">
        <div className="app-panel rounded-xl p-8 text-center">
          <ShoppingBag size={48} className="mx-auto text-text-secondary mb-4" strokeWidth={1.5} />
          <h2 className="text-lg font-display font-medium text-text-primary mb-2">Votre panier est vide</h2>
          <p className="text-text-secondary text-sm mb-6">Ajoutez des plats pour commencer</p>
          <button onClick={() => navigate('/')} className="app-action">
            Explorer les restaurants
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-page">
      {/* Header */}
      <header className="app-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-background-secondary transition-colors"
            >
              <ArrowLeft size={18} className="text-text-primary" strokeWidth={1.5} />
            </button>
            <h1 className="text-lg font-display font-bold text-text-primary">Mon Panier</h1>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2">
            {restaurant && (
              <div className="app-panel mb-5 rounded-lg p-4">
                <div className="flex items-center gap-3">
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
              </div>
            )}

            {items.map((item) => (
              <div key={item.id} className="app-panel mb-4 rounded-lg p-4">
                <div className="flex gap-4">
                  <ImageWithFallback
                    src={item.image}
                    alt={item.name}
                    className="w-20 h-20 object-cover rounded-photo"
                  />
                  <div className="flex-1">
                    <h3 className="font-medium text-text-primary text-base">{item.name}</h3>
                    <p className="text-sm text-text-secondary mt-1 line-clamp-2">{item.description}</p>
                    <p className="text-base font-mono text-text-primary mt-2">
                      {item.price.toLocaleString()} FCFA
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-4 pt-4 border-t border-border-light">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      className="w-8 h-8 flex items-center justify-center rounded-md bg-background-secondary border border-border-light hover:border-accent-primary transition-colors"
                    >
                      <Minus size={14} className="text-text-primary" strokeWidth={1.5} />
                    </button>
                    <span className="w-8 text-center font-medium text-text-primary text-sm">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      className="w-8 h-8 flex items-center justify-center rounded-md bg-background-secondary border border-border-light hover:border-accent-primary transition-colors"
                    >
                      <Plus size={14} className="text-text-primary" strokeWidth={1.5} />
                    </button>
                  </div>

                  <button
                    onClick={() => removeItem(item.id)}
                    className="p-2 text-text-secondary hover:text-error transition-colors"
                  >
                    <Trash2 size={16} strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            ))}

            <button
              onClick={() => clearCart()}
              className="mt-4 text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              Vider le panier
            </button>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="app-panel sticky top-24 rounded-lg p-5">
              <h2 className="text-sm font-medium text-text-secondary mb-6">Récapitulatif</h2>

              <div className="space-y-3">
                <div className="flex justify-between text-sm text-text-secondary">
                  <span>Sous-total</span>
                  <span className="font-mono text-text-primary">{subtotal.toLocaleString()} FCFA</span>
                </div>
                <div className="flex justify-between text-sm text-text-secondary">
                  <span>Frais de livraison</span>
                  <span className="font-mono text-text-primary">
                    {quoteLoading ? '…' : `${deliveryFee.toLocaleString()} FCFA`}
                  </span>
                </div>
                <div className="flex justify-between text-sm text-text-secondary">
                  <span>Frais de service / Plateforme</span>
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
              </div>

              {quoteLoading && (
                <p className="mt-3 flex items-center gap-2 text-xs text-text-secondary">
                  <Loader2 size={14} className="animate-spin" strokeWidth={1.5} />
                  Calcul du prix de livraison…
                </p>
              )}

              {restaurant && subtotal < restaurant.minOrder && (
                <div className="mt-4 rounded-md border border-warning/30 bg-warning/10 p-3">
                  <p className="text-xs text-warning">
                    Minimum de commande: {restaurant.minOrder.toLocaleString()} FCFA
                  </p>
                </div>
              )}

              <button
                onClick={() => navigate('/checkout')}
                disabled={restaurant && subtotal < restaurant.minOrder}
                className="app-action w-full mt-6"
              >
                Passer la commande
              </button>

              <p className="text-xs text-text-secondary text-center mt-4">
                Paiement sécurisé avec Wave, Orange Money, Moov Money
              </p>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Cart;
