/**
 * Copyright (c) 2026 BIDIGA Imrane - Koliwa. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { Link, useLocation } from 'react-router-dom';
import { CircleUserRound, Home, PackagePlus, Radar, Receipt } from 'lucide-react';
import { KoliwaLockup } from '../KoliwaLogo';
import { useLanguage } from '../../contexts/LanguageContext';

const ICONS = {
  home: Home,
  track: Radar,
  parcel: PackagePlus,
  history: Receipt,
  profile: CircleUserRound,
};

export default function BottomNav() {
  const { pathname } = useLocation();
  const { t } = useLanguage();
  const tabs = [
    { label: t('home'), glyph: 'home', path: '/' },
    { label: 'Suivi', glyph: 'track', path: '/suivre', prefix: '/track/' },
    { label: 'Envoi', glyph: 'parcel', path: '/p2p-delivery', related: ['/p2p/success'] },
    { label: t('deliveries'), glyph: 'history', path: '/order-history', related: ['/order-tracking', '/payment-error'] },
    { label: t('profile'), glyph: 'profile', path: '/profile', related: ['/vip-pass', '/addresses', '/settings', '/disputes'] },
  ];
  const currentPath = pathname.toLowerCase().replace(/\/+$/, '') || '/';
  const activeTab = tabs.findIndex(({ path, related, prefix }) =>
    currentPath === path || related?.includes(currentPath) || (prefix && currentPath.startsWith(prefix))
  );

  return (
    <nav className="client-navigation" aria-label="Navigation principale">
      <Link to="/" aria-label="Koliwa, accueil" className="client-rail-brand">
        <KoliwaLockup animate />
      </Link>
      <div className="client-nav-links" style={{ '--client-tab-count': tabs.length, '--client-tab-index': Math.max(0, activeTab) }}>
        <span className="client-nav-indicator" data-visible={activeTab >= 0} aria-hidden="true" />
        {tabs.map(({ label, glyph, path }, index) => {
          const Icon = ICONS[glyph] || Home;
          return (
            <Link
              key={path}
              to={path}
              className="client-nav-link"
              aria-current={index === activeTab ? 'page' : undefined}
            >
              <span className="client-nav-icon">
                <Icon size={22} strokeWidth={index === activeTab ? 2.3 : 1.85} aria-hidden="true" />
              </span>
              <span className="client-nav-label">{label}</span>
            </Link>
          );
        })}
      </div>
      <Link to="/register?pro=1" className="client-rail-partner">Devenir partenaire</Link>
    </nav>
  );
}
