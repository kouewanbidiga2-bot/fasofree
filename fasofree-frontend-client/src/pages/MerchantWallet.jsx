import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Wallet, ArrowUpRight, ArrowDownLeft, TrendingUp, Loader2, CreditCard } from 'lucide-react';
import api from '../services/api';

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

export default function MerchantWallet() {
  const navigate = useNavigate();
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const profile = await api.getProfile();
        const walletData = await api.getMerchantWallet(profile.id);
        setWallet(walletData);
        const txData = await api.getWalletTransactions(walletData.id);
        setTransactions(txData);
      } catch (err) {
        setError(err.message || 'Erreur lors du chargement du portefeuille');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

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
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background-card border-b border-border-light shadow-subtle">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate(-1)} className="p-1">
            <ArrowLeft className="w-5 h-5 text-text-primary" />
          </button>
          <h1 className="font-display text-lg text-text-primary">Mon Portefeuille</h1>
        </div>
      </div>

      <div className="px-4 py-6 space-y-6">
        {/* Balance Card */}
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
              disabled
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-background-secondary text-text-secondary text-sm font-medium cursor-not-allowed"
            >
              <CreditCard className="w-4 h-4" />
              Retrait — Bientôt disponible
            </button>
          </div>
        )}

        {/* Transaction History */}
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
    </div>
  );
}
