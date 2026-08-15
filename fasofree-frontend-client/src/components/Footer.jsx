import React from 'react';
import { useNavigate, Link } from 'react-router-dom';

const Footer = () => {
  const navigate = useNavigate();

  return (
    <footer className="mt-12 border-t border-border-light bg-background-secondary py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-primary mb-2">FasoFree</p>
            <h3 className="text-xl font-display font-semibold tracking-[-0.03em] text-text-primary mb-2">La ville à votre table.</h3>
            <p className="text-text-secondary text-sm mb-4">
              Livraison de repas premium à Ouagadougou.
              Découvrez les meilleurs restaurants de la ville.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-sm font-medium text-text-primary mb-4">Liens</h4>
            <ul className="space-y-2">
              <li>
                <Link to="/privacy" className="text-text-secondary text-sm hover:text-accent-primary transition-colors">
                  Politique de confidentialité
                </Link>
              </li>
              <li>
                <Link to="/terms" className="text-text-secondary text-sm hover:text-accent-primary transition-colors">
                  Conditions d'utilisation
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-sm font-medium text-text-primary mb-4">Contact</h4>
            <ul className="space-y-2">
              <li className="text-text-secondary text-sm">support@fasofree.bf</li>
              <li className="text-text-secondary text-sm">+226 70 00 00 00</li>
              <li className="text-text-secondary text-sm">Ouagadougou, Burkina Faso</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border-light mt-8 pt-8 text-center">
          <p className="text-text-secondary text-xs">
            2024 FasoFree. Tous droits réservés.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
