/**
 * FasoFree — Onglet « Litiges » partagé (Support / Super Admin / Admin Manager)
 *
 * - Liste complète (GET /disputes, ouvert au SUPPORT depuis la Phase 1).
 * - Filtres par statut, détail enrichi (commande / client / commerce).
 * - Actions rôle-aware : Prendre en charge (OPEN), Recommander remboursement/rejet
 *   (UNDER_INVESTIGATION), Approuver / Rejeter (PENDING_ADMIN_APPROVAL — admin/super admin).
 * - Chat support intégré : historique REST + temps réel WS /support.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Shield, RefreshCw, CheckCircle, XCircle, Eye, Clock,
  MessageSquare, Send, Loader2, Store, User as UserIcon, Package,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { StatCard, StatusBadge, LoadingSkeleton, EmptyState } from './StatCard';
import {
  getDisputes,
  assignToSupport,
  submitRecommendation,
  approveRefund,
  rejectDispute,
  getDisputeMessages,
  sendDisputeMessage,
} from '../../services/disputeService';
import { getSupportSocket } from '../../services/realtime';

const STATUS_CONFIG = {
  OPEN: { label: 'Ouvert', color: 'warning', dot: '#D97706' },
  UNDER_INVESTIGATION: { label: 'En cours', color: 'info', dot: '#3B82F6' },
  PENDING_ADMIN_APPROVAL: { label: 'En attente admin', color: 'processing', dot: '#F59E0B' },
  APPROVED: { label: 'Approuvé', color: 'success', dot: '#22C55E' },
  REJECTED: { label: 'Rejeté', color: 'error', dot: '#EF4444' },
  CLOSED: { label: 'Clôturé', color: 'gray', dot: '#9CA3AF' },
};

const ROLE_LABELS = {
  CLIENT: 'Client',
  SUPPORT: 'Support',
  ADMIN: 'Admin',
  SUPER_ADMIN: 'Super Admin',
  BUSINESS_ADMIN: 'Marchand',
};

const FILTERS = [
  { value: '', label: 'Tous' },
  { value: 'OPEN', label: 'Ouverts' },
  { value: 'UNDER_INVESTIGATION', label: 'En cours' },
  { value: 'PENDING_ADMIN_APPROVAL', label: 'En attente admin' },
  { value: 'APPROVED', label: 'Approuvés' },
  { value: 'REJECTED', label: 'Rejetés' },
];

const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString('fr-FR') : '—';
const formatTime = (d) =>
  d ? new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';

/**
 * 💬 Chat support d'un litige (côté administration).
 * Envoi REST (route garantie), réception temps réel WS /support.
 */
const DisputeChat = ({ disputeId, currentUserId }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const boxRef = useRef(null);
  const socket = getSupportSocket();

  useEffect(() => {
    if (!disputeId) return;
    let cancelled = false;
    setLoading(true);

    getDisputeMessages(disputeId)
      .then((list) => {
        if (!cancelled) setMessages(Array.isArray(list) ? list : []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    if (!socket.connected) socket.connect();

    const onMessage = (m) => {
      if (!m || m.disputeId !== disputeId) return;
      setMessages((prev) =>
        prev.some((x) => x.id === m.id) ? prev : [...prev, m],
      );
    };
    socket.on('newDisputeMessage', onMessage);
    socket.emit('joinDispute', { disputeId }, (res) => {
      if (res && res.status === 'ok' && Array.isArray(res.history)) {
        setMessages((prev) => {
          const ids = new Set(prev.map((m) => m.id));
          const missing = res.history.filter((m) => !ids.has(m.id));
          return missing.length ? [...prev, ...missing] : prev;
        });
      }
    });

    return () => {
      cancelled = true;
      socket.off('newDisputeMessage', onMessage);
      socket.emit('leaveDispute', { disputeId });
    };
  }, [disputeId, socket]);

  useEffect(() => {
    if (boxRef.current) {
      boxRef.current.scrollTop = boxRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    try {
      const sent = await sendDisputeMessage(disputeId, text);
      setInput('');
      if (sent && sent.id) {
        setMessages((prev) =>
          prev.some((m) => m.id === sent.id) ? prev : [...prev, sent],
        );
      }
    } catch (err) {
      setError(err.message || "Impossible d'envoyer le message.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <div
        ref={boxRef}
        className="bg-background-secondary/50 border border-border-light rounded-lg p-3 max-h-56 overflow-y-auto mb-2 space-y-2"
      >
        {loading ? (
          <div className="flex justify-center pt-6">
            <Loader2 size={18} className="animate-spin text-text-tertiary" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-xs text-text-tertiary text-center pt-6">
            Aucun message. Discutez avec le client pour régler le litige.
          </p>
        ) : (
          messages.map((m, i) => {
            const mine = m.senderId === currentUserId;
            return (
              <div
                key={m.id || `${m.senderId}-${i}`}
                className={`max-w-[82%] px-3 py-2 rounded-lg ${
                  mine
                    ? 'ml-auto text-white'
                    : 'bg-background-card border border-border-light text-text-primary'
                }`}
                style={mine ? { backgroundColor: '#C1652E' } : {}}
              >
                {!mine && (
                  <p className="text-[10px] text-text-secondary mb-0.5 font-bold uppercase">
                    {m.senderName || ROLE_LABELS[m.senderRole] || 'Support'}
                  </p>
                )}
                <p className="text-xs break-words whitespace-pre-wrap">{m.message}</p>
                <p
                  className={`text-[10px] mt-0.5 ${
                    mine ? 'text-white/70' : 'text-text-tertiary'
                  }`}
                >
                  {formatTime(m.createdAt)}
                </p>
              </div>
            );
          })
        )}
      </div>

      {error && <p className="text-xs text-status-error mb-1">{error}</p>}

      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Écrire au client / au marchand…"
          className="flex-1 bg-background-card border border-border-light rounded-lg px-3 py-2 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-accent-primary"
        />
        <button
          onClick={send}
          disabled={sending || !input.trim()}
          className="px-3 py-2 bg-accent-primary text-white text-xs font-semibold rounded-lg disabled:opacity-40 hover:bg-accent-primary/90 transition flex items-center gap-1.5"
        >
          {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          Envoyer
        </button>
      </div>
    </div>
  );
};

const DisputesTab = () => {
  const user = useAuthStore((state) => state.user);
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  const normalizedRole = String(user?.role || '').toLowerCase().replace('-', '_');
  const isAdmin = ['superadmin', 'admin'].includes(normalizedRole);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getDisputes(filter || undefined);
      setDisputes(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Impossible de charger les litiges.');
      setDisputes([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  // Re-synchronise le détail sélectionné après une action
  const refreshDetail = async (id) => {
    if (!id) return;
    try {
      const data = await getDisputes(filter || undefined);
      setDisputes(Array.isArray(data) ? data : []);
      const found = (Array.isArray(data) ? data : []).find((d) => d.id === id);
      setDetail(found || null);
    } catch {
      // silencieux
    }
  };

  const runAction = async (action, successMessage) => {
    setBusy(action.disputeId);
    setError(null);
    try {
      await action.fn();
      await Promise.all([load(), refreshDetail(action.disputeId)]);
      if (successMessage) setError({ type: 'success', text: successMessage });
      else setError(null);
    } catch (err) {
      setError({ type: 'error', text: err.message || 'Action impossible.' });
    } finally {
      setBusy(null);
    }
  };

  const handleAssign = (d) => {
    const note = window.prompt('Note de prise en charge (optionnel) :', 'Prise en charge par le support');
    if (note === null) return;
    runAction(
      {
        disputeId: d.id,
        fn: () => assignToSupport(d.id, note.trim() || undefined),
      },
      'Litige pris en charge.',
    );
  };

  const handleRecommend = (d, resolution) => {
    const note = window.prompt('Note de recommandation (optionnel) :');
    if (note === null) return;
    let refundAmount;
    if (resolution === 'REFUND') {
      const raw = window.prompt(
        `Montant du remboursement (max ${Number(d.order?.totalAmount || 0).toLocaleString('fr-FR')} FCFA) :`,
        String(d.order?.totalAmount || d.refundAmount || ''),
      );
      if (raw === null) return;
      refundAmount = Number(raw.replace(/\s/g, '')) || undefined;
    }
    runAction(
      {
        disputeId: d.id,
        fn: () =>
          submitRecommendation(
            d.id,
            resolution,
            refundAmount,
            note?.trim() || undefined,
          ),
      },
      resolution === 'REFUND'
        ? 'Recommandation de remboursement soumise.'
        : 'Recommandation de rejet soumise.',
    );
  };

  const handleApprove = (d) => {
    if (!window.confirm('Valider le remboursement au client ?')) return;
    runAction(
      {
        disputeId: d.id,
        fn: () => approveRefund(d.id, 'Remboursement approuvé par l\u2019administration'),
      },
      'Remboursement approuvé et crédité au client.',
    );
  };

  const handleReject = (d) => {
    const note = window.prompt('Motif du rejet (optionnel) :');
    if (note === null) return;
    runAction(
      {
        disputeId: d.id,
        fn: () => rejectDispute(d.id, note?.trim() || 'Litige rejeté par l\u2019administration'),
      },
      'Litige rejeté.',
    );
  };

  const selected = detail || disputes.find((d) => d.id === selectedId) || null;

  const renderActions = (d) => {
    if (!d) return null;
    const disabled = busy === d.id;
    const btnCls =
      'px-3 py-1.5 rounded-lg text-xs font-semibold transition disabled:opacity-40 flex items-center gap-1.5';
    switch (d.status) {
      case 'OPEN':
        return (
          <button
            className={`${btnCls} bg-accent-primary text-white hover:bg-accent-primary/90`}
            disabled={disabled}
            onClick={() => handleAssign(d)}
          >
            {busy === d.id ? <Loader2 size={12} className="animate-spin" /> : <Eye size={12} />}
            Prendre en charge
          </button>
        );
      case 'UNDER_INVESTIGATION':
        return (
          <div className="flex gap-2 flex-wrap">
            <button
              className={`${btnCls} bg-status-success text-white hover:opacity-90`}
              disabled={disabled}
              onClick={() => handleRecommend(d, 'REFUND')}
            >
              <CheckCircle size={12} /> Recommander remboursement
            </button>
            <button
              className={`${btnCls} bg-status-error text-white hover:opacity-90`}
              disabled={disabled}
              onClick={() => handleRecommend(d, 'REJECT')}
            >
              <XCircle size={12} /> Recommander rejet
            </button>
          </div>
        );
      case 'PENDING_ADMIN_APPROVAL':
        if (!isAdmin) {
          return (
            <span className="text-xs text-text-secondary italic">
              Décision en attente d\u2019un admin…
            </span>
          );
        }
        return (
          <div className="flex gap-2 flex-wrap">
            <button
              className={`${btnCls} bg-status-success text-white hover:opacity-90`}
              disabled={disabled}
              onClick={() => handleApprove(d)}
            >
              {busy === d.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
              Approuver le remboursement
            </button>
            <button
              className={`${btnCls} bg-status-error text-white hover:opacity-90`}
              disabled={disabled}
              onClick={() => handleReject(d)}
            >
              {busy === d.id ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
              Rejeter
            </button>
          </div>
        );
      default:
        return (
          <span className="text-xs text-text-tertiary">
            {d.status === 'APPROVED' ? 'Remboursé ✓' : d.status === 'REJECTED' ? 'Rejeté définitivement' : ''}
          </span>
        );
    }
  };

  const renderDetail = () => {
    if (!selected) return null;
    const d = selected;
    return (
      <div className="card p-5 space-y-4 animate-slide-up">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-text-primary">Litige #{d.id?.slice(-8)}</h4>
            <span className="mt-1 inline-block">
              <StatusBadge status={d.status} statusConfig={STATUS_CONFIG} />
            </span>
          </div>
          <button
            onClick={() => { setSelectedId(null); setDetail(null); }}
            className="text-xs text-text-secondary hover:text-accent-primary"
          >
            Fermer
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <InfoItem icon={UserIcon} label="Client" value={d.client?.fullName || d.clientId?.slice(-8)} sub={d.client?.phone} />
          <InfoItem icon={Store} label="Commerce" value={d.business?.name || '—'} sub={d.business?.phone} />
          <InfoItem icon={Package} label="Commande" value={`#${d.order?.id?.slice(-8) || d.orderId?.slice(-8)}`} sub={d.order?.status} />
          <InfoItem icon={Clock} label="Ouvert le" value={formatDate(d.createdAt)} sub={d.status === 'APPROVED' || d.status === 'REJECTED' ? `Résolu le ${formatDate(d.resolvedAt)}` : `${d.status !== 'OPEN' ? 'Assigné : ' + (d.supportAgentId?.slice(-8) || 'non') : ''}`} />
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase text-text-secondary mb-1">Motif</p>
          <p className="text-sm text-text-primary">{d.reason}</p>
        </div>

        {(d.supportNote || d.adminNote || d.refundAmount) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
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
              <div className="bg-status-successBg/60 rounded-lg p-3">
                <p className="text-[10px] font-bold uppercase text-status-success mb-1">Montant remboursé</p>
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
            Client : {d.client?.fullName || '—'} · {d.client?.phone || d.order?.businessId?.slice(-8) || ''}
          </span>
        </div>

        {/* Chat support du litige */}
        <div className="pt-1 border-t border-border-light">
          <p className="text-[10px] font-bold uppercase text-text-secondary mb-2 flex items-center gap-1.5">
            <MessageSquare size={12} /> Chat support (client · support · marchand)
          </p>
          <DisputeChat disputeId={d.id} currentUserId={user?.id} />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-text-primary">Gestion des litiges</h2>
        <button onClick={load} className="btn-secondary gap-2">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Actualiser
        </button>
      </div>

      {/* Statuts */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Ouverts" value={disputes.filter((d) => d.status === 'OPEN').length} icon={Eye} color="#D97706" loading={loading} />
        <StatCard label="En cours" value={disputes.filter((d) => d.status === 'UNDER_INVESTIGATION').length} icon={Clock} color="#3B82F6" loading={loading} />
        <StatCard label="En attente admin" value={disputes.filter((d) => d.status === 'PENDING_ADMIN_APPROVAL').length} icon={Shield} color="#F59E0B" loading={loading} />
        <StatCard label="Résolus" value={disputes.filter((d) => d.status === 'APPROVED' || d.status === 'REJECTED' || d.status === 'CLOSED').length} icon={CheckCircle} color="#22C55E" loading={loading} />
      </div>

      {/* Filtres */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => { setFilter(f.value); setSelectedId(null); setDetail(null); }}
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
          description={filter ? 'Aucun litige pour ce filtre.' : 'Tous les litiges ont été traités.'}
          action={{ label: 'Actualiser', onClick: load }}
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
                  setSelectedId(selectedId === d.id ? null : d.id);
                  setDetail(d);
                }}
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
                        Commande #{d.order?.id?.slice(-8) || d.orderId?.slice(-8)} ·{' '}
                        {d.client?.fullName || d.clientId?.slice(-8)} ·{' '}
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

const InfoItem = ({ icon: Icon, label, value, sub }) => (
  <div className="flex items-start gap-2">
    <Icon size={14} className="text-text-tertiary mt-0.5 shrink-0" strokeWidth={1.5} />
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase text-text-secondary">{label}</p>
      <p className="text-text-primary font-semibold truncate">{value || '—'}</p>
      {sub && <p className="text-text-secondary truncate">{sub}</p>}
    </div>
  </div>
);

export default DisputesTab;