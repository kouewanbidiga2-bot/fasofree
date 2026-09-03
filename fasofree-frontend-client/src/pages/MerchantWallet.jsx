import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Wallet, ArrowUpRight, ArrowDownLeft, TrendingUp, Loader2, CreditCard, X, AlertCircle, CheckCircle2, Smartphone } from 'lucide-react';
import api from '../services/api';

const PROVIDERS = [
  { value: 'ORANGE_MONEY', label: 'Orange Money', color: '#FF6600' },
  { value: 'MOOV_MONEY', label: 'Moov Money', color: '#0066FF' },
  { value: 'WAVE', label: 'Wave', color: '#1DC3F0' },
];

function formatFCFA(amount) {
  return new Intl.NumberFormat('fr-BF').format(amount) + ' FCFA';
}

function formatDate(dateStr) {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr));
}

function groupByDate(transactions) {
  const groups = {};
  for (const tx of transactions) {
    const key = new Date(tx.createdAt).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
    if (!groups[key]) groups[key] = [];
    groups[key].push(tx);
  }
  return groups;
}

function TransactionIcon({ type }) {
  if (type === 'DEBIT') {
    return (
      <div className="w-10 h-10 rounded-full bg-error/10 flex items-center justify-center">
        <ArrowUpRight className="w-5 h-5 text-error" />
      </div>
    );
  }
  return (
    <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
      <ArrowDownLeft className="w-5 h-5 text-success" />
    </div>
  );
}

function getAmountColor(type) {
  if (type === 'DEBIT') return 'text-error';
  return 'text-success';
}

function getAmountPrefix(type) {
  if (type === 'DEBIT') return '-';
  return '+';
}

function WithdrawalModal({ balance, paymentInfo, onClose, onSuccess }) {
  const [amount, setAmount] = useState('');
  const [phoneNumber, setPhoneNumber] = useState(paymentInfo?.mobileMoneyNumber || '');
  const [provider, setProvider] = useState(paymentInfo?.mobileMoneyProvider || 'ORANGE_MONEY');
  const [feeInfo, setFeeInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const amountNum = parseInt(amount, 10) || 0;

  useEffect(() => {
    if (amountNum >= 1000) {
      const timer = setTimeout(async () => {
        try {
          const info = await api.previewPayoutFee(amountNum);
          setFeeInfo(info);
        } catch {
          setFeeInfo(null);
        }
      }, 400);
      return () => clearTimeout(timer);
    }
    setFeeInfo(null);
  }, [amountNum]);

  async function handleSubmit() {
    if (!amountNum || amountNum < 1000) return;
    if (!phoneNumber.trim()) return;
    if (feeInfo && feeInfo.netAmount > balance) {
      setError('Solde insuffisant pour ce retrait');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await api.requestWithdrawal({
        amountFcfa: amountNum,
        phoneNumber: phoneNumber.trim(),
        provider,
      });
      setResult(res);
      onSuccess?.();
    } catch (err) {
      setError(err.message || 'Echec du retrait');
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-background-card rounded-2xl p-6 max-w-sm w-full shadow-lg border border-border-light">
          <div className="text-center mb-5">
            <div className="w-14 h-14 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-8 h-8 text-success" />
            </div>
            <h3 className="font-display text-lg font-bold text-text-primary">Retrait effectue</h3>
            <p className="text-text-secondary text-sm mt-1">Votre transfert est en cours</p>
          </div>

          <div className="bg-background-secondary rounded-xl p-4 space-y-3 text-sm mb-5">
            <div className="flex justify-between">
              <span className="text-text-secondary">Montant demande</span>
              <span className="font-semibold text-text-primary">{formatFCFA(result.amountRequestedFcfa)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Frais</span>
              <span className="font-semibold text-error">{formatFCFA(result.feeFcfa)}</span>
            </div>
            <div className="flex justify-between border-t border-border-light pt-3">
              <span className="text-text-secondary font-medium">Credite</span>
              <span className="font-bold text-success">{formatFCFA(result.netAmountFcfa)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Solde restant</span>
              <span className="font-semibold text-text-primary">{formatFCFA(result.newWalletBalanceFcfa)}</span>
            </div>
          </div>

          <p className="text-xs text-text-secondary text-center mb-4">
            Ref: {result.reference}
          </p>

          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-accent-primary text-white font-medium text-sm"
          >
            Fermer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-background-card rounded-2xl p-6 max-w-sm w-full shadow-lg border border-border-light max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display text-lg font-bold text-text-primary">Retrait Mobile Money</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-background-secondary">
            <X className="w-5 h-5 text-text-secondary" />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-error/10 text-error text-sm rounded-xl px-4 py-3 mb-4">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <label className="block text-sm font-medium text-text-secondary mb-1.5">Montant (FCFA)</label>
        <input
          type="number"
          min={1000}
          step={500}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Ex: 5000"
          className="w-full px-4 py-3 rounded-xl bg-background-secondary border border-border-light text-text-primary text-base font-medium placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent-primary/40 mb-1"
        />
        <p className="text-xs text-text-secondary mb-4">
          Minimum 1 000 FCFA - Solde : {formatFCFA(balance)}
        </p>

        <label className="block text-sm font-medium text-text-secondary mb-1.5">Operateur</label>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {PROVIDERS.map((p) => (
            <button
              key={p.value}
              onClick={() => setProvider(p.value)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                provider === p.value
                  ? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
                  : 'border-border-light bg-background-secondary text-text-secondary hover:border-text-secondary/30'
              }`}
            >
              <Smartphone className="w-4 h-4" style={{ color: p.color }} />
              {p.label}
            </button>
          ))}
        </div>

        <label className="block text-sm font-medium text-text-secondary mb-1.5">Numero Mobile Money</label>
        <input
          type="tel"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          placeholder="+226 70 00 00 00"
          className="w-full px-4 py-3 rounded-xl bg-background-secondary border border-border-light text-text-primary text-base placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent-primary/40 mb-4"
        />

        {feeInfo && amountNum >= 1000 && (
          <div className="bg-background-secondary rounded-xl p-4 mb-5 space-y-2.5 text-sm border border-border-light">
            <div className="flex justify-between">
              <span className="text-text-secondary">Vous demandez</span>
              <span className="font-semibold text-text-primary">{formatFCFA(amountNum)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">
                Frais ({feeInfo.feePercentage}%)
                {feeInfo.isExempt && ' - Exonere'}
              </span>
              <span className={`font-semibold ${feeInfo.fee > 0 ? 'text-error' : 'text-success'}`}>
                {feeInfo.fee > 0 ? `- ${formatFCFA(feeInfo.fee)}` : 'Gratuit'}
              </span>
            </div>
            <div className="border-t border-border-light pt-2.5 flex justify-between">
              <span className="text-text-secondary font-medium">Vous recevrez</span>
              <span className="font-bold text-success text-base">{formatFCFA(feeInfo.netAmount)}</span>
            </div>
            {feeInfo.freeThreshold > 0 && feeInfo.isExempt && (
              <p className="text-xs text-text-secondary/70 mt-1">
                Retraits de {formatFCFA(feeInfo.freeThreshold)} ou moins sont gratuits
              </p>
            )}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading || !amountNum || amountNum < 1000 || !phoneNumber.trim()}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-accent-primary text-white font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <CreditCard className="w-4 h-4" />
              Confirmer le retrait
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default function MerchantWallet() {
  const navigate = useNavigate();
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showWithdraw, setShowWithdraw] = useState(false);

  async function fetchWallet() {
    try {
      setLoading(true);
      const p = await api.getProfile();
      setProfile(p);
      const walletData = await api.getMerchantWallet(p.id);
      setWallet(walletData);
      const txData = await api.getWalletTransactions(walletData.id);
      setTransactions(txData);
    } catch (err) {
      setError(err.message || 'Erreur lors du chargement du portefeuille');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchWallet(); }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background-primary flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-accent-primary animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background-primary flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-text-primary text-center">{error}</p>
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 bg-accent-primary text-white rounded-lg"
        >
          Retour
        </button>
      </div>
    );
  }

  const grouped = groupByDate(transactions);

  return (
    <div className="min-h-screen bg-background-primary">
      <div className="sticky top-0 z-10 bg-background-card border-b border-border-light shadow-subtle">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate(-1)} className="p-1">
            <ArrowLeft className="w-5 h-5 text-text-primary" />
          </button>
          <h1 className="font-display text-lg text-text-primary">Mon Portefeuille</h1>
        </div>
      </div>

      <div className="px-4 py-6 space-y-6">
        {wallet && (
          <div className="bg-background-card rounded-2xl p-6 shadow-subtle border border-border-light">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-accent-primary" />
                <span className="text-text-secondary text-sm">Solde disponible</span>
              </div>
              <span
                className={`text-xs font-medium px-2 py-1 rounded-full ${
                  wallet.isActive
                    ? 'bg-success/10 text-success'
                    : 'bg-error/10 text-error'
                }`}
              >
                {wallet.isActive ? 'Actif' : 'Inactif'}
              </span>
            </div>

            <div className="mb-4">
              <p className="font-display text-3xl font-bold text-text-primary">
                {formatFCFA(wallet.balance)}
              </p>
              <span className="inline-block mt-1 text-xs font-medium text-text-secondary bg-background-secondary px-2 py-0.5 rounded-full">
                {wallet.currency || 'XOF'}
              </span>
            </div>

            <button
              onClick={() => setShowWithdraw(true)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-accent-primary text-white text-sm font-medium hover:bg-accent-primary/90 transition-colors"
            >
              <CreditCard className="w-4 h-4" />
              Retrait Mobile Money
            </button>
          </div>
        )}

        <div>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-text-secondary" />
            <h2 className="font-display text-base font-semibold text-text-primary">
              Historique des transactions
            </h2>
          </div>

          {transactions.length === 0 ? (
            <div className="bg-background-card rounded-xl p-8 text-center border border-border-light">
              <Wallet className="w-10 h-10 text-text-secondary mx-auto mb-2 opacity-40" />
              <p className="text-text-secondary text-sm">
                Aucune transaction pour le moment
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(grouped).map(([date, txs]) => (
                <div key={date}>
                  <p className="text-xs font-medium text-text-secondary mb-2 uppercase tracking-wide">
                    {date}
                  </p>
                  <div className="bg-background-card rounded-xl border border-border-light divide-y divide-border-light overflow-hidden">
                    {txs.map((tx) => (
                      <div key={tx.id} className="flex items-center gap-3 px-4 py-3">
                        <TransactionIcon type={tx.type} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-text-primary truncate">
                            {tx.description || tx.reason || 'Transaction'}
                          </p>
                          {tx.reference && (
                            <p className="text-xs text-text-secondary mt-0.5">
                              {tx.reference}
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`text-sm font-semibold ${getAmountColor(tx.type)}`}>
                            {getAmountPrefix(tx.type)} {formatFCFA(tx.amount)}
                          </p>
                          <p className="text-xs text-text-secondary mt-0.5">
                            {formatDate(tx.createdAt)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showWithdraw && (
        <WithdrawalModal
          balance={wallet?.balance || 0}
          paymentInfo={profile}
          onClose={() => setShowWithdraw(false)}
          onSuccess={() => {
            setShowWithdraw(false);
            fetchWallet();
          }}
        />
      )}
    </div>
  );
}
