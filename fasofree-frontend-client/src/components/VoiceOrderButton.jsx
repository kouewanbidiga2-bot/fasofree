import React, { useState } from 'react';
import { Mic, MicOff, X, Check, Volume2, RotateCcw } from 'lucide-react';

const VoiceOrderButton = ({ phase, transcript, results, supported, error, onStart, onStop, onReset, onRetry, onAddResults }) => {
  const [showPanel, setShowPanel] = useState(false);

  if (!supported) return null;

  const handleMicClick = () => {
    setShowPanel(true);
    onStart?.();
  };

  const handleClose = () => {
    setShowPanel(false);
    onReset?.();
  };

  const handleConfirmAdd = () => {
    onAddResults?.(results);
    setShowPanel(false);
    onReset?.();
  };

  return (
    <>
      {/* Floating mic button */}
      <button
        onClick={handleMicClick}
        className={`fixed bottom-24 right-20 sm:right-24 z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 ${
          phase === 'listening'
            ? 'bg-red-500 animate-pulse scale-110'
            : 'bg-[#C1652E] hover:bg-[#a85522] active:scale-95'
        }`}
        aria-label="Commande vocale"
      >
        {phase === 'listening' ? (
          <MicOff size={22} className="text-white" />
        ) : (
          <Mic size={22} className="text-white" />
        )}
      </button>

      {/* Voice panel */}
      {showPanel && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-end justify-center" onClick={handleClose}>
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
              <button onClick={handleClose} className="p-1 hover:bg-background-secondary rounded-lg transition-colors">
                <X size={18} className="text-text-secondary" />
              </button>
            </div>

            {/* Listening indicator */}
            {phase === 'listening' && (
              <div className="flex items-center gap-3 mb-4 p-3 bg-red-50 rounded-lg">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <p className="text-sm text-red-600 font-medium">Ecoute en cours...</p>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
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
                          {r.quantity}x {r.item.price.toLocaleString()} FCFA
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

            {/* No results after speaking */}
            {phase === 'done' && transcript && results.length === 0 && !error && (
              <div className="mb-4 p-3 bg-amber-50 rounded-lg">
                <p className="text-sm text-amber-700">Aucun plat reconnu. Essayez avec un autre mot.</p>
              </div>
            )}

            {/* BUTTONS */}
            <div className="flex gap-3">
              {/* During listening: Annuler */}
              {phase === 'listening' && (
                <button
                  onClick={() => { handleClose(); }}
                  className="flex-1 py-3 rounded-xl text-sm font-bold bg-gray-200 text-gray-700 active:scale-[0.98] transition-all"
                >
                  Annuler
                </button>
              )}

              {/* After listening with results: Soumettre + Annuler */}
              {phase === 'done' && results.length > 0 && (
                <>
                  <button
                    onClick={handleClose}
                    className="py-3 px-5 rounded-xl text-sm font-bold bg-gray-200 text-gray-700 active:scale-[0.98] transition-all"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleConfirmAdd}
                    className="flex-1 py-3 rounded-xl text-sm font-bold bg-[#C1652E] text-white active:scale-[0.98] transition-all"
                  >
                    Soumettre ({results.length} plat{results.length > 1 ? 's' : ''})
                  </button>
                </>
              )}

              {/* After listening with no results: Reessayer + Annuler */}
              {phase === 'done' && results.length === 0 && (
                <>
                  <button
                    onClick={handleClose}
                    className="py-3 px-5 rounded-xl text-sm font-bold bg-gray-200 text-gray-700 active:scale-[0.98] transition-all"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={onRetry}
                    className="flex-1 py-3 rounded-xl text-sm font-bold bg-[#C1652E] text-white active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                  >
                    <RotateCcw size={16} />
                    Reessayer
                  </button>
                </>
              )}

              {/* Error: Fermer */}
              {phase === 'error' && (
                <button
                  onClick={handleClose}
                  className="flex-1 py-3 rounded-xl text-sm font-bold bg-gray-200 text-gray-700 active:scale-[0.98] transition-all"
                >
                  Fermer
                </button>
              )}

              {/* Idle: Parler */}
              {phase === 'idle' && (
                <button
                  onClick={onStart}
                  className="flex-1 py-3 rounded-xl text-sm font-bold bg-[#C1652E] text-white active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <Mic size={16} />
                  Parler
                </button>
              )}
            </div>

            {/* Hints (only when idle) */}
            {phase === 'idle' && (
              <div className="mt-4 space-y-1">
                <p className="text-xs text-text-secondary font-medium">Dites par exemple :</p>
                <p className="text-xs text-text-tertiary italic">"Deux thieboudienne et un jus de bouye"</p>
                <p className="text-xs text-text-tertiary italic">"Un poulet braise frites"</p>
                <p className="text-xs text-text-tertiary italic">"Trois bissap"</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default VoiceOrderButton;
