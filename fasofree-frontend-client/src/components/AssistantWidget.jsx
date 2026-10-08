import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Mic, Volume2, VolumeX } from 'lucide-react';
import api from '../services/api';
import CallSupportButton from './CallSupportButton';
import { hasSupportPhone } from '../utils/support';

const DEFAULT_CHIPS = [
  'Comment commander ?',
  'Comment payer ?',
  'Où est ma commande ?',
  'Quel plat me conseilles-tu ?',
];

const WELCOME =
  "Bonjour 👋 Je suis l'assistant FasoFree : je vous guide dans l'application et je peux vous conseiller des plats.\nQue puis-je faire pour vous ?";

// 💬 Bulle d'ouverture : apparaît juste après la fin du SplashScreen (1300 ms),
// visible ~2 s, une seule fois par chargement de page.
const HINT_SHOW_DELAY = 1450;
const BUBBLE_DURATION_MS = 2600;

/** Logo « feuille » FasoFree — l'identité visuelle de l'app (cf. SplashScreen). */
function FasoFreeMark({ className = 'h-8 w-8', color = '#B95B2B' }) {
  return (
    <svg viewBox="0 0 140 140" fill="none" className={className} aria-hidden="true">
      <ellipse cx="70" cy="70" rx="44" ry="52" stroke={color} strokeWidth="4" />
      <path d="M38 50 Q70 22 102 50" stroke={color} strokeWidth="3" strokeLinecap="round" opacity="0.6" />
      <path d="M50 62 Q58 56 66 62 Q58 68 50 62Z" fill={color} opacity="0.9" />
      <path d="M74 62 Q82 56 90 62 Q82 68 74 62Z" fill={color} opacity="0.9" />
      <path d="M70 62 L64 84 L76 84 Z" fill={color} opacity="0.55" />
      <path d="M56 96 Q70 104 84 96" stroke={color} strokeWidth="3" strokeLinecap="round" />
      <circle cx="70" cy="70" r="3" fill={color} opacity="0.3" />
    </svg>
  );
}

/**
 * 🤖 Widget assistant flottant (app client).
 *
 * - Bouton flottant avec le logo FasoFree (le « visage » de l'app).
 * - Bulle « Posez une question » de ~2 s à l'ouverture de l'app, pointant
 *   l'icône (une fois par chargement de page, après le SplashScreen).
 * - Mode mobile : panneau plein écran scrollable ; desktop : carte flottante.
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
  const [hint, setHint] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const mountedRef = useRef(true);
  // 🎤 Mode vocal : micro pour poser la question + lecture des réponses
  const [listening, setListening] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const voiceEnabledRef = useRef(true);
  voiceEnabledRef.current = voiceEnabled;
  const lastInputWasVoice = useRef(false);
  // Référence vers startVoiceInput pour les événements globaux (boutons 🎤)
  const startVoiceRef = useRef(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // 💬 Indication d'ouverture : apparaît après le SplashScreen, disparaît après ~2 s.
  useEffect(() => {
    const showTimer = setTimeout(() => {
      if (mountedRef.current) setHint(true);
    }, HINT_SHOW_DELAY);
    const hideTimer = setTimeout(() => {
      if (mountedRef.current) setHint(false);
    }, HINT_SHOW_DELAY + BUBBLE_DURATION_MS);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  // Esc ferme le chat (mobile comme desktop).
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape' && mountedRef.current) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const businessId =
    location.pathname.match(/^\/restaurant\/([^/]+)/)?.[1] || undefined;

  useEffect(() => {
    if (open) {
      setMessages([{ role: 'bot', text: WELCOME }]);
      setChips(DEFAULT_CHIPS);
      inputRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  // 🗣️ Lecture vocale des réponses (réponse API → voix)
  const speakAnswer = useCallback((text) => {
    if (!voiceEnabledRef.current) return;
    try {
      if (typeof window === 'undefined' || !window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'fr-FR';
      utter.rate = 0.98;
      window.speechSynthesis.speak(utter);
    } catch {
      /* synthèse vocale indisponible */
    }
  }, []);

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
      // 🎙️ Si la question vient de la voix, on lit la réponse à haute
      // voix (sinon ça surprendrait un utilisateur qui tape au clavier).
      if (lastInputWasVoice.current) {
        speakAnswer(res.answer);
        lastInputWasVoice.current = false;
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

  // 🧠 Action à exécuter selon la commande vocale (Gemini)
  function executeVoiceAction(action, query) {
    switch (action) {
      case 'open_search':
      case 'open_restaurant':
        navigate(query ? `/search?q=${encodeURIComponent(query)}` : '/search');
        break;
      case 'open_cart':
        navigate('/cart');
        break;
      case 'open_orders':
      case 'track_order':
        navigate('/order-history');
        break;
      case 'open_checkout':
        navigate('/checkout');
        break;
      default:
        break;
    }
  }

  // 🎙️ Commande vocale : transcript → action structurée (Gemini) → exécution
  async function handleVoiceCommand(text) {
    setMessages((m) => [...m, { role: 'user', text }]);
    setInput('');
    setLoading(true);
    try {
      const res = await api.voiceAction(text, businessId);
      if (!mountedRef.current) return;
      if (res?.action && res.action !== 'none') {
        const msg = res.message || 'Bien sûr.';
        setMessages((m) => [...m, { role: 'bot', text: msg }]);
        speakAnswer(msg);
        executeVoiceAction(res.action, res.query);
        return;
      }
      const answer = res?.answer || res?.message || 'Je n’ai pas compris. Pouvez-vous reformuler ?';
      setMessages((m) => [...m, { role: 'bot', text: answer }]);
      speakAnswer(answer);
    } catch {
      if (!mountedRef.current) return;
      try {
        const res = await api.askAssistant(text, businessId);
        if (!mountedRef.current) return;
        setMessages((m) => [...m, { role: 'bot', text: res.answer }]);
        speakAnswer(res.answer);
      } catch {
        setMessages((m) => [...m, { role: 'bot', text: 'Oups, je n’ai pas pu traiter cette commande vocale. Réessayez 🙏' }]);
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }

  // 🎙️ Question posée à la voix → transcrite → API assistant → réponse lue
  const startVoiceInput = () => {
    const SR =
      typeof window !== 'undefined' &&
      (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SR) {
      setMessages((m) => [
        ...m,
        {
          role: 'bot',
          text: "Désolé, la reconnaissance vocale n'est pas supportée sur ce navigateur. 😅",
        },
      ]);
      return;
    }
    const recognition = new SR();
    recognition.lang = 'fr-FR';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setListening(true);
    recognition.onresult = (event) => {
      const text = event.results?.[0]?.[0]?.transcript?.trim();
      if (text) {
        lastInputWasVoice.current = true;
        handleVoiceCommand(text);
      }
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    try {
      recognition.start();
    } catch {
      setListening(false);
    }
  };

  startVoiceRef.current = startVoiceInput;

  // 🌐 Boutons 🎤 externes (barres de recherche) : ouvrent l'assistant
  // et lancent directement l'écoute vocale.
  useEffect(() => {
    const openAssistant = () => setOpen(true);
    const openAndListen = () => {
      setOpen(true);
      window.setTimeout(() => startVoiceRef.current?.(), 350);
    };
    window.addEventListener('fasofree:open-assistant', openAssistant);
    window.addEventListener('fasofree:voice-command', openAndListen);
    return () => {
      window.removeEventListener('fasofree:open-assistant', openAssistant);
      window.removeEventListener('fasofree:voice-command', openAndListen);
    };
  }, []);

  // 🗑️ Couper toute lecture vocale en quittant l'app
  useEffect(() => {
    return () => {
      try {
        window.speechSynthesis?.cancel();
      } catch {}
    };
  }, []);

  function openWidget() {
    setHint(false);
    setOpen(true);
  }

  return (
    <>
      {/* 💬 Indication d'ouverture (~2 s) pointant l'icône */}
      {!open && hint && (
        <button
          type="button"
          onClick={openWidget}
          className="fixed bottom-[calc(11rem+env(safe-area-inset-bottom))] right-4 z-50 w-[248px] cursor-pointer rounded-2xl border border-accent-primary/25 bg-background-primary px-4 py-3 text-left text-sm font-medium text-text-primary shadow-elevated motion-safe:animate-[fasofree-bubble_2.6s_ease-out_forwards] md:bottom-[6.5rem]"
        >
          <span className="mr-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent-primary/10 align-middle text-xs">
            💬
          </span>
          <span className="align-middle">Posez une question à l'assistant</span>
          <span
            aria-hidden="true"
            className="absolute -bottom-1.5 right-7 h-3 w-3 rotate-45 border-b border-r border-accent-primary/25 bg-background-primary"
          />
        </button>
      )}

      {/* 📍 Bouton flottant = l'assistant vocal (logo FasoFree + libellé + micro) */}
      <div className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] right-4 z-50 md:bottom-6">
        <div className="flex items-center gap-2">
          {!open && (
            <span className="whitespace-nowrap rounded-full border border-border-light bg-background-card px-3 py-1.5 text-xs font-bold text-text-primary shadow-subtle">
              🎤 Assistant vocal
            </span>
          )}
          <div className="relative">
            {!open && hint && (
              <span
                aria-hidden="true"
                className="absolute inset-0 motion-safe:animate-ping rounded-full bg-white/40"
              />
            )}
            <button
              type="button"
              aria-label={
                open ? "Fermer l'assistant" : "Ouvrir l'assistant vocal FasoFree"
              }
              onClick={() => setOpen((o) => !o)}
              className="relative flex h-14 w-14 items-center justify-center rounded-full bg-accent-primary text-white shadow-elevated transition hover:scale-105 active:scale-95"
            >
              {open ? (
                <span className="text-2xl font-bold leading-none">✕</span>
              ) : (
                <>
                  <FasoFreeMark className="h-8 w-8" color="#FFFDFC" />
                  <span
                    aria-hidden="true"
                    className="absolute -bottom-0.5 -right-0.5 grid h-6 w-6 place-items-center rounded-full border-2 border-background-primary bg-[#2E9B5B] text-white"
                  >
                    <Mic size={12} strokeWidth={2.4} />
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 💬 Fenêtre de dialogue : plein écran sur mobile, carte flottante sur desktop */}
      {open && (
        <div
          role="dialog"
          aria-label="Assistant FasoFree"
          className="fixed inset-0 z-[60] flex flex-col bg-background-card md:inset-auto md:bottom-24 md:right-4 md:z-50 md:h-[70vh] md:w-[360px] md:overflow-hidden md:rounded-2xl md:border md:border-border-light md:shadow-elevated"
        >
          {/* En-tête avec le logo */}
          <div className="flex shrink-0 items-center justify-between bg-accent-primary px-4 py-3 text-white">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/95 shadow-sm">
                <FasoFreeMark className="h-6 w-6" />
              </span>
              <div>
                <p className="text-sm font-bold leading-tight">Assistant FasoFree</p>
                <p className="text-[11px] opacity-90">Conseils menu &amp; guide de l'app</p>
              </div>
            </div>
            <button
              type="button"
              aria-label="Fermer l'assistant"
              onClick={() => setOpen(false)}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              ✕
            </button>
          </div>

          {/* Messages — zone scrollable (min-h-0 est requis pour le scroll en flex) */}
          <div
            ref={listRef}
            role="log"
            aria-live="polite"
            className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain bg-background-secondary/60 px-3 py-4"
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
            <div className="flex shrink-0 flex-wrap gap-1.5 border-t border-border-light bg-background-card px-3 pt-2">
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

          {/* Hotline — masquée sans numéro configuré */}
          {hasSupportPhone && (
            <div className="shrink-0 border-t border-border-light bg-background-card px-3 pt-2 pb-1">
              <CallSupportButton
                variant="link"
                label="Besoin de plus d'aide ? Appeler le support"
                className="text-xs justify-center w-full"
              />
            </div>
          )}

          {/* Saisie — marge basse sûre (iPhone) */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex shrink-0 items-center gap-2 bg-background-card p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:pb-3"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Écrivez votre question…"
              aria-label="Votre question"
              className="min-w-0 flex-1 rounded-full border border-border-light bg-background-secondary px-4 py-2 text-sm text-text-primary outline-none transition focus:border-accent-primary"
            />
            <button
              type="button"
              onClick={() => setVoiceEnabled((v) => !v)}
              aria-label={voiceEnabled ? 'Désactiver la lecture vocale' : 'Activer la lecture vocale'}
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-full transition ${
                voiceEnabled
                  ? 'bg-accent-primary/10 text-accent-primary'
                  : 'bg-background-secondary text-text-tertiary'
              }`}
            >
              {voiceEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
            <button
              type="button"
              onClick={startVoiceInput}
              disabled={loading || listening}
              aria-label={listening ? 'Écoute en cours…' : 'Poser une question à la voix'}
              title="Commande vocale : parlez pour rechercher, commander, suivre…"
              className={`grid h-11 w-11 shrink-0 place-items-center rounded-full transition ${
                listening
                  ? 'animate-pulse bg-status-error text-white'
                  : 'bg-[#2E9B5B] text-white shadow-subtle hover:opacity-90 active:scale-95'
              }`}
            >
              <Mic size={19} strokeWidth={2.2} />
            </button>
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="shrink-0 rounded-full bg-accent-primary px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Envoyer
            </button>
          </form>
          {listening && (
            <p className="shrink-0 px-4 pb-2 text-xs font-medium text-status-error">
              Écoute en cours… parlez maintenant, puis attendez.
            </p>
          )}
        </div>
      )}
    </>
  );
}