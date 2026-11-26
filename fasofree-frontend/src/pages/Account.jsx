/**
 * Copyright (c) 2026 BIDIGA Imrane - Koliwa. All rights reserved.
 * Proprietary and confidential.
 */

/** Compte — profil du livreur, contrat et déconnexion. */
import { useNavigate } from 'react-router-dom';
import { ChevronRight, LogOut, FileText, ShieldCheck } from 'lucide-react';
import Shell from '../components/Shell';
import useAuthStore from '../store/authStore';

const Account = () => {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  const onLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <Shell title="Compte">
      <div className="card">
        <div className="row">
          <div className="stack">
            <span className="strong">{user?.fullName || 'Coursier'}</span>
            <span className="muted">{user?.email}</span>
            {user?.phone ? <span className="muted">{user.phone}</span> : null}
          </div>
          <ShieldCheck size={22} color="var(--ok)" />
        </div>
      </div>

      <div className="card" style={{ gap: 0, padding: 0 }}>
        <button
          type="button"
          className="row"
          onClick={() => navigate('/contrat')}
          style={{ background: 'none', border: 0, padding: 16, width: '100%', textAlign: 'left', cursor: 'pointer' }}
        >
          <span className="row" style={{ gap: 10, justifyContent: 'flex-start' }}>
            <FileText size={18} />
            <span className="strong" style={{ fontSize: 15 }}>Contrat de coursier</span>
          </span>
          <ChevronRight size={18} color="var(--ink-soft)" />
        </button>
      </div>

      <div className="card" style={{ gap: 6 }}>
        <span className="section-title" style={{ margin: 0 }}>Statut du compte</span>
        <span className="muted">
          Rôle : {user?.role || '—'}
          {user?.kycStatus ? ` · vérification ${user.kycStatus}` : ''}
        </span>
        <span className="muted">
          Une question sur votre compte ? Écrivez à l'équipe Koliwa depuis l'application client.
        </span>
      </div>

      <button type="button" className="btn btn-danger btn-block" onClick={onLogout}>
        <LogOut size={16} /> Se déconnecter
      </button>
    </Shell>
  );
};

export default Account;
