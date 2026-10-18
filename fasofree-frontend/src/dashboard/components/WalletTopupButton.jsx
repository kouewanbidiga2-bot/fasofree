/**
 * 💳 Bouton « Recharger » + modale de recharge du portefeuille (Lot 4).
 *
 * Pourquoi ce composant : le back-office n'exposait AUCUN moyen de recharger un
 * portefeuille. Le service `/payments/topup` n'était appelé que depuis l'app
 * cliente — et encore, sans redirection vers la page de paiement, donc sans
 * encaissement. Un marchand sans vente encaissée (ou une agence) ne pouvait
 * donc jamais financer une campagne push.
 *
 * Le rôle du portefeuille (marchand / livreur / client / agence) est déduit
 * CÔTÉ SERVEUR à partir du JWT : il n'y a rien à choisir ici. Le crédit est
 * appliqué par le webhook GeniusPay dès confirmation du paiement, jamais par
 * cette interface.
 */
import { useState } from 'react';
import { Plus } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { topupWallet } from '../../services/paymentService';

/** Montants proposés par défaut (FCFA). */
const PRESETS = [1000, 5000, 10000, 25000];
const MIN_AMOUNT = 100;

const WalletTopupButton = ({
  label = 'Recharger le portefeuille',
  className = '',
  branchId,
}) => {
  const user = useAuthStore((state) => state.user);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(5000);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const close = () => {
    if (busy) return;
    setOpen(false);
    setError('');
  };

  const submit = async () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value < MIN_AMOUNT) {
      setError(`Montant minimum : ${MIN_AMOUNT} FCFA`);
      return;
    }

    setBusy(true);
    setError('');
    try {
      const payload = await topupWallet({
        amount: value,
        customerName: user?.fullName || user?.name || 'Compte FasoFree',
        customerEmail: user?.email || 'client@fasofree.bf',
        // 🏷️ Si une agence est sélectionnée, la recharge crédite SON
        // portefeuille ; sinon le portefeuille global du compte.
        ...(branchId ? { branchId } : {}),
      });

      // 🔗 Sans redirection, aucun paiement n'est encaissé : le portefeuille
      // ne serait jamais crédité. On suit l'URL renvoyée par GeniusPay.
      const checkoutUrl = payload?.checkoutUrl || payload?.paymentUrl;
      if (!checkoutUrl) {
        throw new Error("GeniusPay n'a pas renvoyé d'URL de paiement");
      }
      window.location.href = checkoutUrl;
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          'Échec de la recharge',
      );
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 rounded-lg border border-accent-primary/40 px-3 py-1.5 text-xs font-semibold text-accent-primary transition-colors hover:bg-accent-primary/10 ${className}`}
      >
        <Plus size={13} />
        {label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={close}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-border-light bg-background-card p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-1 text-base font-bold text-text-primary">
              Recharger le portefeuille
            </h3>
            <p className="mb-4 text-xs text-text-secondary">
              Paiement sécurisé via GeniusPay (Orange Money, Moov Money, Wave).
              Le solde est crédité dès la confirmation du paiement.
            </p>

            <div className="mb-3 flex flex-wrap gap-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setAmount(preset)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    Number(amount) === preset
                      ? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
                      : 'border-border-light text-text-secondary hover:bg-background-secondary'
                  }`}
                >
                  {preset.toLocaleString('fr-FR')} F
                </button>
              ))}
            </div>

            <label className="mb-1 block text-xs font-semibold uppercase text-text-secondary">
              Montant (FCFA)
            </label>
            <input
              type="number"
              min={MIN_AMOUNT}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="input-field mb-3"
            />

            {error && <p className="mb-3 text-xs text-status-error">{error}</p>}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={close}
                disabled={busy}
                className="rounded-lg px-4 py-2 text-sm text-text-secondary hover:bg-background-secondary disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={busy || Number(amount) < MIN_AMOUNT}
                className="rounded-lg bg-accent-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {busy ? 'Redirection…' : 'Payer maintenant'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default WalletTopupButton;
