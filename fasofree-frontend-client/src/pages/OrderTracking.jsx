import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Clock, Package, Truck, Home, ArrowLeft, MapPin, Phone, Check } from 'lucide-react';
import Footer from '../components/Footer';

const OrderTracking = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [estimatedTime, setEstimatedTime] = useState(25);

  const steps = [
    { id: 1, label: 'Commande confirmée', icon: CheckCircle },
    { id: 2, label: 'En préparation', icon: Package },
    { id: 3, label: 'En route', icon: Truck },
    { id: 4, label: 'Livré', icon: Home },
  ];

  const statusBadge = {
    label: currentStep === 4 ? 'Livré' : currentStep === 3 ? 'En route' : currentStep === 2 ? 'En préparation' : 'Confirmée'
  };

  const progress = (currentStep / 4) * 100;

  const deliveryAddress = 'Patte d Oie, Ouagadougou';
  const contactPhone = '+226 70 00 00 00';

  // Simulate order progress
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev < 4) {
          setEstimatedTime((prev) => Math.max(0, prev - 5));
          return prev + 1;
        }
        return prev;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

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
            <h1 className="text-lg font-display font-bold text-text-primary">Suivi de commande</h1>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Order Status */}
          <div className="app-panel rounded-xl p-5 mb-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-medium text-text-secondary">Statut de la commande</h2>
              <span className="px-3 py-1 bg-background-secondary text-xs font-medium text-text-secondary">
                {statusBadge.label}
              </span>
            </div>

            <div className="relative">
              <div className="absolute top-0 left-0 w-full h-1 bg-background-secondary">
                <div
                  className="h-full transition-all duration-500"
                  style={{ width: `${progress}%`, backgroundColor: '#C1652E' }}
                />
              </div>
              <div className="flex justify-between mt-4">
                {steps.map((step, index) => (
                  <div key={step.id} className="flex flex-col items-center">
                    <div
                      className={`w-8 h-8 flex items-center justify-center border-2 transition-colors ${
                        index <= currentStep
                          ? 'bg-accent-primary border-accent-primary text-white'
                          : 'bg-background-secondary border-border-light text-text-secondary'
                      }`}
                      style={index <= currentStep ? { backgroundColor: '#C1652E', borderColor: '#C1652E' } : {}}
                    >
                      {index < currentStep ? (
                        <Check size={14} strokeWidth={1.5} />
                      ) : (
                        <span className="text-xs font-medium">{index + 1}</span>
                      )}
                    </div>
                    <span className="text-xs text-text-secondary mt-2">{step.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Estimated Time */}
          <div className="border border-border-light p-4 mb-6">
            <div className="flex items-center gap-3">
              <Clock size={20} className="text-accent-primary" strokeWidth={1.5} />
              <div>
                <p className="text-text-secondary text-xs">Temps estimé</p>
                <p className="text-text-primary font-medium">{estimatedTime}</p>
              </div>
            </div>
          </div>

          {/* Order Details */}
          <div className="border border-border-light p-4 mb-6">
            <h2 className="text-sm font-medium text-text-secondary mb-4">Détails de la commande</h2>

            <div className="space-y-3">
              <div className="flex justify-between text-sm text-text-secondary">
                <span>Cesar Burger x2</span>
                <span className="font-mono text-text-primary">8 000 FCFA</span>
              </div>
              <div className="flex justify-between text-sm text-text-secondary">
                <span>Chicken Sandwich x1</span>
                <span className="font-mono text-text-primary">3 000 FCFA</span>
              </div>
              <div className="flex justify-between text-sm text-text-secondary">
                <span>Frais de livraison</span>
                <span className="font-mono text-text-primary">400 FCFA</span>
              </div>
              <div className="border-t border-border-light pt-3 flex justify-between text-base font-medium text-text-primary">
                <span>Total</span>
                <span className="font-mono text-text-primary">11 400 FCFA</span>
              </div>
            </div>
          </div>

          {/* Delivery Info */}
          <div className="border border-border-light p-4 mb-6">
            <h2 className="text-sm font-medium text-text-secondary mb-4">Informations de livraison</h2>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm text-text-secondary">
                <MapPin size={16} className="text-text-secondary" strokeWidth={1.5} />
                <span>{deliveryAddress}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-text-secondary">
                <Phone size={16} className="text-text-secondary" strokeWidth={1.5} />
                <span>{contactPhone}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/order-history')}
              className="flex-1 px-4 py-3 text-sm font-medium border border-border-light text-text-secondary hover:border-accent-primary hover:text-accent-primary transition-colors"
            >
              Historique
            </button>
            <button
              onClick={() => navigate('/')}
              className="flex-1 px-4 py-3 text-sm font-medium text-white transition-colors"
              style={{ backgroundColor: '#C1652E' }}
            >
              Commander
            </button>
          </div>

          {/* Success Message */}
          {currentStep === 4 && (
            <div className="mt-6 p-4 bg-success/10 border border-success/30 text-center">
              <CheckCircle size={32} className="mx-auto text-success mb-2" strokeWidth={1.5} />
              <p className="text-success font-medium">Commande livrée avec succès!</p>
              <p className="text-text-secondary text-sm mt-1">Merci de votre confiance.</p>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default OrderTracking;
