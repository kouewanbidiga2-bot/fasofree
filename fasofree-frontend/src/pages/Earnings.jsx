/**
 * Copyright (c) 2026 BIDIGA Imrane - Koliwa. All rights reserved.
 * Proprietary and confidential.
 */

/** Gains — solde du portefeuille et dernières transactions. */
import { useCallback, useEffect, useState } from 'react';
import Shell from '../components/Shell';
import { Loading, Empty, ErrorNote, formatFcfa, formatDate } from '../components/ui';
import useAuthStore from '../store/authStore';
import { fetchWallet, fetchWalletTransactions } from '../services/wallet';

const Earnings = () => {
  const user = useAuthStore((s) => s.user);
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      const w = await fetchWallet(user.id);
      setWallet(w);
      const walletId = w?.id || w?.wallet?.id;
      if (walletId) {
        const rows = await fetchWalletTransactions(walletId, 25);
        setTransactions(Array.isArray(rows) ? rows : []);
      }
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const balance = wallet?.balance ?? wallet?.wallet?.balance ?? 0;

  return (
    <Shell title="Gains">
      {loading ? (
        <Loading />
      ) : (
        <>
          <ErrorNote>{error}</ErrorNote>

          <div className="card" style={{ gap: 6 }}>
            <span className="section-title" style={{ margin: 0 }}>Solde disponible</span>
            <span className="amount" style={{ fontSize: 32 }}>{formatFcfa(balance)}</span>
            <span className="muted">
              Les gains de chaque course sont crédités une fois la livraison confirmée par le client.
            </span>
          </div>

          <div className="card" style={{ gap: 4 }}>
            <span className="section-title" style={{ margin: 0 }}>Commission Koliwa</span>
            <span className="muted" style={{ margin: 0 }}>
              125 FCFA par course livrée, plafonnés à 500 FCFA par jour et jamais plus de 10 % du prix
              de la livraison. Le reste vous revient.
            </span>
          </div>

          <p className="section-title">Dernières opérations</p>
          {transactions.length === 0 ? (
            <Empty title="Aucune opération" hint="Vos gains apparaîtront ici après vos premières courses." />
          ) : (
            transactions.map((tx) => {
              const amount = Number(tx.amount ?? 0);
              const isCredit = amount >= 0;
              return (
                <div key={tx.id} className="card" style={{ padding: 14 }}>
                  <div className="row">
                    <div className="stack">
                      <span className="strong" style={{ fontSize: 14 }}>
                        {tx.description || tx.type || 'Opération'}
                      </span>
                      <span className="muted">{formatDate(tx.createdAt || tx.created_at)}</span>
                    </div>
                    <span
                      className="strong"
                      style={{ color: isCredit ? 'var(--ok)' : 'var(--danger)', whiteSpace: 'nowrap' }}
                    >
                      {isCredit ? '+' : '−'}{formatFcfa(Math.abs(amount))}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </>
      )}
    </Shell>
  );
};

export default Earnings;
