/**
 * Copyright (c) 2026 BIDIGA Imrane - Koliwa. All rights reserved.
 * Proprietary and confidential.
 */

/** Gains — solde du portefeuille et dernières transactions. */
import { useCallback, useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import Shell from '../components/Shell';
import { CardSkeleton, Empty, ErrorNote, formatDate, formatFcfa } from '../components/ui';
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
      if (walletId) setTransactions(await fetchWalletTransactions(walletId, 25));
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

  const balance = Number(wallet?.balance ?? wallet?.wallet?.balance ?? 0);

  return (
    <Shell title="Gains" kicker="Portefeuille coursier">
      {loading ? (
        <>
          <CardSkeleton lines={2} />
          <CardSkeleton lines={2} />
        </>
      ) : (
        <>
          <ErrorNote>{error}</ErrorNote>

          <section className="card card-ink">
            <span className="topbar-kicker">Solde disponible</span>
            <span className="amount amount-xl">{formatFcfa(balance)}</span>
            <span className="muted">
              Chaque course est créditée une fois la livraison confirmée par le client avec son code.
            </span>
          </section>

          <section className="card">
            <div className="row row-tight">
              <span className="section-title" style={{ margin: 0 }}>Commission Koliwa</span>
              <span className="pill pill-accent">125 FCFA / course</span>
            </div>
            <p className="muted" style={{ margin: 0 }}>
              Prélevée sur le prix de la livraison, plafonnée à 500 FCFA par jour et jamais plus de 10 %
              de la course. Le reste vous revient directement.
            </p>
          </section>

          <p className="section-title">Dernières opérations</p>

          {transactions.length === 0 ? (
            <Empty title="Aucune opération" hint="Vos gains apparaîtront ici après vos premières courses." />
          ) : (
            <section className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {transactions.map((tx) => {
                const amount = Number(tx.amount ?? 0);
                const isCredit = amount >= 0;
                return (
                  <div key={tx.id} className="list-row" style={{ cursor: 'default' }}>
                    <div className="row-tight" style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <span
                        aria-hidden="true"
                        style={{
                          display: 'grid',
                          placeItems: 'center',
                          width: 32,
                          height: 32,
                          borderRadius: 10,
                          flex: 'none',
                          background: isCredit ? 'var(--ok-bg)' : 'var(--danger-bg)',
                          color: isCredit ? 'var(--ok)' : 'var(--danger)',
                        }}
                      >
                        {isCredit ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                      </span>
                      <div className="stack" style={{ gap: 1 }}>
                        <span className="strong" style={{ fontSize: 14 }}>
                          {tx.description || tx.type || 'Opération'}
                        </span>
                        <span className="muted" style={{ fontSize: 12 }}>
                          {formatDate(tx.createdAt || tx.created_at)}
                        </span>
                      </div>
                    </div>
                    <span className={`tx-amount ${isCredit ? 'credit' : 'debit'}`}>
                      {isCredit ? '+' : '−'}
                      {formatFcfa(Math.abs(amount))}
                    </span>
                  </div>
                );
              })}
            </section>
          )}
        </>
      )}
    </Shell>
  );
};

export default Earnings;
