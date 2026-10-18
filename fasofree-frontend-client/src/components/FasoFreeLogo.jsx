/**
 * Identité visuelle FasoFree — app client (source unique).
 *
 * Source unique du masque (mark) et du lockup horizontal (masque + « FasoFree »).
 * Le masque était recopié inline dans SplashScreen, Loading et AssistantWidget
 * avec 3 couleurs divergentes : toute évolution se fait ici et se propage partout.
 * Masque = variante R2 « rose profond miroir » (dégradé or rose + éclat gloss) —
 * décision produit : seul le logo passe en or rose, l'UI (boutons, wordmark
 * « Free ») reste en terracotta #C1652E.
 */
import React from 'react';

const ACCENT = '#C1652E';

/**
 * Marque « visage ».
 * - Sans `color` : version pleine R2 (placard rose doré brillant + glyphes blancs).
 * - Avec `color` : glyphe monochrome, sans placard — usage sur bouton contrasté.
 */
export function FasoFreeMask({ size = 72, color, className, style }) {
  // useId() pour que plusieurs masques de la page n'aient pas d'ids SVG en conflit
  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, '');
  const mono = Boolean(color);
  const st = mono ? color : `url(#st${uid})`;
  const arc = mono ? color : '#F7D6D8';
  const eye = mono ? color : '#FFFFFF';
  const nose = mono ? color : '#F0C4C6';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 140 140"
      fill="none"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {!mono && (
        <defs>
          <linearGradient id={`bg${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#D9A3A6" />
            <stop offset="100%" stopColor="#A85A67" />
          </linearGradient>
          <linearGradient id={`st${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FDECEC" />
            <stop offset="50%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#E8B3B6" />
          </linearGradient>
          <linearGradient id={`gl${uid}`} x1="0%" y1="0%" x2="55%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.5" />
            <stop offset="38%" stopColor="#FFFFFF" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </linearGradient>
        </defs>
      )}
      {!mono && <rect width="140" height="140" rx="28" fill={`url(#bg${uid})`} />}
      <ellipse cx="70" cy="70" rx="44" ry="52" stroke={st} strokeWidth="4.5" fill="none" />
      <path d="M38 50 Q70 22 102 50" stroke={arc} strokeWidth="3.2" fill="none" opacity="0.75" />
      <path d="M50 62 Q58 55.5 66 62 Q58 68.5 50 62Z" fill={eye} />
      <path d="M74 62 Q82 55.5 90 62 Q82 68.5 74 62Z" fill={eye} />
      <path d="M70 61 L63.5 84 L76.5 84 Z" fill={nose} />
      <path d="M55 96 Q70 105 85 96" stroke={st} strokeWidth="4.5" fill="none" strokeLinecap="round" />
      <circle cx="70" cy="70" r="3" fill={st} opacity="0.5" />
      {!mono && <rect width="140" height="140" rx="28" fill={`url(#gl${uid})`} />}
      {!mono && (
        <rect x="4" y="4" width="132" height="132" rx="24" fill="none" stroke="#FFFFFF" strokeWidth="1" opacity="0.35" />
      )}
    </svg>
  );
}

/**
 * Lockup horizontal (concept W2 retenu) : masque + wordmark deux tons.
 * `dark` = fond sombre derrière (texte crème au lieu d'encre).
 */
export function FasoFreeLockup({ maskSize = 56, dark = false, gap = 18, className, style }) {
  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap,
        userSelect: 'none',
        ...style,
      }}
    >
      <FasoFreeMask size={maskSize} />
      <span
        style={{
          fontFamily: "'Manrope', system-ui, sans-serif",
          fontWeight: 800,
          fontSize: Math.round(maskSize * 0.62),
          letterSpacing: '-0.02em',
          lineHeight: 1,
          color: dark ? '#F0EDE8' : '#29231e',
        }}
      >
        Faso<span style={{ color: ACCENT }}>Free</span>
      </span>
    </span>
  );
}

export default FasoFreeLockup;
