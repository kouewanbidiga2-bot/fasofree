/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="site-footer mt-8">
      <div className="site-footer-layout">
        <p className="site-footer-brand">
          <strong>Koliwa</strong>
          <span>Livraison de colis à Ouagadougou.</span>
        </p>
        <nav className="site-footer-links" aria-label="Liens utiles">
          <Link to="/register?pro=1">Devenir partenaire</Link>
          <a href="tel:+22661010011">Appeler le support</a>
          <Link to="/terms">Conditions</Link>
          <Link to="/privacy">Confidentialité</Link>
        </nav>
      </div>
    </footer>
  );
}
