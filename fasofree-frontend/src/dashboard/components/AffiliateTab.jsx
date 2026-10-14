import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Link2, Search } from 'lucide-react';
import { affiliateService } from '../../services/affiliateService';
import { StatCard, LoadingSkeleton, EmptyState } from './StatCard';

const formatMoney = (value) =>
  `${Number(value ?? 0).toLocaleString('fr-FR')} FCFA`;

/**
 * Onglet Affiliation (ADMIN / SUPPORT / SUPER_ADMIN) : vision globale du
 * funnel (clics -> inscriptions -> commandes) et résolution de codes.
 * Aucune action sensible ici, lecture seule.
 */
const AffiliateTab = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [code, setCode] = useState('');
  const [resolved, setResolved] = useState(null);
  const [resolving, setResolving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await affiliateService.getGlobalStats();
      setStats(data);
    } catch (err) {
      setStats(null);
      const status = err?.response?.status;
      setError(
        status === 403
          ? 'Accès refusé aux statistiques affiliation.'
          : 'Impossible de charger les statistiques affiliation.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const resolve = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setResolving(true);
    setError('');
    setResolved(null);
    try {
      const res = await affiliateService.resolveCode(code.trim());
      setResolved(res?.businessId || null);
    } catch (err) {
      setResolved(null);
      setError(
        err?.response?.status === 404
          ? 'Code introuvable.'
          : 'Résolution impossible.',
      );
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-text-primary">Affiliation</h2>
          <p className="text-sm text-text-secondary">
            Performance des liens de parrainage et codes suivis
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border-light hover:bg-background-secondary transition-colors text-sm"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Actualiser
        </button>
      </div>

      {error && (
        <div className="bg-status-errorBg border border-status-error/30 rounded-lg p-4 text-sm text-status-error">
          {error}
        </div>
      )}

      {loading ? (
        <LoadingSkeleton height="h-24" />
      ) : stats ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <StatCard label="Liens" value={stats.totalLinks ?? 0} icon={Link2} />
            <StatCard label="Clics" value={stats.totalClicks ?? 0} icon={Search} />
            <StatCard label="Inscriptions" value={stats.totalSignups ?? 0} icon={Link2} />
            <StatCard label="Commandes" value={stats.totalOrders ?? 0} icon={Link2} />
            <StatCard
              label="Revenus"
              value={formatMoney(stats.totalRevenue)}
              icon={Link2}
            />
          </div>

          <div className="bg-background-card border border-border-light rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-background-secondary text-text-secondary text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-3">Commerce</th>
                  <th className="text-left px-4 py-3">Code</th>
                  <th className="text-left px-4 py-3">Clics</th>
                  <th className="text-left px-4 py-3">Inscriptions</th>
                  <th className="text-left px-4 py-3">Commandes</th>
                  <th className="text-left px-4 py-3">Revenus</th>
                </tr>
              </thead>
              <tbody>
                {Array.isArray(stats.topBusinesses) &&
                stats.topBusinesses.length > 0 ? (
                  stats.topBusinesses.map((b) => (
                    <tr key={b.businessId} className="border-t border-border-light">
                      <td className="px-4 py-3 text-text-primary font-medium">
                        {b.businessName}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {b.code || '—'}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">{b.clicks}</td>
                      <td className="px-4 py-3 text-text-secondary">{b.signups}</td>
                      <td className="px-4 py-3 text-text-secondary">{b.orders}</td>
                      <td className="px-4 py-3 text-text-secondary">
                        {formatMoney(b.revenue)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="p-8">
                      <EmptyState
                        icon={Link2}
                        title="Aucun événement"
                        description="Les affiliés seront suivis dès les premiers clics."
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      <form
        onSubmit={resolve}
        className="bg-background-card border border-border-light rounded-xl p-4"
      >
        <h3 className="font-semibold text-text-primary mb-3">
          Résoudre un code affilié
        </h3>
        <div className="flex flex-col md:flex-row gap-3">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Code (ex: FF-ABC123)"
            className="flex-1 px-3 py-2 rounded-lg bg-background-secondary border border-border-light text-sm"
          />
          <button
            type="submit"
            disabled={resolving || !code.trim()}
            className="px-4 py-2 rounded-lg bg-accent-primary text-white text-sm disabled:opacity-50"
          >
            {resolving ? 'Recherche…' : 'Résoudre'}
          </button>
        </div>
        {resolved && (
          <p className="mt-3 text-sm text-text-secondary">
            businessId : <span className="text-text-primary">{resolved}</span>
          </p>
        )}
      </form>
    </div>
  );
};

export default AffiliateTab;
