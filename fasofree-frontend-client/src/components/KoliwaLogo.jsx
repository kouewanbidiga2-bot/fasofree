/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

export function KoliwaMark({ size = 72, className = '', style }) {
  return (
    <svg
      viewBox="0 0 140 140"
      width={size}
      height={size}
      className={className}
      style={style}
      role="img"
      aria-label="Koliwa"
      focusable="false"
    >
      <image
        href="/assets/koliwa-logo.png"
        x="0"
        y="0"
        width="140"
        height="140"
        preserveAspectRatio="xMidYMid meet"
      />
    </svg>
  );
}

export function KoliwaWordmark({ className = '', style, decorative = false, animate = false }) {
  return (
    <svg
      className={`koliwa-wordmark ${animate ? 'koliwa-wordmark--assemble' : ''} ${className}`}
      viewBox="0 0 175 44"
      style={style}
      fill="currentColor"
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : 'Koliwa'}
      aria-hidden={decorative || undefined}
      focusable="false"
    >
      <use className="koliwa-wordmark-name" href="/koliwa-wordmark.svg#koliwa-name" />
      <use className="koliwa-wordmark-letter" href="/koliwa-wordmark.svg#koliwa-final-a" />
    </svg>
  );
}

export function KoliwaLockup({ width = 112, dark = false, className = '', style, animate = false }) {
  return (
    <KoliwaWordmark
      className={className}
      style={{ '--koliwa-wordmark-width': `${width}px`, color: dark ? '#FFFDF4' : 'var(--kw-ink)', ...style }}
      animate={animate}
    />
  );
}

export default KoliwaLockup;
