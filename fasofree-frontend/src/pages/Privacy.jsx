import React from 'react';
// ✅ CORRECT
import { useNavigate, useLocation, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Shield, Lock, Eye, Database } from 'lucide-react';

const Privacy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background-primary">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background-primary border-b border-border-light">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-background-secondary transition-colors"
            >
              <ArrowLeft size={18} className="text-text-primary" strokeWidth={1.5} />
            </button>
            <h1 className="text-lg font-display font-bold text-text-primary">Politique de Confidentialité</h1>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="border border-border-light p-6">
          <div className="space-y-8">
            <div className="text-center mb-8">
              <Shield size={48} className="mx-auto mb-4" strokeWidth={1.5} style={{ color: '#C1652E' }} />
              <h2 className="text-xl font-display font-medium text-text-primary mb-2">Votre vie privée compte</h2>
              <p className="text-text-secondary text-sm">Dernière mise à jour: Janvier 2024</p>
            </div>

            <section>
              <h3 className="text-base font-medium text-text-primary mb-4 flex items-center gap-2">
                <Lock size={16} strokeWidth={1.5} style={{ color: '#C1652E' }} />
                Collecte des données
              </h3>
              <p className="text-text-secondary leading-relaxed text-sm">
                Food Delivery BF collecte uniquement les données nécessaires pour vous fournir nos services:
                informations de compte, adresse de livraison, historique de commandes et préférences.
                Nous ne vendons jamais vos données à des tiers.
              </p>
            </section>

            <section>
              <h3 className="text-base font-medium text-text-primary mb-4 flex items-center gap-2">
                <Eye size={16} strokeWidth={1.5} style={{ color: '#C1652E' }} />
                Utilisation des données
              </h3>
              <p className="text-text-secondary leading-relaxed text-sm">
                Vos données sont utilisées pour: traiter vos commandes, améliorer nos services,
                personnaliser votre expérience et assurer la sécurité des transactions.
              </p>
            </section>

            <section>
              <h3 className="text-base font-medium text-text-primary mb-4 flex items-center gap-2">
                <Database size={16} strokeWidth={1.5} style={{ color: '#C1652E' }} />
                Stockage et sécurité
              </h3>
              <p className="text-text-secondary leading-relaxed text-sm">
                Vos données sont stockées sur des serveurs sécurisés avec chiffrement SSL.
                Nous appliquons des mesures de sécurité strictes pour protéger vos informations
                contre tout accès non autorisé.
              </p>
            </section>

            <section>
              <h3 className="text-base font-medium text-text-primary mb-4">Vos droits</h3>
              <ul className="space-y-2 text-text-secondary text-sm">
                <li>• Accéder à vos données personnelles</li>
                <li>• Modifier vos informations</li>
                <li>• Supprimer votre compte et vos données</li>
                <li>• Refuser le marketing direct</li>
              </ul>
            </section>

            <section>
              <h3 className="text-base font-medium text-text-primary mb-4">Contact</h3>
              <p className="text-text-secondary leading-relaxed text-sm">
                Pour toute question concernant votre vie privée, contactez-nous à:
                <span style={{ color: '#C1652E' }}> privacy@fooddeliverybf.com</span>
              </p>
            </section>

            <div className="pt-6 border-t border-border-light">
              <button onClick={() => navigate('/')} className="px-6 py-3 text-sm font-medium text-white transition-colors" style={{ backgroundColor: '#C1652E' }}>
                Retour à l'accueil
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Privacy;
