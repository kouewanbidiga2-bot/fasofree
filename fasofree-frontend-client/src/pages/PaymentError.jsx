/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

/**
 * FasoFree — Page « paiement non abouti » (application client).
 *
 * Page dédiée aux ERREURS DE PAIEMENT uniquement (les autres erreurs de
 * commande restent en toast dans Checkout) :
 *  - `reason=init_failed`    : la création/initiation a échoué, la commande
 *    a été annulée côté serveur → retour au panier.
 *  - `reason=returned_failed`: le client est revenu de la passerelle sans
 *    paiement confirmé (annulation ou refus opérateur) → réessai possible.
 *
 * À l'arrivée depuis la passerelle (`returned_failed`), un appel unique à la
 * réconciliation (`GET /payments/status/:id`) redirige vers le suivi si le
 * webhook a confirmé la commande entre-temps : pas de fausse page d'erreur.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Home, Package, ShoppingCart, XCircle } from 'lucide-react';
import api from '../services/api';
import CallSupportButton from '../components/CallSupportButton';
import { PaymentLogo } from '../components/PaymentLogos';

const RETRY_METHODS = [
  { id: 'orange_money', label: 'Orange Money', logo: 'orange' },
  { id: 'moov_money', label: 'Moov Money', logo: 'moov' },
  { id: 'wave', label: 'Wave', logo: 'wave' },
];

const COPY = {
  init_failed: {
    title: 'Paiement indisponible',
    lead: "La passerelle de paiement n'a pas pu être contactée. Votre commande a été annulée et aucun montant ne vous a été débité.",
    note: 'Ces articles sont toujours dans votre panier : vous pouvez repasser commande quand vous voulez.',
  },
  returned_failed: {
    title: 'Paiement non abouti',
    lead: "Vous avez interrompu le paiement, ou votre opérateur a refusé la transaction. Votre commande existe toujours et peut être payée à nouveau.",
    note: "Si un débit est visible alors que la commande n'est pas confirmée, contactez le support avec la référence ci-dessous : nous vérifions et procédons aux éventuels remboursements.",
  },
};

export default function PaymentError() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('orderId');
  const reason = searchParams.get('reason') === 'init_failed' ? 'init_failed' : 'returned_failed';
  const copy = COPY[reason];
  const canRetry = reason === 'returned_failed' && !!orderId;

  const [retrying, setRetrying] = useState(false);
  const reconcileCalled = useRef(false);

  // Retour de passerelle : la commande est peut-être déjà confirmée (webhook
  // arrivé pendant la navigation) — dans ce cas, on redirige vers le suivi
  // au lieu d'afficher une fausse erreur. Un seul appel, échec silencieux.
  useEffect(() => {
    if (!orderId || !canRetry || reconcileCalled.current) return;
    reconcileCalled.current = true;
    api
      .reconcilePayment(orderId)
      .then((result) => {
        if (result?.paid) {
          navigate(`/order-tracking?orderId=${orderId}`, { replace: true });
        }
      })
      .catch(() => undefined);
  }, [orderId, canRetry, navigate]);

  const handleRetry = async (methodId) => {
    if (!orderId || retrying) return;
    setRetrying(true);
    try {
      const result = await api.initiatePayment({ orderId, paymentMethod: methodId });
      if (result?.checkoutUrl) {
        window.location.href = result.checkoutUrl;
        return;
      }
      throw new Error('La passerelle de paiement ne répond pas pour le moment.');
    } catch (err) {
      const msg = Array.isArray(err?.message) ? err.message[0] : err?.message;
      toast.error(msg || 'Paiement impossible pour le moment. Réessayez plus tard.');
      setRetrying(false);
    }
  };

  return (
    <div className="app-page">
      <div className="max-w-xl mx-auto px-4 py-10">
        <div className="bg-background-card border border-border-light rounded-2xl p-6 sm:p-8 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10">
            <XCircle size={28} className="text-red-500" strokeWidth={1.5} />
          </div>

          <h1 className="text-xl font-display font-bold text-text-primary mb-2">{copy.title}</h1>
          <p className="text-sm text-text-secondary leading-relaxed mb-4">{copy.lead}</p>
          <p className="text-xs text-text-secondary leading-relaxed mb-6">{copy.note}</p>

          {orderId && (
            <p className="mb-6">
              <span className="inline-flex items-center gap-2 rounded-full border border-border-light bg-background-secondary px-3 py-1 text-xs text-text-secondary">
                Référence commande
                <code className="font-mono text-text-primary" title={orderId}>
                  {orderId.slice(0, 8)}
                </code>
              </span>
            </p>
          )}

          {canRetry && (
            <div className="mb-6">
              <p className="text-sm font-medium text-text-primary mb-3">
                Réessayer le paiement
              </p>
              <div className="flex items-center justify-center gap-3">
                {RETRY_METHODS.map((method) => (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => handleRetry(method.id)}
                    disabled={retrying}
                    aria-label={`Payer avec ${method.label}`}
                    className="flex flex-col items-center gap-1.5 rounded-xl border border-border-light bg-background-primary px-4 py-3 min-w-[5.5rem] hover:border-accent-primary/50 hover:bg-background-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="h-6 w-10">
                      <PaymentLogo method={method.logo} />
                    </span>
                    <span className="text-xs font-medium text-text-primary">{method.label}</span>
                  </button>
                ))}
              </div>
              {retrying && (
                <p className="mt-3 text-xs text-text-secondary animate-pulse">
                  Ouverture de la page de paiement…
                </p>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-3">
            {reason === 'init_failed' && (
              <button
                type="button"
                onClick={() => navigate('/cart', { replace: true })}
                className="inline-flex items-center gap-2 rounded-lg bg-accent-primary text-white px-4 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity"
              >
                <ShoppingCart size={16} strokeWidth={1.5} />
                Reprendre mon panier
              </button>
            )}
            {canRetry && (
              <button
                type="button"
                onClick={() => navigate(`/order-tracking?orderId=${orderId}`)}
                className="inline-flex items-center gap-2 rounded-lg border border-accent-primary/40 text-accent-primary px-4 py-2.5 text-sm font-medium hover:bg-accent-primary/5 transition-colors"
              >
                <Package size={16} strokeWidth={1.5} />
                Suivre la commande
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-2 rounded-lg border border-border-light text-text-secondary px-4 py-2.5 text-sm font-medium hover:bg-background-secondary transition-colors"
            >
              <Home size={16} strokeWidth={1.5} />
              Accueil
            </button>
            <CallSupportButton variant="outline" className="py-2.5 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
