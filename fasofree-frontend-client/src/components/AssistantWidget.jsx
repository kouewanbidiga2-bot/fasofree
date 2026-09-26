import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../services/api';

const DEFAULT_CHIPS = [
  'Comment commander ?',
  'Comment payer ?',
  'Où est ma commande ?',
  'Quel plat me conseilles-tu ?',
];

const WELCOME =
  "Bonjour 👋 Je suis l'assistant FasoFree : je vous guide dans l'application et je peux vous conseiller des plats.\nQue puis-je faire pour vous ?";

/**
 * 🤖 Widget assistant flottant (app client).
 *
 * - Bouton flottant en bas à droite (au-dessus de la BottomNav mobile).
 * - Détecte la page restaurant (/restaurant/:id) pour transmettre le
 *   `businessId` et obtenir des conseils basés sur le menu réel.
 * - Réponses du moteur local du backend (aucune clé API requise).
 */
export default function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [chips, setChips] = useState(DEFAULT_CHIPS);
  const location = useLocation();
  const listRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const businessId =
    location.pathname.match(/^\/restaurant\/([^/]+)/)?.[1] || undefined;

  useEffect(() => {
    if (open) {
      setMessages([{ role: 'bot', text: WELCOME }]);
      setChips(DEFAULT_CHIPS);
    }
  }, [open]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  async function send(text = input) {
    const question = (text || '').trim();
    if (!question || loading) return;
    setMessages((m) => [...m, { role: 'user', text: question }]);
    setInput('');
    setLoading(true);
    try {
      const res = await api.askAssistant(question, businessId);
      if (!mountedRef.current) return;
      setMessages((m) => [...m, { role: 'bot', text: res.answer }]);
      if (Array.isArray(res.suggestions) && res.suggestions.length) {
        setChips(res.suggestions);
      }
    } catch {
      if (!mountedRef.current) return;
      setMessages((m) => [
        ...m,
        {
          role: 'bot',
          text: 'Oups, je n’ai pas pu répondre (connexion). Réessayez dans un instant 🙏',
        },
      ]);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }

  return (
    <>
      {/* 🟠 Bouton flottant */}
      <button
        type="button"
        aria-label="Ouvrir l'assistant FasoFree"
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-24 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-accent-primary text-2xl text-white shadow-lg transition hover:scale-105 active:scale-95 md:bottom-6"
      >
        {open ? '✕' : '🤖'}
      </button>

      {/* 💬 Fenêtre de dialogue */}
      {open && (
        <div className="fixed bottom-40 right-4 z-50 flex max-h-[70vh] w-[min(92vw,360px)] flex-col overflow-hidden rounded-2xl border border-border-light bg-background-card shadow-2xl md:bottom-24">
          {/* En-tête */}
          <div className="flex items-center justify-between bg-accent-primary px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <span className="text-xl">🤖</span>
              <div>
                <p className="text-sm font-bold leading-tight">Assistant FasoFree</p>
                <p className="text-[11px] opacity-90">Conseils &amp; guide de la plateforme</p>
              </div>
            </div>
            <button
              type="button"
              aria-label="Fermer"
              onClick={() => setOpen(false)}
              className="text-white/80 transition hover:text-white"
            >
              ✕
            </button>
          </div>

          {/* Messages */}
          <div
            ref={listRef}
            role="log"
            aria-live="polite"
            className="flex-1 space-y-3 overflow-y-auto bg-background-secondary/60 px-3 py-4"
            style={{ minHeight: 260, maxHeight: '52vh' }}
          >
            {messages.map((msg, i) =>
              msg.role === 'user' ? (
                <div
                  key={i}
                  className="ml-auto w-fit max-w-[85%] whitespace-pre-line rounded-2xl rounded-br-md bg-accent-primary px-3 py-2 text-sm text-white"
                >
                  {msg.text}
                </div>
              ) : (
                <div
                  key={i}
                  className="mr-auto w-fit max-w-[85%] whitespace-pre-line rounded-2xl rounded-bl-md border border-border-light bg-background-card px-3 py-2 text-sm text-text-primary"
                >
                  {msg.text}
                </div>
              ),
            )}
            {loading && (
              <div className="mr-auto w-fit rounded-2xl rounded-bl-md border border-border-light bg-background-card px-3 py-2 text-sm text-text-secondary">
                <span className="inline-flex gap-1">
                  <span className="animate-bounce">●</span>
                  <span className="animate-bounce [animation-delay:120ms]">●</span>
                  <span className="animate-bounce [animation-delay:240ms]">●</span>
                </span>
              </div>
            )}
          </div>

          {/* Suggestions rapides */}
          {chips.length > 0 && !loading && (
            <div className="flex flex-wrap gap-1.5 border-t border-border-light bg-background-card px-3 pt-2">
              {chips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => send(chip)}
                  className="rounded-full border border-accent-primary/30 bg-accent-primary/5 px-3 py-1 text-xs font-medium text-accent-primary transition hover:bg-accent-primary/10"
                >
                  {chip}
                </button>
              ))}
            </div>
          )}

          {/* Saisie */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex items-center gap-2 bg-background-card p-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Écrivez votre question…"
              aria-label="Votre question"
              className="flex-1 rounded-full border border-border-light bg-background-secondary px-4 py-2 text-sm text-text-primary outline-none transition focus:border-accent-primary"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="rounded-full bg-accent-primary px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Envoyer
            </button>
          </form>
        </div>
      )}
    </>
  );
}