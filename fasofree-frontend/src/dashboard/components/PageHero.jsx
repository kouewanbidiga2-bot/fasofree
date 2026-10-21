/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

/**
 * FasoFree — Bannière d'accueil (« hero ») des dashboards.
 *
 * Fond gris-bleu ardoise, plat (plus de motifs — choix validé),
 * widgets en ligne avec filets verticaux discrets.
 *
 * Widget : { value, label, delta? (nombre), unit? (défaut '%') }
 * Action  : { label, onClick, variant?: 'primary' | 'secondary' }
 * `title` : titre brut (sans « Bonjour ») pour les pages de gestion.
 * `right`  : nœud JSX affiché à droite (cloche, badge de mode…).
 * Le champ `dot` des widgets est accepté mais ignoré : plus de pastilles
 * colorées dans les héros.
 */
import React from 'react';

const deltaColor = (d) => (d >= 0 ? '#1E6B43' : '#A63A32');

export function PageHero({ name = '', title = '', subtitle = '', widgets = [], actions = [], right = null }) {
  const dateLabel = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <section className="mb-6 rounded-card border border-[#93A3B3] bg-[#A8B7C6]">
      <div className="flex flex-col gap-6 p-6 lg:flex-row lg:items-center lg:justify-between lg:p-7">
        <div className="min-w-0">
          <h1 className="text-[23px] font-extrabold tracking-[-0.02em] text-[#241F1B]">
            {title || (name ? `Bonjour ${name}` : 'Bonjour')}
          </h1>
          <p className="mt-1 text-sm text-[#29231E]/75">
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
                className={`min-w-[140px] ${i > 0 ? 'lg:border-l lg:border-[#241F1B]/15 lg:pl-6' : 'lg:pr-6'}`}
              >
                <p className="text-[11.5px] text-[#29231E]/65">{widget.label}</p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-[21px] font-extrabold leading-none tracking-tight text-[#241F1B]">
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
