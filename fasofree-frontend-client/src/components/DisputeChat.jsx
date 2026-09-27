import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import api from '../services/api';
import { getSupportSocket } from '../services/realtime';
import CallSupportButton from './CallSupportButton';

/**
 * 💬 Chat support d'une réclamation.
 *
 * - Envoi : REST POST /disputes/:id/messages (route backend garantie).
 * - Réception temps réel : WS /support (events joinDispute / newDisputeMessage).
 * - Le chat est ouvert au client, au support / admin / super admin et au
 *   gérant du commerce concerné.
 */
const ROLES_LABELS = {
  SUPPORT: 'Support FasoFree',
  ADMIN: 'Administration',
  SUPER_ADMIN: 'Administration',
  BUSINESS_ADMIN: 'Marchand',
  CLIENT: 'Vous',
};

const DisputeChat = ({ disputeId }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const boxRef = useRef(null);
  const socket = getSupportSocket();

  // Chargement REST + inscription au salon WS au dépliage
  useEffect(() => {
    if (!disputeId) return;
    let cancelled = false;
    setLoading(true);

    api
      .getDisputeMessages(disputeId)
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

  // Auto-scroll vers le bas
  useEffect(() => {
    if (boxRef.current) {
      boxRef.current.scrollTop = boxRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const sent = await api.sendDisputeMessage(disputeId, text);
      setInput('');
      if (sent && sent.id) {
        setMessages((prev) =>
          prev.some((m) => m.id === sent.id) ? prev : [...prev, sent],
        );
      }
    } catch (err) {
      setSendError(err.message || "Impossible d'envoyer le message.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-border-light">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-xs font-semibold text-text-secondary">
          Discuter avec le support
        </p>
        <CallSupportButton variant="link" label="Appeler" className="text-xs" />
      </div>

      <div
        ref={boxRef}
        className="bg-background-primary rounded-lg p-3 h-44 overflow-y-auto mb-2 space-y-2"
      >
        {loading ? (
          <div className="flex justify-center pt-8">
            <Loader2 size={18} className="animate-spin text-text-secondary" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-xs text-text-secondary text-center pt-6">
            Aucun message. Posez votre question au support : il vous répondra
            ici même.
          </p>
        ) : (
          messages.map((m, i) => {
            const mine = m.senderRole === 'CLIENT';
            const label = ROLES_LABELS[m.senderRole] || 'Support FasoFree';
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
                  <p className="text-[10px] text-text-secondary mb-0.5">
                    {m.senderName || label}
                  </p>
                )}
                <p className="text-sm break-words whitespace-pre-wrap">{m.message}</p>
                <p
                  className={`text-[10px] mt-0.5 ${
                    mine ? 'text-white/70' : 'text-text-secondary'
                  }`}
                >
                  {new Date(m.createdAt || m.timestamp).toLocaleTimeString(
                    'fr-FR',
                    { hour: '2-digit', minute: '2-digit' },
                  )}
                </p>
              </div>
            );
          })
        )}
      </div>

      {sendError && (
        <p className="text-xs text-red-500 mb-1">{sendError}</p>
      )}

      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Écrire au support…"
          className="flex-1 px-3 py-2.5 text-sm border border-border-light focus:outline-none focus:border-accent-primary disabled:opacity-50"
        />
        <button
          onClick={sendMessage}
          disabled={sending || !input.trim()}
          className="px-4 flex items-center justify-center text-white transition-opacity disabled:opacity-40"
          style={{ backgroundColor: '#C1652E' }}
        >
          {sending ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Send size={16} strokeWidth={1.5} />
          )}
        </button>
      </div>
    </div>
  );
};

export default DisputeChat;