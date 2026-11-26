import { NavLink } from 'react-router-dom';

export default function TrackingModeNav() {
  return (
    <nav className="tracking-mode-nav" aria-label="Options de suivi">
      <NavLink to="/order-history" end>Mes envois</NavLink>
      <NavLink to="/suivre" end>Par numéro de suivi</NavLink>
    </nav>
  );
}
