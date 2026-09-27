/**
 * FasoFree — Bouton « Appeler le support » (application client).
 *
 * Rend un lien `tel:` vers la hotline FasoFree. Si `VITE_SUPPORT_PHONE`
 * n'est pas défini, le bouton est totalement masqué (null) : jamais de
 * bouton d'appel vide ou cassé.
 */
import React from 'react';
import { Phone } from 'lucide-react';
import { SUPPORT_PHONE, hasSupportPhone } from '../utils/support';

const STYLES = {
  solid: 'bg-accent-primary text-white px-4 py-2 hover:opacity-90',
  outline:
    'border border-accent-primary/40 text-accent-primary px-4 py-2 hover:bg-accent-primary/5',
  // py-1 -my-1 : cible tactile ≥ 24 px sans décaler le layout voisin
  link: 'text-accent-primary underline-offset-2 hover:underline py-1 -my-1',
};

const CallSupportButton = ({ label, variant = 'outline', className = '' }) => {
  if (!hasSupportPhone) return null;
  const text = label || 'Appeler le support';
  return (
    <a
      href={`tel:${SUPPORT_PHONE}`}
      // WCAG 2.5.3 : le nom accessible contient le texte visible
      aria-label={`${text} (${SUPPORT_PHONE})`}
      className={`inline-flex items-center gap-2 rounded-lg text-sm font-medium transition ${
        STYLES[variant] || STYLES.outline
      } ${className}`}
    >
      <Phone size={14} strokeWidth={2} />
      {text}
    </a>
  );
};

export default CallSupportButton;