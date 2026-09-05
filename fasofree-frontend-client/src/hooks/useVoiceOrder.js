import { useState, useCallback, useRef, useEffect } from 'react';
import { matchMenuItems } from '../utils/voiceOrderParser';

const SpeechRecognition = typeof window !== 'undefined'
  ? window.SpeechRecognition || window.webkitSpeechRecognition
  : null;

export function useVoiceOrder(menuItems = []) {
  const [phase, setPhase] = useState('idle'); // idle | listening | done | error
  const [transcript, setTranscript] = useState('');
  const [results, setResults] = useState([]);
  const [supported, setSupported] = useState(false);
  const [error, setError] = useState('');
  const recognitionRef = useRef(null);

  useEffect(() => {
    setSupported(!!SpeechRecognition);
  }, []);

  const cleanup = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
      recognitionRef.current = null;
    }
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const stopListening = useCallback(() => {
    cleanup();
    setPhase('done');
  }, [cleanup]);

  const startListening = useCallback(() => {
    if (!SpeechRecognition) {
      setError('La reconnaissance vocale n\'est pas supportée par votre navigateur');
      setPhase('error');
      return;
    }

    cleanup();
    setError('');
    setResults([]);
    setTranscript('');
    setPhase('listening');

    const recognition = new SpeechRecognition();
    recognition.lang = 'fr-FR';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setPhase('listening');
    };

    recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += t;
        } else {
          interimTranscript += t;
        }
      }

      const displayText = finalTranscript || interimTranscript;
      setTranscript(displayText);

      if (finalTranscript) {
        const matched = matchMenuItems(finalTranscript, menuItems);
        setResults(matched);
      }
    };

    recognition.onerror = (event) => {
      recognitionRef.current = null;
      if (event.error === 'no-speech') {
        setPhase('done');
        if (!transcript) setError('Aucun son détecté. Réessayez.');
      } else if (event.error === 'not-allowed') {
        setPhase('error');
        setError("Accès au micro refusé. Autorisez l'accès dans les paramètres.");
      } else if (event.error === 'aborted') {
        setPhase('done');
      } else {
        setPhase('done');
        setError('Erreur de reconnaissance vocale. Réessayez.');
      }
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      if (phase === 'listening') {
        setPhase('done');
      }
    };

    try {
      recognition.start();
    } catch {
      setPhase('error');
      setError('Impossible de démarrer la reconnaissance vocale.');
    }
  }, [menuItems, transcript, phase, cleanup]);

  const reset = useCallback(() => {
    cleanup();
    setPhase('idle');
    setTranscript('');
    setResults([]);
    setError('');
  }, [cleanup]);

  const retry = useCallback(() => {
    cleanup();
    setTranscript('');
    setResults([]);
    setError('');
    startListening();
  }, [cleanup, startListening]);

  return {
    phase,
    isListening: phase === 'listening',
    transcript,
    results,
    supported,
    error,
    startListening,
    stopListening,
    reset,
    retry,
  };
}
