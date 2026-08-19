import React, { useState } from 'react';
import { X, AlertTriangle, Loader2 } from 'lucide-react';

const REASONS = [
  { value: 'Commande incomplète', label: 'Commande incomplète' },
  { value: 'Jamais livrée', label: 'Jamais livrée' },
  { value: 'Retard important', label: 'Retard important' },
  { value: 'Mauvais état', label: 'Mauvais état' },
  { value: 'Autre', label: 'Autre' },
];

const DisputeModal = ({ isOpen, onClose, onSubmit, orderId }) => {
  const [reasonCategory, setReasonCategory] = useState(REASONS[0].value);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (description.trim().length < 10) return;
    setSubmitting(true);
    try {
      await onSubmit(reasonCategory + ' — ' + description.trim());
      setReasonCategory(REASONS[0].value);
      setDescription('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle size={20} style={{ color: '#C1652E' }} />
            <h2 className="text-lg font-semibold text-[#2D2A26]">Signaler un problème</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        <p className="text-sm text-[#70645C] mb-4">
          Commande #{orderId?.slice(0, 8)}
        </p>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-xs text-[#70645C] mb-2">Motif du litige</label>
            <select
              value={reasonCategory}
              onChange={(e) => setReasonCategory(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-[#E8E0D8] bg-white rounded focus:outline-none focus:border-[#C1652E]"
            >
              {REASONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          <div className="mb-6">
            <label className="block text-xs text-[#70645C] mb-2">Description du problème</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Décrivez le problème rencontré (minimum 10 caractères)..."
              rows={4}
              required
              minLength={10}
              className="w-full px-3 py-2.5 text-sm border border-[#E8E0D8] rounded resize-none focus:outline-none focus:border-[#C1652E]"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium border border-[#E8E0D8] text-[#70645C] hover:border-[#C1652E] transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting || description.trim().length < 10}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white transition disabled:opacity-50"
              style={{ backgroundColor: '#C1652E' }}
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 size={16} className="animate-spin" /> Envoi…
                </span>
              ) : 'Envoyer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DisputeModal;
