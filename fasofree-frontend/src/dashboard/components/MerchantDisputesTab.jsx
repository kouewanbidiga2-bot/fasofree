/**
 * FasoFree — Onglet « Litiges » du gérant du commerce (Phase 2)
 *
 * - Liste des litiges de SES commerces uniquement (GET /disputes/business —
 *   filtrage côté serveur par commande, multi-agences).
 * - Actions rôle marchand : Rembourser (décision du gérant seule, montant =
 *   total de la commande, crédit wallet client immédiat) ou COMMUNIQUER via le
 *   chat support (même canal que le support/admin).
 * - Escalade : si le versement marchand est déjà exécuté (payout SUCCESS),
 *   la demande remonte au circuit admin (PENDING_ADMIN_APPROVAL).
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield, RefreshCw, CheckCircle, Eye, Clock,
  MessageSquare, Loader2, Store, User as UserIcon, Package, Wallet,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { StatCard, StatusBadge, LoadingSkeleton, EmptyState } from './StatCard';
import {
  getMerchantDisputes,
  getDisputeDetail,
  merchantRefund,
} from '../../services/disputeService';
import DisputeChat from './DisputeChat';
import {
  MERCHANT_REFUNDABLE,
  STATUS_CONFIG,
  FILTERS,
  formatDate,
  orderStatusLabel,
  shortId,
  InfoItem,
} from './disputeUi';

const MerchantDisputesTab = () => {
  const user = useAuthStore((state) => state.user);
  // `all` = portefeuille complet (les StatCards comptent sur `all`, pas la
  // liste filtrée) ; `disputes` = `all` filtré pour la liste.
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  const disputes = filter ? all.filter((d) => d.status === filter) : all;

  const load = useCallback(async (opts = {}) => {
    const silent = opts.silent === true;
    if (!silent) setLoading(true);
    if (!silent) setError(null);
    try {
      const data = await getMerchantDisputes();
      setAll(Array.isArray(data) ? data : []);
    } catch (err) {
      if (silent) return; // refresh de fond : on garde la liste affichée
      setError(err.message || 'Impossible de charger les litiges.');
      setAll([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** Toast de succès auto-fermé (n'écrase pas une erreur plus récente). */
  const showSuccess = (text) => {
    setError({ type: 'success', text });
    window.setTimeout(() => {
      setError((prev) =>
        prev && prev.type === 'success' && prev.text === text ? null : prev,
      );
    }, 5000);
  };

  const runAction = async (d, fn, onSuccess) => {
    setBusy(d.id);
    setError(null);
    try {
      const result = await fn();
      // Refresh silencieux : ne démonte pas la carte/le chat, ne flashe pas
      // les squelettes. Le détail n'est écrasé QUE si la ligne est ouverte.
      await Promise.all([
        load({ silent: true }),
        getDisputeDetail(d.id)
          .then((refreshed) => {
            if (selectedId === d.id) setDetail(refreshed || null);
          })
          .catch(() => {}),
      ]);
      onSuccess?.(result);
    } catch (err) {
      setError({ type: 'error', text: err.message || 'Action impossible.' });
    } finally {
      setBusy(null);
    }
  };

  const handleRefund = (d) => {
    const amount = Number(d.order?.totalAmount ?? d.refundAmount ?? 0);
    if (
      !window.confirm(
        `Rembourser le client de ${amount.toLocaleString('fr-FR')} FCFA ?\n\nLe montant sera crédité sur le wallet du client. Si le versement de votre commerce a déjà été exécuté, la demande sera transmise à l\u2019administration.`,
      )
    ) {
      return;
    }
    const note = window.prompt(
      'Motif du remboursement (optionnel, visible par le client, 500 caractères max) :',
    );
    if (note === null) return;
    // Le DTO backend impose MaxLength(500) : tronquer côté client.
    const cleanNote = (note || '').trim().slice(0, 500);
    runAction(
      d,
      () => merchantRefund(d.id, cleanNote || undefined),
      (result) => {
        const escalated = result?.status === 'PENDING_ADMIN_APPROVAL';
        showSuccess(
          escalated
            ? 'Le versement marchand a déjà été exécuté : la demande a été transmise à l\u2019administration pour arbitrage.'
            : `Client remboursé de ${amount.toLocaleString('fr-FR')} FCFA ✓ — crédité sur son wallet.`,
        );
      },
    );
  };

  const selected = detail || disputes.find((d) => d.id === selectedId) || null;

  const renderActions = (d) => {
    const disabled = busy === d.id;
    if (MERCHANT_REFUNDABLE.includes(d.status)) {
      const amount = Number(d.order?.totalAmount ?? d.refundAmount ?? 0);
      const refundable = Number.isFinite(amount) && amount > 0;
      if (!refundable) {
        return (
          <span className="text-xs text-text-tertiary">
            Montant de la commande indisponible — contacter le support.
          </span>
        );
      }
      return (
        <button
          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition disabled:opacity-40 flex items-center gap-1.5 bg-status-success text-white hover:opacity-90"
          disabled={disabled}
          onClick={() => handleRefund(d)}
        >
          {busy === d.id ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Wallet size={12} />
          )}
          Rembourser le client
        </button>
      );
    }
    switch (d.status) {
      case 'PENDING_ADMIN_APPROVAL':
        return (
          <span className="text-xs text-text-secondary italic">
            En attente de la décision de l\u2019administration…
          </span>
        );
      case 'APPROVED':
        return <span className="text-xs text-status-success">Remboursé ✓</span>;
      case 'REJECTED':
        return (
          <span className="text-xs text-status-error">Rejeté par l\u2019administration</span>
        );
      default:
        return <span className="text-xs text-text-tertiary">Clôturé</span>;
    }
  };

  const renderDetail = () => {
    if (!selected) return null;
    const d = selected;
    return (
      <div className="card p-5 space-y-4 animate-slide-up">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-text-primary">
              Litige #{shortId(d.id)}
            </h4>
            <span className="mt-1 inline-block">
              <StatusBadge status={d.status} statusConfig={STATUS_CONFIG} />
            </span>
          </div>
          <button
            onClick={() => {
              setSelectedId(null);
              setDetail(null);
            }}
            className="text-xs text-text-secondary hover:text-accent-primary"
          >
            Fermer
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <InfoItem
            icon={UserIcon}
            label="Client"
            value={d.client?.fullName || shortId(d.clientId) || '—'}
            sub={d.client?.phone}
          />
          <InfoItem
            icon={Store}
            label="Commerce"
            value={d.business?.name || '—'}
            sub={d.business?.phone}
          />
          <InfoItem
            icon={Package}
            label="Commande"
            value={`#${shortId(d.order?.id) || shortId(d.orderId) || '—'}`}
            sub={orderStatusLabel(d.order?.status)}
          />
          <InfoItem
            icon={Clock}
            label="Ouvert le"
            value={formatDate(d.createdAt)}
            sub={d.resolvedAt ? `Résolu le ${formatDate(d.resolvedAt)}` : ''}
          />
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase text-text-secondary mb-1">Motif</p>
          <p className="text-sm text-text-primary">{d.reason}</p>
        </div>

        {(d.supportNote || d.adminNote || d.merchantNote || d.refundAmount) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {d.merchantNote && (
              <div className="bg-status-successBg/60 rounded-lg p-3">
                <p className="text-[10px] font-bold uppercase text-status-success mb-1">
                  Ma note (visible de l\u2019administration)
                </p>
                <p className="text-text-primary">{d.merchantNote}</p>
              </div>
            )}
            {d.supportNote && (
              <div className="bg-background-secondary/60 rounded-lg p-3">
                <p className="text-[10px] font-bold uppercase text-text-secondary mb-1">Note support</p>
                <p className="text-text-primary">{d.supportNote}</p>
              </div>
            )}
            {d.adminNote && (
              <div className="bg-background-secondary/60 rounded-lg p-3">
                <p className="text-[10px] font-bold uppercase text-text-secondary mb-1">Décision admin</p>
                <p className="text-text-primary">{d.adminNote}</p>
              </div>
            )}
            {d.refundAmount ? (
              <div className="bg-background-secondary/60 rounded-lg p-3">
                <p className="text-[10px] font-bold uppercase text-text-secondary mb-1">Montant</p>
                <p className="text-sm font-bold text-status-success">
                  {Number(d.refundAmount).toLocaleString('fr-FR')} FCFA
                </p>
              </div>
            ) : null}
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-1 border-t border-border-light">
          {renderActions(d)}
          <span className="text-[10px] text-text-tertiary self-center">
            Marchand du litige · décision autonome (montant = total de la commande)
          </span>
        </div>

        {/* Chat support : communiquer pour régler (support + admin visibles) */}
        <div className="pt-1 border-t border-border-light">
          <p className="text-[10px] font-bold uppercase text-text-secondary mb-2 flex items-center gap-1.5">
            <MessageSquare size={12} /> Chat support (client · support · administration)
          </p>
          <DisputeChat disputeId={d.id} currentUserId={user?.id} status={d.status} />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-text-primary">Litiges de mes commerces</h2>
        <button onClick={() => load()} disabled={busy !== null} className="btn-secondary gap-2 disabled:opacity-40">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Actualiser
        </button>
      </div>

      {/* Statuts — compteurs globaux (portefeuille), pas la liste filtrée */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Ouverts" value={all.filter((d) => d.status === 'OPEN').length} icon={Eye} color="#D97706" loading={loading} />
        <StatCard label="En cours" value={all.filter((d) => d.status === 'UNDER_INVESTIGATION').length} icon={Clock} color="#3B82F6" loading={loading} />
        <StatCard label="En attente admin" value={all.filter((d) => d.status === 'PENDING_ADMIN_APPROVAL').length} icon={Shield} color="#F59E0B" loading={loading} />
        <StatCard label="Remboursés" value={all.filter((d) => d.status === 'APPROVED').length} icon={CheckCircle} color="#22C55E" loading={loading} />
      </div>

      {/* Filtres */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => {
              setFilter(f.value);
              setSelectedId(null);
              setDetail(null);
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
              filter === f.value
                ? 'bg-accent-primary text-white'
                : 'bg-background-secondary text-text-secondary hover:bg-background-card border border-border-light'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <p
          role="status"
          className={`text-sm px-4 py-2 rounded-lg ${
            error.type === 'success'
              ? 'bg-status-successBg text-status-success'
              : 'bg-status-errorBg text-status-error'
          }`}
        >
          {error.text}
        </p>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-5">
              <LoadingSkeleton height="h-4" className="mb-2" />
              <LoadingSkeleton height="h-3" width="w-2/3" />
            </div>
          ))}
        </div>
      ) : disputes.length === 0 ? (
        <EmptyState
          icon={Shield}
          title="Aucun litige"
          description={
            filter
              ? 'Aucun litige pour ce filtre.'
              : 'Aucun litige sur vos commerces : vos clients sont satisfaits.'
          }
          action={{ label: 'Actualiser', onClick: () => load() }}
        />
      ) : (
        <div className="space-y-2">
          {disputes.map((d) => (
            <div
              key={d.id}
              className={`card p-4 transition ${
                selectedId === d.id ? 'ring-2 ring-accent-primary' : 'hover:bg-background-secondary'
              }`}
            >
              <button
                onClick={() => {
                  setDetail(null);
                  setSelectedId(selectedId === d.id ? null : d.id);
                }}
                disabled={busy !== null}
                aria-expanded={selectedId === d.id}
                className="w-full text-left"
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <StatusBadge status={d.status} statusConfig={STATUS_CONFIG} />
                    <div>
                      <p className="text-sm font-bold text-text-primary">
                        {d.reason || 'Litige'}
                      </p>
                      <p className="text-xs text-text-secondary">
                        Commande #{shortId(d.order?.id) || shortId(d.orderId) || '—'} ·{' '}
                        {d.client?.fullName || shortId(d.clientId) || '—'} ·{' '}
                        {d.business?.name || 'Commerce'}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-text-tertiary">{formatDate(d.createdAt)}</p>
                </div>
              </button>

              {selectedId === d.id && renderDetail()}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MerchantDisputesTab;