/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

/**
 * Identité visuelle FasoFree — dashboard (back-office).
 *
 * Source unique du masque (mark) et du lockup horizontal (masque + « FasoFree »).
 * Le masque était recopié inline dans SplashScreen, Loading et PhoneAuth avec
 * des couleurs et épaisseurs divergentes : toute évolution se fait ici.
 * Formes alignées sur l'icône PWA installée (concept C : cercle noir).
 */
import React from 'react';

const ACCENT = '#C1652E';

/**
 * Marque « visage ».
 * - Sans `color` : version pleine (disque noir + détails terracotta/or).
 * - Avec `color` : glyphe monochrome, sans disque — usage sur fond contrasté.
 */
export function FasoFreeMask({ size = 72, color, className, style }) {
  const c = color
    ? { bg: null, outline: color, arc: color, eye: color, nose: color, mouth: color }
    : { bg: '#0D0D0D', outline: ACCENT, arc: '#D4AF37', eye: ACCENT, nose: ACCENT, mouth: ACCENT };

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
      {c.bg && <circle cx="70" cy="70" r="70" fill={c.bg} />}
      <ellipse cx="70" cy="70" rx="44" ry="52" stroke={c.outline} strokeWidth="4.5" fill="none" />
      <path d="M38 50 Q70 22 102 50" stroke={c.arc} strokeWidth="3.2" fill="none" opacity="0.7" />
      <path d="M50 62 Q58 55.5 66 62 Q58 68.5 50 62Z" fill={c.eye} opacity="0.9" />
      <path d="M74 62 Q82 55.5 90 62 Q82 68.5 74 62Z" fill={c.eye} opacity="0.9" />
      <path d="M70 61 L63.5 84 L76.5 84 Z" fill={c.nose} opacity="0.8" />
      <path d="M55 96 Q70 105 85 96" stroke={c.mouth} strokeWidth="4.5" fill="none" strokeLinecap="round" />
      <circle cx="70" cy="70" r="3" fill={c.outline} opacity="0.25" />
    </svg>
  );
}

/**
 * Lockup horizontal (concept W2 retenu) : masque + wordmark deux tons.
 * `dark` = fond sombre derrière (texte crème au lieu d'encre).
 */
export function FasoFreeLockup({ maskSize = 56, dark = true, gap = 18, className, style }) {
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
