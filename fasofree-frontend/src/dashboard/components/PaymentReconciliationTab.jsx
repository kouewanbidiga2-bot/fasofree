import React, { useState } from 'react';
import { Search, RefreshCw, BadgeCheck, AlertCircle } from 'lucide-react';
import { reconcilePaymentAdmin } from '../../services/paymentService';

/**
 * Réconciliation paiements (ADMIN / SUPER_ADMIN / SUPPORT).
 * Interroge GeniusPay via le backend et affiche l'état réel, sans jamais
 * afficher "payé" si l'agrégateur n'a pas encaissé.
 */
const PaymentReconciliationTab = () => {
  const [orderId, setOrderId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const reconcile = async (e) => {
    e.preventDefault();
    const id = orderId.trim();
    if (!id) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await reconcilePaymentAdmin(id);
      setResult(res);
    } catch (err) {
      const status = err?.response?.status;
      setError(
        status === 403
          ? 'Accès refusé à la réconciliation.'
          : status === 404
            ? 'Commande introuvable.'
            : 'Réconciliation impossible (agrégateur injoignable ?).',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-text-primary">Réconciliation paiements</h2>
        <p className="text-sm text-text-secondary">
          Contrôle temps réel d'une commande auprès de GeniusPay
        </p>
      </div>

      <form
        onSubmit={reconcile}
        className="bg-background-card border border-border-light rounded-xl p-4"
      >
        <label className="block text-xs text-text-secondary mb-2">
          Identifiant de commande
        </label>
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"
            />
            <input
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              placeholder="UUID de la commande"
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-background-secondary border border-border-light text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !orderId.trim()}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-accent-primary text-white text-sm disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Vérification…' : 'Réconcilier'}
          </button>
        </div>
      </form>

      {error && (
        <div className="flex items-center gap-2 bg-status-errorBg border border-status-error/30 rounded-lg p-4 text-sm text-status-error">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {result && (
        <div className="bg-background-card border border-border-light rounded-xl p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-text-secondary mb-1">Statut</p>
            <p className="text-text-primary font-semibold">{result.status}</p>
          </div>
          <div>
            <p className="text-xs text-text-secondary mb-1">Payé</p>
            <p
              className={
                result.paid
                  ? 'text-status-success font-semibold'
                  : 'text-status-warning font-semibold'
              }
            >
              {result.paid ? 'Oui' : 'Non'}
            </p>
          </div>
          <div>
            <p className="text-xs text-text-secondary mb-1">
              Référence
            </p>
            <p className="text-text-secondary">{result.reference || '—'}</p>
          </div>
          <div className="md:col-span-3 text-xs text-text-secondary flex items-center gap-2">
            <BadgeCheck size={14} />
            Le paiement n'est jamais confirmé sans encaissement vérifié.
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentReconciliationTab;
