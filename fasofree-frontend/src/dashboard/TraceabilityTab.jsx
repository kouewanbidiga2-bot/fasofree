import React, { useCallback, useEffect, useState } from 'react';
import {
  Download,
  RefreshCw,
  ScrollText,
  ShieldAlert,
  FileSpreadsheet,
  Loader2,
  User,
} from 'lucide-react';
import api from '../services/api';

/**
 * 🧾 Traçabilité & Finance — Onglet Super Admin
 *
 * 3 blocs :
 *  1. 📄 Exports CSV périodiques des transactions (générés automatiquement)
 *  2. 🧾 Journal des actions d'administration (qui a fait quoi, quand)
 *  3. 🚫 Blocages anti-fraude (avec levée manuelle)
 */
const TraceabilityTab = () => {
  // ── Exports ──────────────────────────────────────────────────
  const [exports, setExports] = useState([]);
  const [loadingExports, setLoadingExports] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [msg, setMsg] = useState(null);

  // ── Audit ────────────────────────────────────────────────────
  const [logs, setLogs] = useState([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [actionFilter, setActionFilter] = useState('');
  const [actions, setActions] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  // ── Blocages ─────────────────────────────────────────────────
  const [blocks, setBlocks] = useState([]);
  const [loadingBlocks, setLoadingBlocks] = useState(true);
  const [liftingId, setLiftingId] = useState(null);

  const notify = (text, type = 'info') => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 5000);
  };

  const loadExports = useCallback(async () => {
    setLoadingExports(true);
    try {
      const { data } = await api.get('/financial/exports', { params: { limit: 30 } });
      setExports(Array.isArray(data) ? data : []);
    } catch (e) {
      notify(e.message || 'Chargement des exports impossible', 'error');
    } finally {
      setLoadingExports(false);
    }
  }, []);

  const loadLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const { data } = await api.get('/audit/logs', {
        params: { limit: 100, ...(actionFilter ? { action: actionFilter } : {}) },
      });
      setLogs(Array.isArray(data?.items) ? data.items : []);
      setAuditTotal(Number(data?.total || 0));
    } catch (e) {
      notify(e.message || 'Chargement du journal impossible', 'error');
    } finally {
      setLoadingLogs(false);
    }
  }, [actionFilter]);

  const loadActions = useCallback(async () => {
    try {
      const { data } = await api.get('/audit/actions');
      setActions(Array.isArray(data) ? data : []);
    } catch {
      /* filtre indisponible : on ignore */
    }
  }, []);

  const loadBlocks = useCallback(async () => {
    setLoadingBlocks(true);
    try {
      const { data } = await api.get('/fraud/blocks');
      setBlocks(Array.isArray(data) ? data : []);
    } catch (e) {
      notify(e.message || 'Chargement des blocages impossible', 'error');
    } finally {
      setLoadingBlocks(false);
    }
  }, []);

  useEffect(() => {
    loadExports();
    loadLogs();
    loadActions();
    loadBlocks();
  }, [loadExports, loadLogs, loadActions, loadBlocks]);

  const generateNow = async () => {
    setGenerating(true);
    try {
      const { data } = await api.post('/financial/exports/generate');
      notify(
        `Export généré : ${data?.fileName || 'CSV'} (${data?.rowCount ?? 0} lignes)`,
        'success',
      );
      loadExports();
    } catch (e) {
      notify(e.message || 'Génération impossible', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const download = async (id) => {
    setDownloadingId(id);
    try {
      const { data } = await api.get(`/financial/exports/${id}`);
      const blob = new Blob([data.csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.fileName || 'transactions.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      notify(e.message || 'Téléchargement impossible', 'error');
    } finally {
      setDownloadingId(null);
      loadExports();
    }
  };

  const liftBlock = async (id) => {
    setLiftingId(id);
    try {
      await api.post(`/fraud/blocks/${id}/lift`);
      notify('Blocage levé', 'success');
      loadBlocks();
      loadLogs();
    } catch (e) {
      notify(e.message || 'Levée impossible', 'error');
    } finally {
      setLiftingId(null);
    }
  };

  const fmtDate = (d) =>
    d ? new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
  const fmtMoney = (n) =>
    `${Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 0 })} FCFA`;

  const card = 'bg-background-card border border-border-light rounded-xl p-4';
  const th = 'px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-text-tertiary';
  const td = 'px-3 py-2 text-xs text-text-primary';

  const isActiveBlock = (b) =>
    new Date(b.blockedUntil).getTime() > Date.now() && !b.releasedAt;

  return (
    <div className="space-y-6">
      {msg && (
        <div
          className={`rounded-lg px-4 py-2.5 text-sm font-medium ${
            msg.type === 'error'
              ? 'bg-status-error/10 text-status-error'
              : 'bg-accent-primary/10 text-accent-primary'
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* ─── 1. EXPORTS CSV ─────────────────────────────────────── */}
      <div className={card}>
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <FileSpreadsheet size={18} className="text-accent-primary" />
            <h3 className="font-semibold text-text-primary">
              Exports CSV des transactions
            </h3>
            <span className="text-[11px] text-text-tertiary">
              (génération automatique tous les 5 jours)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadExports}
              className="p-2 rounded-lg hover:bg-background-secondary text-text-secondary transition"
              title="Actualiser"
            >
              <RefreshCw size={15} />
            </button>
            <button
              onClick={generateNow}
              disabled={generating}
              className="flex items-center gap-1.5 rounded-lg bg-accent-primary px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 transition"
            >
              {generating ? <Loader2 size={13} className="animate-spin" /> : <FileSpreadsheet size={13} />}
              Générer maintenant
            </button>
          </div>
        </div>

        {loadingExports ? (
          <div className="py-6 flex justify-center">
            <Loader2 size={20} className="animate-spin text-accent-primary" />
          </div>
        ) : exports.length === 0 ? (
          <p className="py-4 text-sm text-text-tertiary">
            Aucun export pour le moment. Le premier sera généré automatiquement au bout de 5
            jours, ou immédiatement via « Générer maintenant ».
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-border-light">
                <tr>
                  <th className={th}>Fichier</th>
                  <th className={th}>Période</th>
                  <th className={th}>Lignes</th>
                  <th className={th}>Crédits / Débits</th>
                  <th className={th}>Généré par</th>
                  <th className={th}></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light">
                {exports.map((e) => (
                  <tr key={e.id} className="hover:bg-background-secondary/50">
                    <td className={td}>
                      <div className="font-medium">{e.fileName}</div>
                      <div className="text-[10px] text-text-tertiary">{fmtDate(e.createdAt)}</div>
                    </td>
                    <td className={td}>
                      {new Date(e.periodStart).toLocaleDateString('fr-FR')} →{' '}
                      {new Date(e.periodEnd).toLocaleDateString('fr-FR')}
                    </td>
                    <td className={td}>
                      {e.rowCount}
                      {e.truncated && (
                        <span className="ml-1 text-[10px] text-status-error">plafond atteint</span>
                      )}
                    </td>
                    <td className={td}>
                      <span className="text-status-success">{fmtMoney(e.summary?.totals?.credits)}</span>
                      <span className="mx-1 text-text-tertiary">/</span>
                      <span className="text-status-error">{fmtMoney(e.summary?.totals?.debits)}</span>
                    </td>
                    <td className={td}>{e.generatedBy}</td>
                    <td className={td}>
                      <button
                        onClick={() => download(e.id)}
                        disabled={downloadingId === e.id}
                        className="flex items-center gap-1 rounded-lg border border-border-light px-2 py-1 text-[11px] font-medium hover:bg-background-secondary transition disabled:opacity-50"
                      >
                        {downloadingId === e.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Download size={12} />
                        )}
                        Télécharger
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── 2. JOURNAL D'AUDIT ─────────────────────────────────── */}
      <div className={card}>
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <ScrollText size={18} className="text-accent-primary" />
            <h3 className="font-semibold text-text-primary">Journal d&apos;audit</h3>
            <span className="text-[11px] text-text-tertiary">
              ({auditTotal} action{auditTotal > 1 ? 's' : ''} enregistrée{auditTotal > 1 ? 's' : ''})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={actionFilter}
              onChange={(ev) => setActionFilter(ev.target.value)}
              className="rounded-lg border border-border-light bg-background-secondary px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent-primary"
            >
              <option value="">Toutes les actions</option>
              {actions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <button
              onClick={loadLogs}
              className="p-2 rounded-lg hover:bg-background-secondary text-text-secondary transition"
              title="Actualiser"
            >
              <RefreshCw size={15} />
            </button>
          </div>
        </div>

        {loadingLogs ? (
          <div className="py-6 flex justify-center">
            <Loader2 size={20} className="animate-spin text-accent-primary" />
          </div>
        ) : logs.length === 0 ? (
          <p className="py-4 text-sm text-text-tertiary">
            Aucune action journalisée pour le moment.
          </p>
        ) : (
          <div className="overflow-x-auto max-h-[26rem] overflow-y-auto">
            <table className="w-full">
              <thead className="border-b border-border-light sticky top-0 bg-background-card">
                <tr>
                  <th className={th}>Date</th>
                  <th className={th}>Action</th>
                  <th className={th}>Opérateur</th>
                  <th className={th}>Cible</th>
                  <th className={th}>Résultat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light">
                {logs.map((l) => (
                  <tr key={l.id} className="hover:bg-background-secondary/50">
                    <td className={`${td} whitespace-nowrap`}>{fmtDate(l.createdAt)}</td>
                    <td className={`${td} font-medium`}>{l.action}</td>
                    <td className={td}>
                      <div className="flex items-center gap-1.5">
                        <User size={12} className="text-text-tertiary" />
                        <span className="truncate max-w-[14rem]">
                          {l.actorEmail || l.actorRole || 'système'}
                        </span>
                      </div>
                    </td>
                    <td className={td}>
                      {l.entityType || '—'}
                      {l.entityId && (
                        <span className="ml-1 text-[10px] text-text-tertiary">
                          #{String(l.entityId).slice(0, 8)}
                        </span>
                      )}
                    </td>
                    <td className={td}>
                      <span
                        className={
                          l.result === 'SUCCESS'
                            ? 'text-status-success'
                            : 'text-status-error'
                        }
                      >
                        {l.result}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── 3. BLOCAGES ANTI-FRAUDE ─────────────────────────────── */}
      <div className={card}>
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <ShieldAlert size={18} className="text-accent-primary" />
            <h3 className="font-semibold text-text-primary">Blocages anti-fraude</h3>
          </div>
          <button
            onClick={loadBlocks}
            className="p-2 rounded-lg hover:bg-background-secondary text-text-secondary transition"
            title="Actualiser"
          >
            <RefreshCw size={15} />
          </button>
        </div>

        {loadingBlocks ? (
          <div className="py-6 flex justify-center">
            <Loader2 size={20} className="animate-spin text-accent-primary" />
          </div>
        ) : blocks.length === 0 ? (
          <p className="py-4 text-sm text-text-tertiary">
            Aucun blocage enregistré — aucun comportement anormal détecté.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-border-light">
                <tr>
                  <th className={th}>Date</th>
                  <th className={th}>Compte</th>
                  <th className={th}>Téléphone</th>
                  <th className={th}>Motif</th>
                  <th className={th}>Jusqu&apos;au</th>
                  <th className={th}>Statut</th>
                  <th className={th}></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light">
                {blocks.map((b) => (
                  <tr key={b.id} className="hover:bg-background-secondary/50">
                    <td className={`${td} whitespace-nowrap`}>{fmtDate(b.createdAt)}</td>
                    <td className={td}>
                      <span className="font-mono text-[10px]">
                        {b.userId ? String(b.userId).slice(0, 12) : '—'}
                      </span>
                    </td>
                    <td className={td}>{b.phone || '—'}</td>
                    <td className={`${td} max-w-[16rem]`}>{b.reason || b.rule}</td>
                    <td className={`${td} whitespace-nowrap`}>{fmtDate(b.blockedUntil)}</td>
                    <td className={td}>
                      <span
                        className={
                          isActiveBlock(b)
                            ? 'text-status-error font-semibold'
                            : b.releasedAt
                              ? 'text-text-tertiary'
                              : 'text-text-tertiary'
                        }
                      >
                        {b.releasedAt
                          ? 'levé manuellement'
                          : isActiveBlock(b)
                            ? 'actif'
                            : 'expiré'}
                      </span>
                    </td>
                    <td className={td}>
                      {isActiveBlock(b) && (
                        <button
                          onClick={() => liftBlock(b.id)}
                          disabled={liftingId === b.id}
                          className="rounded-lg border border-border-light px-2 py-1 text-[11px] font-medium hover:bg-background-secondary transition disabled:opacity-50"
                        >
                          {liftingId === b.id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            'Lever'
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default TraceabilityTab;