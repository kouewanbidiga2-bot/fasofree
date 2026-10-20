import React, { useState } from 'react';
import { X, AlertTriangle, Loader2 } from 'lucide-react';
import { Modal, ModalTitle } from './ui/Modal';

const REASONS = [
  { value: 'Commande incomplète', label: 'Commande incomplète' },
  { value: 'Jamais livrée', label: 'Jamais livrée' },
  { value: 'Retard important', label: 'Retard important' },
  { value: 'Mauvais état', label: 'Mauvais état' },
  { value: 'Autre', label: 'Autre' },
];

/**
 * Modale d'ouverture d'une réclamation.
 *
 * - Usage depuis une commande (OrderTracking) : `orderId` fourni, pas de
 *   sélecteur — onSubmit(reason, password).
 * - Usage depuis la page Réclamations : `orders` (liste éligible) fournie,
 *   sélecteur de commande affiché — onSubmit(reason, password, orderId).
 */
const DisputeModal = ({ isOpen, onClose, onSubmit, orderId, orders }) => {
  const [reasonCategory, setReasonCategory] = useState(REASONS[0].value);
  const [description, setDescription] = useState('');
  const [password, setPassword] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState(orderId || '');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const pickerEnabled = Array.isArray(orders) && orders.length > 0;
  const finalOrderId = pickerEnabled ? selectedOrderId : orderId;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (description.trim().length < 10 || !password.trim()) return;
    if (pickerEnabled && !finalOrderId) return;
    setSubmitting(true);
    try {
      await onSubmit(
        reasonCategory + ' — ' + description.trim(),
        password.trim(),
        finalOrderId,
      );
      setReasonCategory(REASONS[0].value);
      setDescription('');
      setPassword('');
      setSelectedOrderId(orders?.[0]?.id || orderId || '');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    // Mêmes classes qu'avant (overlay noir/40, panneau carte) : Radix gère
    // Échap, focus et scroll en arrière-plan.
    <Modal isOpen={isOpen} onClose={onClose} overlayClassName="bg-black/40" panelClassName="bg-background-card w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle size={20} style={{ color: '#C1652E' }} />
            <ModalTitle asChild>
              <h2 className="text-lg font-semibold text-[#2D2A26]">Signaler un problème</h2>
            </ModalTitle>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {pickerEnabled ? (
          <div className="mb-4">
            <label className="block text-xs text-[#70645C] mb-2">Commande concernée</label>
            <select
              value={selectedOrderId || ''}
              onChange={(e) => setSelectedOrderId(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-[#E8E0D8] bg-white rounded focus:outline-none focus:border-[#C1652E]"
              required
            >
              <option value="" disabled>
                Sélectionnez une commande livrée…
              </option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.businessName || 'Commande'} #{o.id.slice(0, 8)} —{' '}
                  {Number(o.totalAmount).toLocaleString('fr-FR')} FCFA
                </option>
              ))}
            </select>
            {orders.length === 0 && (
              <p className="text-xs text-[#70645C] mt-1">
                Aucune commande livrée éligible pour une réclamation.
              </p>
            )}
          </div>
        ) : (
          orderId && (
            <p className="text-sm text-[#70645C] mb-4">
              Commande #{orderId.slice(0, 8)}
            </p>
          )
        )}

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

          <div className="mb-4">
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

          <div className="mb-6">
            <label className="block text-xs text-[#70645C] mb-2">Confirmez votre mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Saisissez votre mot de passe actuel"
              required
              className="w-full px-3 py-2.5 text-sm border border-[#E8E0D8] rounded focus:outline-none focus:border-[#C1652E]"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium border border-[#E8E0D8] text-[#70645C] hover:border-[#C1652E] transition active:scale-[0.98]"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={
                submitting ||
                description.trim().length < 10 ||
                !password.trim() ||
                (pickerEnabled && !finalOrderId)
              }
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white transition active:scale-[0.98] disabled:opacity-50"
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
    </Modal>
  );
};

export default DisputeModal;