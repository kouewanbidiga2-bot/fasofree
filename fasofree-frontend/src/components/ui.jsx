/**
 * Copyright (c) 2026 BIDIGA Imrane - Koliwa. All rights reserved.
 * Proprietary and confidential.
 */

/** Petits blocs d'interface partagés par tous les écrans. */

export const formatFcfa = (value) => {
  const n = Number(value ?? 0);
  return `${new Intl.NumberFormat('fr-FR').format(Number.isFinite(n) ? Math.round(n) : 0)} FCFA`;
};

export const formatDate = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

export const isToday = (value) => {
  if (!value) return false;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
};

export const Spinner = () => <div className="spinner" role="status" aria-label="Chargement" />;

export const Loading = ({ label = 'Chargement…' }) => (
  <div className="center">
    <Spinner />
    <p className="muted">{label}</p>
  </div>
);

export const Empty = ({ title, hint }) => (
  <div className="center">
    <p className="strong" style={{ margin: 0 }}>{title}</p>
    {hint ? <p className="muted" style={{ margin: 0, maxWidth: 280 }}>{hint}</p> : null}
  </div>
);

export const ErrorNote = ({ children }) => (children ? <div className="note note-danger">{children}</div> : null);

export const GoodNote = ({ children }) => (children ? <div className="note note-ok">{children}</div> : null);

/** Squelette de carte : évite le saut de mise en page pendant le chargement. */
export const CardSkeleton = ({ lines = 3 }) => (
  <div className="card skeleton-card" aria-hidden="true">
    {Array.from({ length: lines }).map((_, index) => (
      <span key={index} className="skeleton" style={{ width: index === 0 ? '46%' : '100%' }} />
    ))}
  </div>
);

const TONES = {
  ok: 'pill pill-ok',
  warn: 'pill pill-warn',
  danger: 'pill pill-danger',
  accent: 'pill pill-accent',
};

export const StatusPill = ({ tone = 'default', children }) => (
  <span className={TONES[tone] || 'pill'}>
    <span className="dot" />
    {children}
  </span>
);

/** Couleur d'une pastille selon le statut de la course. */
export const statusTone = (status) => {
  if (['IN_DELIVERY', 'DRIVER_ASSIGNED', 'PROCESSING'].includes(status)) return 'accent';
  if (status === 'DELIVERED_PENDING_CONFIRMATION') return 'warn';
  if (['CANCELLED', 'FAILED', 'DISPUTED', 'REFUNDED'].includes(status)) return 'danger';
  return 'ok';
};

/** Montant principal + légende alignés à droite. */
export const Amount = ({ value, caption = 'net' }) => (
  <span className="amount">
    {formatFcfa(value)}
    {caption ? <small>{caption}</small> : null}
  </span>
);

/**
 * Trajet retrait → livraison.
 * Les deux points sont reliés par un trait vertical : le livreur lit le sens
 * de la course d'un coup d'œil, sans lire une seule ligne de texte.
 */
export const RouteLine = ({ pickup, dropoff, compact = false }) => (
  <div className={`route ${compact ? 'route-compact' : ''}`}>
    <div className="route-row">
      <span className="route-dot route-dot-pickup" aria-hidden="true" />
      <div className="route-text">
        <span className="route-kicker">Retrait</span>
        <span className="route-address">{pickup?.address || 'Point de retrait'}</span>
      </div>
    </div>
    <div className="route-row">
      <span className="route-dot route-dot-dropoff" aria-hidden="true" />
      <div className="route-text">
        <span className="route-kicker">Livraison</span>
        <span className="route-address">{dropoff?.address || 'Point de livraison'}</span>
      </div>
    </div>
  </div>
);

/** Interrupteur de disponibilité (cible tactile large). */
export const Toggle = ({ checked, onChange, label, disabled = false }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={onChange}
    className={`switch ${checked ? 'switch-on' : ''}`}
  >
    <span className="switch-track" aria-hidden="true">
      <span className="switch-knob" />
    </span>
    <span className="switch-label">{checked ? 'En ligne' : 'Hors ligne'}</span>
  </button>
);
