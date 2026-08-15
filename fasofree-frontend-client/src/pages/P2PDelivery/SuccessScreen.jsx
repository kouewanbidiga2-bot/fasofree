import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import Footer from '../../components/Footer';

const SuccessScreen = ({ orderRef, onReset }) => {
  const navigate = useNavigate();

  return (
    <div className="app-page text-text-primary font-sans">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="app-panel rounded-lg p-8 text-center">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-status-success/15">
            <Check size={28} className="text-status-success" />
          </div>
          <h1 className="text-2xl font-display font-semibold tracking-[-0.03em] text-text-primary">
            Course confirmée !
          </h1>
          <p className="mt-3 text-sm leading-6 text-text-secondary">
            Votre course P2P a bien été enregistrée. Un livreur sera assigné pour
            le ramassage du colis.
          </p>
          <p className="mt-4 font-mono text-sm text-text-primary">
            Référence : {orderRef}
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              className="app-action w-full sm:w-auto gap-2"
              onClick={() => navigate('/')}
            >
              Retour à l'accueil
            </button>
            <button
              type="button"
              className="app-action-secondary w-full sm:w-auto"
              onClick={onReset}
            >
              Envoyer un autre colis
            </button>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default SuccessScreen;
