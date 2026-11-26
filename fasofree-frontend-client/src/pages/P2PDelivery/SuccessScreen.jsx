/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Copy, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import Footer from '../../components/Footer';
import { formatTrackingReference } from '../../utils/trackingReference';

const SuccessScreen = ({ orderRef, trackingToken, trackingReference, onReset }) => {
  const navigate = useNavigate();
  const trackingUrl = trackingToken ? `${window.location.origin}/track/${trackingToken}` : '';
  const displayReference = formatTrackingReference(trackingReference);

  const copyTrackingValue = async (value, label) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copié.`);
    } catch {
      window.prompt(label, value);
    }
  };

  return (
    <div className="app-page text-text-primary font-sans">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="app-panel rounded-lg p-8 text-center">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-status-success/15">
            <Check size={28} className="text-status-success" />
          </div>
          <h1 className="text-2xl font-display font-semibold tracking-[-0.03em] text-text-primary">
            Demande enregistrée
          </h1>
          <p className="mt-3 text-sm leading-6 text-text-secondary">
            Suivez le paiement et le ramassage dans le détail de votre livraison.
          </p>
          <p className="mt-4 break-words font-mono text-sm text-text-primary">
            {displayReference ? `Numéro de suivi · ${displayReference}` : `Référence · ${orderRef}`}
          </p>
          {displayReference && (
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button type="button" className="app-action-secondary gap-2" onClick={() => copyTrackingValue(displayReference, 'Numéro de suivi')}>
                <Copy size={15} aria-hidden="true" /> Copier le numéro
              </button>
              <button type="button" className="app-action" onClick={() => trackingToken ? navigate(`/track/${encodeURIComponent(trackingToken)}`) : navigate('/suivre', { state: { reference: trackingReference } })}>
                Suivre sur la carte
              </button>
            </div>
          )}
          {trackingUrl && (
            <div className="mt-7 rounded-xl border border-border-subtle bg-background-secondary p-4 text-left">
              <p className="text-sm font-medium text-text-primary">Partager le suivi avec le receveur</p>
              <p className="mt-1 break-all text-xs leading-5 text-text-secondary">Le receveur peut ouvrir ce lien sans créer de compte. Il peut suivre la course, mais seule la personne autorisée confirme la réception.</p>
              <div className="mt-3 flex flex-col sm:flex-row gap-2">
                <button type="button" className="app-action-secondary flex-1 gap-2" onClick={() => copyTrackingValue(trackingUrl, 'Lien de suivi')}><Copy size={15} /> Copier le lien</button>
                <a className="app-action flex-1 gap-2 text-center" href={trackingUrl} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Ouvrir le suivi</a>
              </div>
            </div>
          )}
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
