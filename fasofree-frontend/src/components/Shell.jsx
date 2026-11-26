/**
 * Copyright (c) 2026 BIDIGA Imrane - Koliwa. All rights reserved.
 * Proprietary and confidential.
 */

/** Coquille commune : en-tête + navigation basse (une main, pouce). */
import { NavLink, useNavigate } from 'react-router-dom';
import { Bike, Package, Wallet, User } from 'lucide-react';

const TABS = [
  { to: '/missions', label: 'Courses', icon: Package },
  { to: '/gains', label: 'Gains', icon: Wallet },
  { to: '/compte', label: 'Compte', icon: User },
];

const Shell = ({ title, right, children }) => {
  const navigate = useNavigate();

  return (
    <div className="app">
      <header className="topbar">
        <button
          type="button"
          onClick={() => navigate('/missions')}
          aria-label="Koliwa Coursier"
          style={{ background: 'none', border: 0, padding: 0, display: 'flex', alignItems: 'center', gap: 10 }}
        >
          <span className="brand-mark" style={{ width: 32, height: 32, borderRadius: 10, fontSize: 14 }}>
            <Bike size={16} />
          </span>
          <h1>{title}</h1>
        </button>
        {right}
      </header>

      <main className="content">{children}</main>

      <nav className="nav">
        {TABS.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
            <Icon size={20} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
};

export default Shell;
