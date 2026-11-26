import { useRef } from 'react';
import { MapPin, Package } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DELIVERY_SERVICES } from '../DeliveryGlyph';
import PWAInstallButton from '../PWAInstallButton';

export default function LandingMasthead({ isAuthenticated, unreadCount, onOpenNotifications }) {
  const menu = useRef(null);
  const trigger = useRef(null);

  const close = () => {
    menu.current.open = false;
  };

  const handleKeyDown = (event) => {
    if (event.key !== 'Escape' || !menu.current.open) return;
    event.stopPropagation();
    close();
    trigger.current.focus();
  };

  return (
    <header className="kw-landing-header">
      <nav className="kw-landing-bar" aria-label="Navigation principale">
        <Link className="kw-landing-brand" to="/" aria-label="Koliwa, accueil">
          <span className="kw-landing-mark" aria-hidden="true" />
          <span className="kw-landing-name" aria-hidden="true">Koliw<span className="kw-landing-name-a">a</span></span>
        </Link>
        <div className="kw-landing-actions">
          <a className="kw-landing-place" href="#services-livraison">
            <MapPin size={16} aria-hidden="true" /> Ouagadougou
          </a>
          <Link className="kw-landing-orders" to="/order-history" aria-label="Mes livraisons">
            <Package size={18} aria-hidden="true" />
          </Link>
          <details
            ref={menu}
            className="kw-landing-menu"
            onKeyDown={handleKeyDown}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) close();
            }}
          >
            <summary ref={trigger}>Menu</summary>
            <div className="kw-landing-menu-links">
              {DELIVERY_SERVICES.map(({ kind, title, to }) => (
                <Link key={kind} to={to} onClick={close}>{title}</Link>
              ))}
              <Link to="/suivre" onClick={close}>Suivre un colis</Link>
              <Link to="/order-history" onClick={close}>Mes livraisons</Link>
              <Link to={isAuthenticated ? '/profile' : '/auth'} onClick={close}>
                {isAuthenticated ? 'Mon profil' : 'Connexion'}
              </Link>
              {isAuthenticated && (
                <button type="button" onClick={() => { close(); onOpenNotifications(); }}>
                  Notifications{unreadCount > 0 && ` (${unreadCount})`}
                </button>
              )}
              <button type="button" onClick={() => {
                close();
                window.dispatchEvent(new Event('fasofree:open-assistant'));
              }}>Aide Koliwa</button>
              <PWAInstallButton />
            </div>
          </details>
        </div>
      </nav>
    </header>
  );
}
