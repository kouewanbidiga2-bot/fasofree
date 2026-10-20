/**
 * FasoFree — Bannière d'accueil (« hero ») des dashboards.
 *
 * Fond sable + motif indienne (grille points/croix) en ton sur ton sur la
 * moitié droite, avec fondu vers la gauche, et arcs concentriques discrets
 * en bas à droite. Les widgets sont en ligne avec filets verticaux.
 *
 * Widget : { value, label, delta? (nombre), unit? (défaut '%') }
 * Action  : { label, onClick, variant?: 'primary' | 'secondary' }
 * `title` : titre brut (sans « Bonjour ») pour les pages de gestion.
 * `right`  : nœud JSX affiché à droite (cloche, badge de mode…).
 * Le champ `dot` des widgets est accepté mais ignoré : plus de pastilles
 * colorées dans les héros (palette beige/terracotta verrouillée).
 */
import React from 'react';

const deltaColor = (d) => (d >= 0 ? '#2F7D4F' : '#C0453B');

/**
 * Fond décoratif (motif indienne + arcs) réutilisable hors du hero :
 * à placer dans un conteneur `relative overflow-hidden`.
 */
export function HeroMotif() {
  return (
    <>
      {/* Motif indienne : points + croix, droite du héros, fondu vers la gauche */}
      <svg className="pointer-events-none absolute inset-y-0 right-0 h-full w-[58%]" aria-hidden="true">
        <defs>
          <pattern id="ff-hero-motif" width="18" height="18" patternUnits="userSpaceOnUse">
            <circle cx="4" cy="4" r="1.4" fill="#D9CDB4" />
            <path d="M11 11l4 4M15 11l-4 4" stroke="#D9CDB4" strokeWidth="1.3" strokeLinecap="round" />
          </pattern>
          <linearGradient id="ff-hero-fade" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#F7F3EB" stopOpacity="1" />
            <stop offset="1" stopColor="#F7F3EB" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#ff-hero-motif)" />
        <rect width="45%" height="100%" fill="url(#ff-hero-fade)" />
      </svg>
      {/* Arcs concentriques discrets (angle bas droite) */}
      <svg className="pointer-events-none absolute -bottom-24 -right-20 h-56 w-56" aria-hidden="true">
        <circle cx="50%" cy="50%" r="40%" fill="none" stroke="#C1652E" strokeOpacity="0.14" strokeWidth="1.5" />
        <circle cx="50%" cy="50%" r="62%" fill="none" stroke="#C1652E" strokeOpacity="0.10" strokeWidth="1.5" />
      </svg>
    </>
  );
}

export function PageHero({ name = '', title = '', subtitle = '', widgets = [], actions = [], right = null }) {
  const dateLabel = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <section className="relative mb-6 overflow-hidden rounded-card border border-border-light bg-[#F7F3EB]">
      <HeroMotif />

      <div className="relative flex flex-col gap-6 p-6 lg:flex-row lg:items-center lg:justify-between lg:p-7">
        <div className="min-w-0">
          <h1 className="text-[23px] font-extrabold tracking-[-0.02em] text-text-primary">
            {title || (name ? `Bonjour ${name}` : 'Bonjour')}
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            {subtitle ? `${subtitle} — ` : ''}
            {dateLabel}
          </p>
          {actions.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-3">
              {actions.map((action) => (
                <button
                  key={action.label}
                  onClick={action.onClick}
                  className={
                    action.variant === 'secondary' ? 'btn-secondary px-4 py-2.5' : 'btn-primary px-4 py-2.5'
                  }
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {widgets.length > 0 && (
          <div className="grid shrink-0 grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4 lg:gap-x-0">
            {widgets.map((widget, i) => (
              <div
                key={widget.label}
                className={`min-w-[140px] ${i > 0 ? 'lg:border-l lg:border-[#E4DAC6] lg:pl-6' : 'lg:pr-6'}`}
              >
                <p className="text-[11.5px] text-text-tertiary">{widget.label}</p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-[21px] font-extrabold leading-none tracking-tight text-text-primary">
                    {widget.value}
                  </span>
                  {widget.delta !== undefined && widget.delta !== null && (
                    <span
                      className="text-[11.5px] font-bold"
                      style={{ color: deltaColor(widget.delta) }}
                    >
                      {widget.delta >= 0 ? '+' : ''}
                      {Number(widget.delta).toFixed(Math.abs(widget.delta) < 10 && !Number.isInteger(widget.delta) ? 1 : 0)}
                      {widget.unit ?? '%'}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {right && <div className="shrink-0">{right}</div>}
      </div>
    </section>
  );
}

export default PageHero;
