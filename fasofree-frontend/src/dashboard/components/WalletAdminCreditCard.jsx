/**
 * 💰 Carte « Créditer un portefeuille » — Super Admin (Lot 4, chantier B).
 *
 * Pourquoi : aucun endpoint ne permettait de créditer un portefeuille à la
 * main. Un compte dont la recharge en ligne échoue (ou qui paie hors
 * plateforme) restait donc bloqué, sans recours pour le support.
 *
 * Cette carte s'appuie sur `POST /wallets/admin/credit` (SUPER_ADMIN
 * uniquement). L'écriture est tracée au grand livre ; fournir une
 * `reference` (n° de reçu) rend l'opération IDEMPOTENTE — rejouer la même
 * requête ne crédite pas deux fois.
 *
 * ⚠️ `userRole` est le rôle du PORTEFEUILLE, pas le rôle applicatif : un
 * commerce comme une société de livraison se créditent en `MERCHANT`.
 */
import { useState } from 'react';
import { Plus, Wallet, CheckCircle } from 'lucide-react';
import { adminCreditWallet } from '../../services/walletService';

/** Rôles valides de `wallets_userrole_enum` (à ne pas confondre avec les rôles app). */
const WALLET_ROLES = [
  { value: 'MERCHANT', label: 'Marchand (commerce ou société de livraison)' },
  { value: 'DRIVER', label: 'Livreur' },
  { value: 'COURIER', label: 'Coursier' },
  { value: 'CUSTOMER', label: 'Client' },
  { value: 'SUPER_ADMIN', label: 'Super Admin (plateforme)' },
];

const EMPTY = {
  userId: '',
  userRole: 'MERCHANT',
  amount: '',
  branchId: '',
  reason: '',
  reference: '',
};

const WalletAdminCreditCard = () => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const amount = Number(form.amount);
    if (!form.userId.trim()) {
      setError("L'identifiant utilisateur est obligatoire");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Le montant doit être supérieur à 0');
      return;
    }

    setBusy(true);
    try {
      // On n'envoie que les champs renseignés (une `reference` vide casserait
      // l'idempotence attendue côté serveur, qui génère alors la sienne).
      const payload = {
        userId: form.userId.trim(),
        userRole: form.userRole,
        amount,
      };
      if (form.branchId.trim()) payload.branchId = form.branchId.trim();
      if (form.reason.trim()) payload.reason = form.reason.trim();
      if (form.reference.trim()) payload.reference = form.reference.trim();

      const result = await adminCreditWallet(payload);
      const balance = result?.wallet?.balance;
      setSuccess(
        `Portefeuille crédité de ${amount.toLocaleString('fr-FR')} FCFA${
          balance !== undefined
            ? ` — nouveau solde : ${Number(balance).toLocaleString('fr-FR')} FCFA`
            : ''
        }.`,
      );
      setForm((prev) => ({ ...EMPTY, userRole: prev.userRole }));
    } catch (err) {
      setError(
        err?.response?.data?.message || err?.message || 'Échec du crédit',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Wallet size={16} className="text-accent-primary" />
          <div>
            <p className="text-sm font-bold text-text-primary">
              Créditer un portefeuille
            </p>
            <p className="text-[11px] text-text-tertiary">
              Régulariser un paiement reçu hors plateforme (virement, espèces,
              recharge en échec).
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="btn-secondary gap-1 text-xs"
        >
          <Plus size={13} />
          {open ? 'Fermer' : 'Créditer'}
        </button>
      </div>

      {open && (
        <form onSubmit={submit} className="mt-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-text-secondary uppercase mb-1">
                Identifiant utilisateur
              </label>
              <input
                type="text"
                value={form.userId}
                onChange={set('userId')}
                placeholder="UUID du compte à créditer"
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-text-secondary uppercase mb-1">
                Rôle du portefeuille
              </label>
              <select
                value={form.userRole}
                onChange={set('userRole')}
                className="input-field"
              >
                {WALLET_ROLES.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-text-secondary uppercase mb-1">
                Montant (FCFA)
              </label>
              <input
                type="number"
                min={1}
                value={form.amount}
                onChange={set('amount')}
                placeholder="10000"
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-text-secondary uppercase mb-1">
                Agence (optionnel)
              </label>
              <input
                type="text"
                value={form.branchId}
                onChange={set('branchId')}
                placeholder="Vide = portefeuille global"
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-text-secondary uppercase mb-1">
                Motif (optionnel)
              </label>
              <input
                type="text"
                value={form.reason}
                onChange={set('reason')}
                placeholder="Virement Orange Money reçu le 18/10"
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-text-secondary uppercase mb-1">
                Référence (optionnel)
              </label>
              <input
                type="text"
                value={form.reference}
                onChange={set('reference')}
                placeholder="N° de reçu — évite un double crédit"
                className="input-field"
              />
            </div>
          </div>

          {error && (
            <p className="text-xs text-status-error">{error}</p>
          )}
          {success && (
            <p className="flex items-center gap-1.5 text-xs text-status-success">
              <CheckCircle size={13} />
              {success}
            </p>
          )}

          <div className="flex justify-end">
            <button type="submit" className="btn-primary gap-2" disabled={busy}>
              <Wallet size={14} />
              {busy ? 'Crédit en cours…' : 'Créditer le portefeuille'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default WalletAdminCreditCard;
