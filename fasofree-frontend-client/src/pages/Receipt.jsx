import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Check, Download, Home, ArrowLeft } from 'lucide-react';
import useCartStore from '../store/cartStore';
import useAuthStore from '../store/authStore';

const Receipt = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { clearCart } = useCartStore();
  const { addReceipt } = useAuthStore();
  
  // Get order data from location state or use defaults
  const orderData = location.state || {
    items: [],
    total: 0,
    paymentMethod: 'Orange Money',
    orderId: 'FF' + Date.now().toString().slice(-8)
  };
  
  const [orderDetails] = React.useState({
    id: orderData.orderId || 'FF' + Date.now().toString().slice(-8),
    date: new Date().toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }),
    status: 'Payé',
    paymentMethod: orderData.paymentMethod
  });

  const items = orderData.items || [];
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
  const subtotal =
    num(orderData.subtotal) ??
    items.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0);
  const deliveryFee = num(orderData.deliveryFee) ?? 800;
  const platformFee = num(orderData.platformFee) ?? 100;
  const total = num(orderData.total) ?? subtotal + deliveryFee + platformFee;

  // Save receipt to authStore on mount
  React.useEffect(() => {
    addReceipt({
      orderId: orderDetails.id,
      items,
      subtotal,
      deliveryFee,
      platformFee,
      total,
      paymentMethod: orderDetails.paymentMethod,
      status: orderDetails.status
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const handleBackToHome = () => {
    clearCart();
    navigate('/order-tracking', {
      state: {
        orderId: orderDetails.id
      }
    });
  };

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
            <h1 className="text-lg font-display font-bold text-text-primary">Reçu de commande</h1>
          </div>
        </div>
      </header>

      {/* Receipt Content */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="app-panel rounded-xl p-6 sm:p-8">
          {/* Success Message */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-success rounded-full flex items-center justify-center mx-auto mb-4 shadow-subtle" style={{ backgroundColor: '#5C6B3C' }}>
              <Check size={32} className="text-white" strokeWidth={2} />
            </div>
            <h2 className="text-2xl font-display font-bold text-text-primary mb-2">Commande confirmée !</h2>
            <p className="text-text-secondary">Votre commande a été payée avec succès</p>
          </div>

          {/* Order Details */}
          <div className="border-b border-border-light pb-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm text-text-secondary">Numéro de commande</span>
              <span className="numeric text-sm font-mono font-medium text-text-primary">{orderDetails.id}</span>
            </div>
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm text-text-secondary">Date</span>
              <span className="text-sm font-mono text-text-primary">{orderDetails.date}</span>
            </div>
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm text-text-secondary">Statut</span>
              <span className="text-sm font-medium text-success" style={{ color: '#5C6B3C' }}>{orderDetails.status}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-text-secondary">Méthode de paiement</span>
              <span className="text-sm font-medium text-text-primary">{orderDetails.paymentMethod}</span>
            </div>
          </div>

          {/* Items */}
          <div className="border-b border-border-light pb-6 mb-6">
            <h3 className="text-sm font-medium text-text-secondary mb-4">Articles commandés</h3>
            {items.length > 0 ? (
              items.map((item, index) => (
                <div key={index} className="flex justify-between items-center mb-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-text-primary">{item.name}</p>
                    <p className="text-xs text-text-secondary">Quantité: {item.quantity}</p>
                  </div>
                  <span className="text-sm font-mono text-text-primary">
                    {(item.price * item.quantity).toLocaleString()} FCFA
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-text-secondary">Aucun article</p>
            )}
          </div>

          {/* Summary */}
          <div className="space-y-3 mb-8">
            <div className="flex justify-between items-center">
              <span className="text-sm text-text-secondary">Sous-total</span>
              <span className="text-sm font-mono text-text-primary">{subtotal.toLocaleString()} FCFA</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-text-secondary">Frais de livraison</span>
              <span className="text-sm font-mono text-text-primary">{deliveryFee.toLocaleString()} FCFA</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-text-secondary">Frais de service / Plateforme</span>
              <span className="text-sm font-mono text-text-primary">{platformFee.toLocaleString()} FCFA</span>
            </div>
            <div className="flex justify-between items-center pt-3 border-t border-border-light">
              <span className="text-base font-medium text-text-primary">Total</span>
              <span className="text-base font-mono font-bold text-text-primary">{total.toLocaleString()} FCFA</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4">
            <button
              onClick={handlePrint}
              className="app-action-secondary flex-1 gap-2"
            >
              <Download size={18} strokeWidth={1.5} />
              <span className="text-sm font-medium">Télécharger</span>
            </button>
            <button
              onClick={handleBackToHome}
              className="app-action flex-1 gap-2"
            >
              <Home size={18} strokeWidth={1.5} />
              <span className="text-sm font-medium">Suivre ma commande</span>
            </button>
          </div>
        </div>

        {/* Thank You Message */}
        <div className="text-center mt-6">
          <p className="text-sm text-text-secondary">Merci de votre confiance !</p>
          <p className="text-xs text-text-secondary mt-1">Un email de confirmation a été envoyé à votre adresse.</p>
        </div>
      </div>
    </div>
  );
};

export default Receipt;
