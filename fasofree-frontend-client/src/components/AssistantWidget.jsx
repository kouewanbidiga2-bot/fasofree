/**
 * Copyright (c) 2026 BIDIGA Imrane - Koliwa. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowUp, Mic, Square, Volume2, X } from 'lucide-react';
import api from '../services/api';
import CallSupportButton from './CallSupportButton';
import DeliveryGlyph from './DeliveryGlyph';
import { normalizeTrackingReference } from '../utils/trackingReference';
import useAuthStore from '../store/authStore';

const ADDRESS_HELP = 'Cherchez un quartier ou un repère près de l’entrée. Si le lieu manque, choisissez « Placer l’entrée sur la carte » ou collez un lien Google Maps dans le formulaire.';
const TRACKING_HELP = 'Ouvrez le suivi avec le numéro Koliwa du colis. Si la position du livreur date de plusieurs minutes, vérifiez à nouveau dans quelques instants. Le code de réception reste réservé au destinataire.';

const ROUTES = {
  send: { label: 'Envoyer un colis', to: '/p2p-delivery', glyph: 'parcel' },
  pickup: { label: 'Retrait en boutique', to: '/p2p-delivery?mode=merchant-pickup', glyph: 'pickup' },
  track: { label: 'Suivre un colis', to: '/suivre', glyph: 'track' },
  history: { label: 'Mes livraisons', to: '/order-history', glyph: 'history' },
  support: { label: 'Signaler un problème', to: '/disputes', glyph: 'help' },
  signup: { label: 'Ouvrir l’inscription', to: '/register', glyph: 'profile' },
  login: { label: 'Ouvrir la connexion', to: '/auth', glyph: 'profile' },
};
const QUICK_ACTIONS = ['send', 'pickup', 'track', 'support'].map((id) => ({ id }));
const CONTRACT = 'koliwa-delivery-v1';

export default function AssistantWidget({ hideLauncher = false } = {}) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const initialHelp = pathname === '/p2p-delivery' ? ADDRESS_HELP
    : pathname === '/suivre' || pathname.startsWith('/track/') ? TRACKING_HELP
      : 'Envoyer un colis, trouver un lieu ou suivre une livraison ?';
  const dialogRef = useRef(null);
  const messagesRef = useRef(null);
  const inputRef = useRef(null);
  const requestRef = useRef(null);
  const recognitionRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const SpeechRecognition = window.isSecureContext && (window.SpeechRecognition || window.webkitSpeechRecognition);
  const canSpeak = typeof window.speechSynthesis?.speak === 'function' && typeof window.SpeechSynthesisUtterance === 'function';

  const stopSpeech = useCallback(() => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }, []);

  const openPanel = useCallback(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const startVoice = useCallback(() => {
    if (!SpeechRecognition || recognitionRef.current) return;
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = 'fr-FR';
    recognition.maxAlternatives = 1;
    setListening(true);
    setVoiceError('');
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();
      if (transcript) {
        setInput(transcript.slice(0, 500));
        inputRef.current?.focus();
      }
    };
    recognition.onerror = (event) => {
      if (event.error !== 'aborted') setVoiceError('Le micro est indisponible. Vous pouvez écrire votre question.');
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
    };
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setListening(false);
      setVoiceError('Le micro est indisponible. Vous pouvez écrire votre question.');
    }
  }, [SpeechRecognition]);

  useEffect(() => {
    const openAndListen = () => {
      openPanel();
      startVoice();
    };
    window.addEventListener('koliwa:open-assistant', openPanel);
    window.addEventListener('koliwa:voice-command', openAndListen);
    return () => {
      window.removeEventListener('koliwa:open-assistant', openPanel);
      window.removeEventListener('koliwa:voice-command', openAndListen);
    };
  }, [openPanel, startVoice]);

  useEffect(() => () => {
    requestRef.current?.abort();
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.abort();
    }
    window.speechSynthesis?.cancel();
  }, []);

  useEffect(() => {
    const list = messagesRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages, loading]);

  function openAction({ id, reference }) {
    const { to } = ROUTES[id];
    const tracking = id === 'track' && typeof reference === 'string' ? normalizeTrackingReference(reference) : null;
    dialogRef.current?.close();
    if (id === 'support' && !isAuthenticated) {
      navigate('/auth', { state: { from: { pathname: to } } });
      return;
    }
    navigate(to, tracking ? { state: { reference: tracking } } : undefined);
  }

  async function send(event) {
    event.preventDefault();
    const question = input.trim();
    if (question.length < 2 || requestRef.current) return;

    const request = new AbortController();
    requestRef.current = request;
    const deadline = window.setTimeout(() => request.abort('timeout'), 10000);
    stopSpeech();
    setInput('');
    setVoiceError('');
    setLoading(true);
    setMessages((current) => [...current, { role: 'user', text: question }]);
    try {
      const response = await api.askAssistant(question, request.signal);
      if (response?.contract !== CONTRACT || typeof response.answer !== 'string') throw new Error('Réponse indisponible');
      const actions = Array.isArray(response.actions)
        ? response.actions.filter((action) => action && Object.hasOwn(ROUTES, action.id))
        : [];
      if (!request.signal.aborted) setMessages((current) => [...current, { role: 'assistant', text: response.answer, actions }]);
    } catch {
      if (!request.signal.aborted || request.signal.reason === 'timeout') {
        setMessages((current) => [
          ...current,
          { role: 'assistant', text: 'Le guide est momentanément indisponible. Vous pouvez continuer avec l’un de ces raccourcis.', actions: QUICK_ACTIONS },
        ]);
      }
    } finally {
      window.clearTimeout(deadline);
      requestRef.current = null;
      if (!request.signal.aborted || request.signal.reason === 'timeout') setLoading(false);
    }
  }

  function readReply() {
    const latest = [...messages].reverse().find((message) => message.role === 'assistant');
    if (!latest || !canSpeak) return;
    if (speaking) {
      stopSpeech();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(latest.text);
    utterance.lang = 'fr-FR';
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }

  function actionsList(actions) {
    return (
      <ul className="koliwa-help-actions">
        {actions.map((action) => {
          const { label, glyph } = ROUTES[action.id];
          return (
            <li key={action.id}>
              <button type="button" onClick={() => openAction(action)}>
                <DeliveryGlyph kind={glyph} />
                {action.id === 'support' && !isAuthenticated ? 'Se connecter pour signaler un problème' : label}
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <>
      {!hideLauncher && (
        <button type="button" className="assistant-launcher koliwa-help-launcher" onClick={openPanel} aria-label="Ouvrir l’aide Koliwa">
          <DeliveryGlyph kind="help" />
        </button>
      )}
      <dialog
        className="koliwa-help"
        ref={dialogRef}
        aria-labelledby="koliwa-help-title"
        onClose={() => {
          recognitionRef.current?.abort();
          stopSpeech();
        }}
      >
        <div className="koliwa-help-frame">
          <header className="koliwa-help-header">
            <span className="koliwa-help-symbol"><DeliveryGlyph kind="help" /></span>
            <h2 id="koliwa-help-title">Assistant Koliwa</h2>
            {canSpeak && messages.some((message) => message.role === 'assistant') && (
              <button type="button" className="koliwa-help-icon" onClick={readReply} aria-label={speaking ? 'Arrêter la lecture' : 'Lire la dernière réponse'}>
                {speaking ? <Square size={17} aria-hidden="true" /> : <Volume2 size={19} aria-hidden="true" />}
              </button>
            )}
            <button type="button" className="koliwa-help-icon" onClick={() => dialogRef.current?.close()} aria-label="Fermer l’assistant">
              <X size={21} aria-hidden="true" />
            </button>
          </header>

          <div className="koliwa-help-log" ref={messagesRef} role="log" aria-label="Conversation" aria-busy={loading}>
            {messages.length === 0 && (
              <div className="koliwa-help-start">
                <p>{initialHelp}</p>
                {actionsList(QUICK_ACTIONS)}
              </div>
            )}
            {messages.map(({ role, text, actions }, index) => (
              <div key={index} className="koliwa-help-message" data-role={role}>
                <p>{text}</p>
                {actions?.length > 0 && actionsList(actions)}
              </div>
            ))}
            {loading && <p className="koliwa-help-pending" role="status">Recherche de la réponse…</p>}
          </div>

          <div className="koliwa-help-bottom">
            {voiceError && <p className="koliwa-help-voice-error" role="status">{voiceError}</p>}
            <form className="koliwa-help-form" onSubmit={send}>
              <input ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} maxLength={500} placeholder="Votre question" aria-label="Votre question" />
              {SpeechRecognition && (
                <button type="button" className="koliwa-help-icon" disabled={listening || loading} onClick={startVoice} aria-label={listening ? 'Écoute en cours' : 'Dicter une question'}>
                  <Mic size={19} aria-hidden="true" />
                </button>
              )}
              <button type="submit" className="koliwa-help-send" disabled={loading || input.trim().length < 2} aria-label="Envoyer la question">
                <ArrowUp size={21} aria-hidden="true" />
              </button>
            </form>
            <CallSupportButton variant="link" className="koliwa-help-contact" />
          </div>
        </div>
      </dialog>
    </>
  );
}
