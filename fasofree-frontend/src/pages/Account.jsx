/**
 * Copyright (c) 2026 BIDIGA Imrane - Koliwa. All rights reserved.
 * Proprietary and confidential.
 */

/** Compte — profil du livreur, contrat et déconnexion. */
import { useNavigate } from 'react-router-dom';
import { ChevronRight, FileText, LogOut, ShieldCheck } from 'lucide-react';
import Shell from '../components/Shell';
import useAuthStore from '../store/authStore';

const initialsOf = (name) =>
  String(name || 'Koliwa')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');

const Account = () => {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  const onLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <Shell title="Compte" kicker="Profil coursier">
      <section className="card">
        <div className="row">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <span className="avatar" aria-hidden="true">{initialsOf(user?.fullName)}</span>
            <div className="stack" style={{ gap: 2 }}>
              <span className="strong" style={{ fontSize: 16.5 }}>{user?.fullName || 'Coursier'}</span>
              <span className="muted">{user?.email}</span>
              {user?.phone ? <span className="muted">{user.phone}</span> : null}
            </div>
          </div>
          <ShieldCheck size={22} color="var(--ok)" aria-label="Compte vérifié" />
        </div>
      </section>

      <section className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <button type="button" className="list-row" onClick={() => navigate('/contrat')}>
          <span className="list-row-label">
            <FileText size={18} /> Contrat de coursier
          </span>
          <ChevronRight size={18} color="var(--ink-3)" />
        </button>
      </section>

      <section className="card">
        <span className="section-title" style={{ margin: 0 }}>Statut du compte</span>
        <div className="row row-tight">
          <span className="muted">Rôle</span>
          <span className="strong" style={{ fontSize: 13.5 }}>{user?.role || '—'}</span>
        </div>
        <div className="row row-tight">
          <span className="muted">Vérification</span>
          <span className="strong" style={{ fontSize: 13.5 }}>{user?.kycStatus || 'à jour'}</span>
        </div>
        <hr className="divider" />
        <p className="muted" style={{ margin: 0 }}>
          Une question sur votre compte ? Écrivez à l'équipe Koliwa depuis l'application client.
        </p>
      </section>

      <button type="button" className="btn btn-danger btn-block" onClick={onLogout}>
        <LogOut size={16} /> Se déconnecter
      </button>
    </Shell>
  );
};

export default Account;
