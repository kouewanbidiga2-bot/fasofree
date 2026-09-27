/**
 * FasoFree — Constantes du support (dashboard / administration).
 *
 * Numéro de hotline configurable via `VITE_SUPPORT_PHONE` (format
 * international, ex. +22670000000). Vide ou invalide ⇒ `hasSupportPhone`
 * est false et aucun bouton d'appel n'est affiché (règle projet : pas
 * de bouton sans vraie cible).
 *
 * NB : les variables `VITE_*` sont inlinées au build — modifier la valeur
 * sur l'hébergeur (Vercel/Render) exige un REBUILD, pas un simple redeploy.
 */
const raw = (import.meta.env.VITE_SUPPORT_PHONE || '').trim();

/** Normalisé pour `tel:` (sans espaces / parenthèses / points / tirets). */
export const SUPPORT_PHONE = raw.replace(/[\s().-]/g, '');

/** true uniquement si le numéro est un numéro international plausible. */
export const hasSupportPhone = /^\+?\d{6,15}$/.test(SUPPORT_PHONE);