/**
 * Copyright (c) 2026 BIDIGA Imrane - Koliwa. All rights reserved.
 * Proprietary and confidential.
 */

/** Coquille commune : en-tête de marque + navigation basse (une main, pouce). */
import { NavLink } from 'react-router-dom';
import { Package, Wallet, UserRound } from 'lucide-react';
import { KoliwaMark } from './brand';

const TABS = [
  { to: '/missions', label: 'Courses', icon: Package },
  { to: '/gains', label: 'Gains', icon: Wallet },
  { to: '/compte', label: 'Compte', icon: UserRound },
];

/**
 * `hideNav` : écran de détail, où la place du bas est prise par la barre
 * d'action de la course (accepter / colis récupéré / colis remis).
 */
const Shell = ({ title, kicker = 'Koliwa Coursier', right, children, hideNav = false }) => (
  <div className={`app ${hideNav ? 'app-detail' : ''}`}>
    <header className="topbar">
      <div className="topbar-id">
        <span className="brand-badge" aria-hidden="true">
          <KoliwaMark size={22} />
        </span>
        <div className="topbar-titles">
          <span className="topbar-kicker">{kicker}</span>
          <h1>{title}</h1>
        </div>
      </div>
      {right ? <div className="topbar-right">{right}</div> : null}
    </header>

    <main className="content">{children}</main>

    {hideNav ? null : (
      <nav className="nav" aria-label="Navigation principale">
        {TABS.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
            <Icon size={20} strokeWidth={2.2} aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    )}
  </div>
);

export default Shell;
