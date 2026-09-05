import { useState, useCallback, useRef, useEffect } from 'react';
import { matchMenuItems } from '../utils/voiceOrderParser';

const SpeechRecognition = typeof window !== 'undefined'
  ? window.SpeechRecognition || window.webkitSpeechRecognition
  : null;

export function useVoiceOrder(menuItems = [], onItemsMatched) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [results, setResults] = useState([]);
  const [supported, setSupported] = useState(false);
  const [error, setError] = useState('');
  const recognitionRef = useRef(null);

  useEffect(() => {
    setSupported(!!SpeechRecognition);
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }
    setIsListening(false);
  }, []);

  const startListening = useCallback(() => {
    if (!SpeechRecognition) {
      setError('La reconnaissance vocale nest pas supportée par votre navigateur');
      return;
    }

    setError('');
    setResults([]);
    setTranscript('');

    const recognition = new SpeechRecognition();
    recognition.lang = 'fr-FR';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setIsListening(true);
      setError('');
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

      setTranscript(finalTranscript || interimTranscript);

      if (finalTranscript) {
        const matched = matchMenuItems(finalTranscript, menuItems);
        setResults(matched);
        if (matched.length > 0 && onItemsMatched) {
          onItemsMatched(matched);
        }
      }
    };

    recognition.onerror = (event) => {
      setIsListening(false);
      if (event.error === 'no-speech') {
        setError('Aucun son détecté. Réessayez.');
      } else if (event.error === 'not-allowed') {
        setError("Accès au micro refusé. Autorisez l'accès dans les paramètres.");
      } else {
        setError('Erreur de reconnaissance vocale. Réessayez.');
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    try {
      recognition.start();
    } catch {
      setError('Impossible de démarrer la reconnaissance vocale.');
      setIsListening(false);
    }
  }, [menuItems, onItemsMatched]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  return {
    isListening,
    transcript,
    results,
    supported,
    error,
    startListening,
    stopListening,
    toggleListening,
  };
}
