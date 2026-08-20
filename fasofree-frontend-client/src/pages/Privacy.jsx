import React from 'react';
import { useNavigate } from 'react-router-dom';
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
              <h2 className="text-xl font-display font-medium text-text-primary mb-2">Politique de Confidentialité</h2>
              <p className="text-text-secondary text-sm">Dernière mise à jour : 2026</p>
            </div>

            <section>
              <h3 className="text-base font-medium text-text-primary mb-4">1. Collecte des données</h3>
              <p className="text-text-secondary leading-relaxed text-sm">
                FasoFree collecte les informations nécessaires au traitement de vos commandes : nom, numéro de téléphone, adresse de livraison, et données de géolocalisation lorsque l'application est active.
              </p>
            </section>

            <section>
              <h3 className="text-base font-medium text-text-primary mb-4">2. Utilisation de vos informations</h3>
              <p className="text-text-secondary leading-relaxed text-sm">
                Vos données sont exclusivement utilisées pour : le traitement de vos commandes, l'optimisation des itinéraires de livraison, le support client, et la sécurité de votre compte (vérification OTP).
              </p>
            </section>

            <section>
              <h3 className="text-base font-medium text-text-primary mb-4">3. Partage des données</h3>
              <p className="text-text-secondary leading-relaxed text-sm">
                Vos informations (nom, téléphone, adresse) sont temporairement partagées avec le commerçant et le livreur assigné pour garantir la bonne exécution de la livraison. Elles ne sont jamais vendues à des tiers.
              </p>
            </section>

            <section>
              <h3 className="text-base font-medium text-text-primary mb-4">4. Vos droits</h3>
              <p className="text-text-secondary leading-relaxed text-sm">
                Conformément à la réglementation de la Commission de l'Informatique et des Libertés (CIL) du Burkina Faso, vous disposez d'un droit d'accès, de rectification et de suppression de vos données. Vous pouvez exercer ce droit en nous contactant à : kouewanbidiga2@gmail.com.
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
