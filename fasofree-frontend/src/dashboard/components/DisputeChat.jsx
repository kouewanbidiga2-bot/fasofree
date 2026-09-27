/**
 * FasoFree — 💬 Chat support d'un litige (composant partagé).
 * Utilisé par l'administration (DisputesTab) et par le gérant du commerce
 * (MerchantDisputesTab).
 * - Historique REST au chargement (route garantie).
 * - Temps réel WS /support : join/leave + newDisputeMessage.
 * - Envoi REST uniquement (pas de double persistance).
 * - Litige clôturé (join renvoie closed) : lecture seule.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import {
  getDisputeMessages,
  sendDisputeMessage,
} from '../../services/disputeService';
import { getSupportSocket } from '../../services/realtime';

const ROLE_LABELS = {
  CLIENT: 'Client',
  SUPPORT: 'Support',
  ADMIN: 'Admin',
  SUPER_ADMIN: 'Super Admin',
  BUSINESS_ADMIN: 'Marchand',
};

// Les rôles sont stockés en minuscules côté serveur ; normaliser au point de
// lecture (sinon ROLE_LABELS['client'] → undefined → repli 'Support' partout).
const roleLabel = (role) =>
  ROLE_LABELS[String(role || '').toUpperCase()] || 'Support';

// Statuts terminaux : le chat devient lecture seule même sans attendre l'ack WS
// (le parent connaît déjà le statut du litige).
const TERMINAL_STATUSES = ['APPROVED', 'REJECTED', 'CLOSED'];

const formatTime = (d) =>
  d
    ? new Date(d).toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

const DisputeChat = ({ disputeId, currentUserId, status }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [closed, setClosed] = useState(false);
  const boxRef = useRef(null);
  const socket = getSupportSocket();
  const readOnly = closed || TERMINAL_STATUSES.includes(status);

  useEffect(() => {
    if (!disputeId) return;
    let cancelled = false;
    setMessages([]);
    setClosed(false);
    setError(null);
    setLoading(true);

    getDisputeMessages(disputeId)
      .then((list) => {
        if (!cancelled) setMessages(Array.isArray(list) ? list : []);
      })
      .catch((err) => {
        if (!cancelled)
          setError(err.message || "Impossible de charger l'historique.");
      })
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
      if (!res) return;
      if (res.status === 'error') {
        if (!cancelled)
          setError(res.message || "Impossible de rejoindre le chat support.");
        return;
      }
      if (res.closed === true && !cancelled) setClosed(true);
      if (res.status === 'ok' && Array.isArray(res.history)) {
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
    if (!text || sending || readOnly) return;
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
        role="log"
        aria-live="polite"
        aria-label="Messages du litige"
        className="bg-background-secondary/50 border border-border-light rounded-lg p-3 max-h-56 overflow-y-auto mb-2 space-y-2"
      >
        {loading ? (
          <div className="flex justify-center pt-6">
            <Loader2 size={18} className="animate-spin text-text-tertiary" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-xs text-text-tertiary text-center pt-6">
            Aucun message. Discutez pour régler le litige.
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
                    {m.senderName || roleLabel(m.senderRole)}
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

      {readOnly && (
        <p className="text-xs text-text-secondary mb-1 italic">
          Ce litige est clôturé : le chat est en lecture seule.
        </p>
      )}

      {error && (
        <p role="status" className="text-xs text-status-error mb-1">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          disabled={readOnly}
          placeholder={readOnly ? 'Lecture seule' : 'Écrire un message…'}
          aria-label="Votre message"
          className="flex-1 bg-background-card border border-border-light rounded-lg px-3 py-2 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-accent-primary disabled:opacity-50"
        />
        <button
          onClick={send}
          disabled={sending || !input.trim() || readOnly}
          className="px-3 py-2 bg-accent-primary text-white text-xs font-semibold rounded-lg disabled:opacity-40 hover:bg-accent-primary/90 transition flex items-center gap-1.5"
        >
          {sending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Send size={14} />
          )}
          Envoyer
        </button>
      </div>
    </div>
  );
};

export default DisputeChat;