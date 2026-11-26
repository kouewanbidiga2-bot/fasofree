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

export const Spinner = () => <div className="spinner" aria-label="Chargement" />;

export const Loading = ({ label = 'Chargement…' }) => (
  <div className="center">
    <Spinner />
    <p className="muted">{label}</p>
  </div>
);

export const Empty = ({ title, hint }) => (
  <div className="center">
    <p className="strong" style={{ margin: 0 }}>{title}</p>
    {hint ? <p className="muted" style={{ margin: 0 }}>{hint}</p> : null}
  </div>
);

export const ErrorNote = ({ children }) =>
  children ? <div className="note note-danger">{children}</div> : null;

export const GoodNote = ({ children }) =>
  children ? <div className="note note-ok">{children}</div> : null;

export const StatusPill = ({ tone = 'default', children }) => {
  const cls = tone === 'ok' ? 'pill pill-ok' : tone === 'warn' ? 'pill pill-warn' : tone === 'danger' ? 'pill pill-danger' : 'pill';
  return (
    <span className={cls}>
      <span className="dot" />
      {children}
    </span>
  );
};
