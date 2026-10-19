/**
 * FasoFree — Bannière d'accueil (« hero ») des dashboards.
 *
 * Titre personnalisé + date du jour + actions rapides + widgets de données.
 * Les widgets et actions sont passés en props : chaque dashboard branche
 * ses données réelles (pas de fetch ici).
 *
 * Widget : { value, label, dot?, delta? (nombre), unit? (défaut '%') }
 * Action  : { label, onClick, variant?: 'primary' | 'secondary' }
 */
import React from 'react';

const deltaColor = (d) => (d >= 0 ? '#16A34A' : '#DC2626');

export function PageHero({ name = '', subtitle = '', widgets = [], actions = [] }) {
  const dateLabel = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <section className="relative mb-6 overflow-hidden rounded-2xl border border-border-light bg-background-card shadow-card">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0) 45%, rgba(193,101,46,0.06) 100%)',
        }}
      />
      <div className="relative flex flex-col gap-6 p-6 lg:flex-row lg:items-center lg:justify-between lg:p-7">
        <div className="min-w-0">
          <h1 className="text-[23px] font-extrabold tracking-[-0.02em] text-text-primary">
            {name ? `Bonjour ${name}` : 'Bonjour'}
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
          <div className="grid shrink-0 grid-cols-2 gap-x-8 gap-y-4 lg:border-l lg:border-border-light lg:pl-8">
            {widgets.map((widget) => (
              <div key={widget.label} className="min-w-[152px]">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-[15px] font-extrabold text-text-primary">
                    {widget.dot && (
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: widget.dot }}
                      />
                    )}
                    {widget.value}
                  </span>
                  {widget.delta !== undefined && widget.delta !== null && (
                    <span
                      className="font-mono text-[11.5px] font-bold"
                      style={{ color: deltaColor(widget.delta) }}
                    >
                      {widget.delta >= 0 ? '+' : ''}
                      {Number(widget.delta).toFixed(Math.abs(widget.delta) < 10 && !Number.isInteger(widget.delta) ? 1 : 0)}
                      {widget.unit ?? '%'}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-text-secondary">{widget.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default PageHero;
