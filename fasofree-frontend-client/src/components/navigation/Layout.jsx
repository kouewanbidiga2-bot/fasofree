/**
 * Copyright (c) 2026 BIDIGA Imrane - Koliwa. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { useLayoutEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import BottomNav from './BottomNav';
import LandingMasthead from './LandingMasthead';
import DeliveryGlyph from '../DeliveryGlyph';
import { KoliwaLockup } from '../KoliwaLogo';
import NotificationDropdown from '../NotificationDropdown';
import PWAInstallButton from '../PWAInstallButton';
import PWAInstallIOSHint from '../PWAInstallIOSHint';
import UserMenu from '../UserMenu';
import useAuthStore from '../../store/authStore';
import useNotificationStore from '../../store/notificationStore';

export default function Layout() {
  const { pathname, search } = useLocation();
  const landing = pathname === '/';
  const routeKey = pathname === '/p2p-delivery' ? pathname + search : pathname;
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const unreadCount = useNotificationStore((state) => state.unreadCount);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [routeKey]);

  return (
    <div className={landing ? 'client-shell client-shell--landing' : 'client-shell'}>
      <a className="client-skip-link" href="#client-content">Aller au contenu</a>
      <BottomNav />
      <div className="client-workspace">
        {landing ? (
          <LandingMasthead
            isAuthenticated={isAuthenticated}
            unreadCount={unreadCount}
            onOpenNotifications={() => setNotificationsOpen(true)}
          />
        ) : (
          <header className="client-masthead">
            <div className="client-masthead-inner">
              <Link className="client-masthead-brand" to="/" aria-label="Koliwa, accueil">
                <KoliwaLockup animate />
              </Link>
              <p className="client-masthead-location"><DeliveryGlyph kind="location" /> Ouagadougou</p>
              <div className="client-masthead-tools">
                <PWAInstallButton />
                <button
                  type="button"
                  className="client-tool"
                  aria-label="Aide Koliwa"
                  onClick={() => window.dispatchEvent(new Event('koliwa:open-assistant'))}
                >
                  <DeliveryGlyph kind="help" /><span className="client-tool-label">Aide</span>
                </button>
                {isAuthenticated ? (
                  <>
                    <button
                      type="button"
                      className="client-tool"
                      aria-label={unreadCount ? `Notifications, ${unreadCount} non lues` : 'Notifications'}
                      onClick={() => setNotificationsOpen(true)}
                    >
                      <DeliveryGlyph kind="notifications" />
                      {unreadCount > 0 && <span className="client-notification-dot" aria-hidden="true" />}
                    </button>
                    <UserMenu />
                  </>
                ) : (
                  <Link to="/auth" className="client-tool client-sign-in">Connexion</Link>
                )}
              </div>
            </div>
          </header>
        )}
        <main id="client-content" key={routeKey} className="client-route-stage" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
      {isAuthenticated && <NotificationDropdown open={notificationsOpen} onClose={() => setNotificationsOpen(false)} />}
      <PWAInstallIOSHint />
    </div>
  );
}
