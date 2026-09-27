/**
 * FasoFree — Bouton « Appeler le support » (dashboard / administration).
 *
 * Lien `tel:` vers la hotline FasoFree, masqué totalement (null) quand
 * `VITE_SUPPORT_PHONE` est absent : jamais de bouton d'appel sans numéro.
 * Style aligné sur le design system du dashboard (btn-secondary / accent).
 */
import React from 'react';
import { Phone } from 'lucide-react';
import { SUPPORT_PHONE, hasSupportPhone } from '../utils/support';

const CallSupportButton = ({ label, variant = 'secondary', className = '' }) => {
  if (!hasSupportPhone) return null;
  const text = label || 'Appeler le support';
  // Le rayon vient du design system : btn-secondary porte déjà son radius ;
  // on n'applique rounded-md que sur la variante primary (miroir d'Actualiser).
  const variantClass =
    variant === 'primary'
      ? 'bg-accent-primary text-white rounded-md hover:opacity-90'
      : 'btn-secondary';
  return (
    <a
      href={`tel:${SUPPORT_PHONE}`}
      // WCAG 2.5.3 : le nom accessible contient le texte visible
      aria-label={`${text} (${SUPPORT_PHONE})`}
      className={`inline-flex items-center gap-2 text-sm font-semibold transition ${variantClass} ${className}`}
    >
      <Phone size={14} />
      {text}
    </a>
  );
};

export default CallSupportButton;