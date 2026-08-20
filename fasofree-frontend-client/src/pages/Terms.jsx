import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, AlertCircle, CheckCircle, Scale } from 'lucide-react';

const Terms = () => {
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
            <h1 className="text-lg font-display font-bold text-text-primary">Conditions d'Utilisation</h1>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="border border-border-light p-6">
          <div className="space-y-8">
            <div className="text-center mb-8">
              <FileText size={48} className="mx-auto mb-4" strokeWidth={1.5} style={{ color: '#C1652E' }} />
              <h2 className="text-xl font-display font-medium text-text-primary mb-2">Conditions Générales d'Utilisation (CGU)</h2>
              <p className="text-text-secondary text-sm">Dernière mise à jour : 2026</p>
            </div>

            <section>
              <h3 className="text-base font-medium text-text-primary mb-4">1. Acceptation des conditions</h3>
              <p className="text-text-secondary leading-relaxed text-sm">
                En utilisant l'application FasoFree, vous acceptez d'être lié par les présentes conditions. FasoFree est une plateforme de mise en relation entre des utilisateurs, des commerçants partenaires et des livreurs indépendants à Ouagadougou.
              </p>
            </section>

            <section>
              <h3 className="text-base font-medium text-text-primary mb-4">2. Commandes et Livraisons</h3>
              <p className="text-text-secondary leading-relaxed text-sm">
                Les utilisateurs s'engagent à fournir une adresse de livraison exacte et un numéro de téléphone joignable (WhatsApp recommandé). Les délais de livraison sont fournis à titre indicatif.
              </p>
            </section>

            <section>
              <h3 className="text-base font-medium text-text-primary mb-4">3. Prix et Paiements</h3>
              <p className="text-text-secondary leading-relaxed text-sm">
                Les prix affichés incluent les frais de service. Le paiement s'effectue selon les méthodes proposées dans l'application (Mobile Money, Espèces à la livraison). L'utilisateur s'engage à régler la totalité du montant lors de la réception.
              </p>
            </section>

            <section>
              <h3 className="text-base font-medium text-text-primary mb-4">4. Litiges et Réclamations</h3>
              <p className="text-text-secondary leading-relaxed text-sm">
                En cas de problème avec une commande (erreur, produit manquant), l'utilisateur dispose de 24 heures pour ouvrir un litige via l'application.
              </p>
            </section>

            <section>
              <h3 className="text-base font-medium text-text-primary mb-4">5. Responsabilités</h3>
              <p className="text-text-secondary leading-relaxed text-sm">
                FasoFree s'efforce de garantir la qualité du service, mais ne saurait être tenu responsable des dommages indirects liés à l'utilisation de la plateforme.
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

export default Terms;
