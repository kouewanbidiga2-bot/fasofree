import React, { useState } from 'react';
import { Mic, MicOff, X, Check, Volume2 } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

const VoiceOrderButton = ({ isListening, transcript, results, supported, error, onToggle, onAddResults, onDismiss }) => {
  const { t } = useLanguage();
  const [showPanel, setShowPanel] = useState(false);

  if (!supported) return null;

  const handleMicClick = () => {
    onToggle();
    setShowPanel(true);
  };

  const handleDismiss = () => {
    setShowPanel(false);
    onDismiss?.();
  };

  const handleConfirmAdd = () => {
    onAddResults?.(results);
    setShowPanel(false);
    onDismiss?.();
  };

  return (
    <>
      {/* Floating mic button */}
      <button
        onClick={handleMicClick}
        className={`fixed bottom-24 left-4 sm:left-6 z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 ${
          isListening
            ? 'bg-red-500 animate-pulse scale-110'
            : 'bg-[#C1652E] hover:bg-[#a85522] active:scale-95'
        }`}
        aria-label="Commande vocale"
      >
        {isListening ? (
          <MicOff size={22} className="text-white" />
        ) : (
          <Mic size={22} className="text-white" />
        )}
      </button>

      {/* Voice panel */}
      {showPanel && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-end justify-center" onClick={handleDismiss}>
          <div
            className="w-full max-w-lg bg-background-primary rounded-t-2xl p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Volume2 size={18} className="text-[#C1652E]" />
                <h3 className="text-sm font-bold text-text-primary">Commande vocale</h3>
              </div>
              <button onClick={handleDismiss} className="p-1 hover:bg-background-secondary rounded-lg transition-colors">
                <X size={18} className="text-text-secondary" />
              </button>
            </div>

            {/* Status */}
            {isListening && (
              <div className="flex items-center gap-3 mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                <p className="text-sm text-red-600 dark:text-red-400 font-medium">Écoute en cours...</p>
              </div>
            )}

            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            {/* Transcript */}
            {transcript && (
              <div className="mb-4 p-3 bg-background-secondary rounded-lg">
                <p className="text-xs text-text-secondary mb-1">Vous avez dit :</p>
                <p className="text-sm text-text-primary font-medium italic">"{transcript}"</p>
              </div>
            )}

            {/* Matched results */}
            {results.length > 0 && (
              <div className="mb-4 space-y-2">
                <p className="text-xs text-text-secondary font-medium">Plats reconnus :</p>
                {results.map((r, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-background-secondary rounded-lg">
                    <div className="flex items-center gap-3">
                      <Check size={16} className="text-green-600" />
                      <div>
                        <p className="text-sm font-medium text-text-primary">{r.item.name}</p>
                        <p className="text-xs text-text-secondary">
                          {r.quantity}x · {r.item.price.toLocaleString()} FCFA
                          {r.confidence < 0.7 && ' · approximatif'}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-mono text-text-primary">
                      {(r.quantity * r.item.price).toLocaleString()} FCFA
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={isListening ? onToggle : handleMicClick}
                className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${
                  isListening
                    ? 'bg-red-500 text-white'
                    : 'bg-[#C1652E] text-white active:scale-[0.98]'
                }`}
              >
                {isListening ? 'Arrêter' : 'Parler'}
              </button>
              {results.length > 0 && (
                <button
                  onClick={handleConfirmAdd}
                  className="flex-1 py-3 rounded-xl text-sm font-bold bg-green-600 text-white active:scale-[0.98] transition-all"
                >
                  Ajouter au panier ({results.length} plat{results.length > 1 ? 's' : ''})
                </button>
              )}
            </div>

            {/* Hints */}
            {!transcript && !isListening && (
              <div className="mt-4 space-y-1">
                <p className="text-xs text-text-secondary font-medium">Dites par exemple :</p>
                <p className="text-xs text-text-tertiary italic">"Deux thiéboudienne et un jus de bouye"</p>
                <p className="text-xs text-text-tertiary italic">"Un poulet braisé frites"</p>
                <p className="text-xs text-text-tertiary italic">"Trois bissap et un hâtogo"</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default VoiceOrderButton;
