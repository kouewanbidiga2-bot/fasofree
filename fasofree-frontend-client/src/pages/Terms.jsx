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
              <h2 className="text-xl font-display font-medium text-text-primary mb-2">Conditions Générales</h2>
              <p className="text-text-secondary text-sm">Dernière mise à jour: Janvier 2024</p>
            </div>

            <section>
              <h3 className="text-base font-medium text-text-primary mb-4 flex items-center gap-2">
                <CheckCircle size={16} strokeWidth={1.5} style={{ color: '#C1652E' }} />
                Acceptation des conditions
              </h3>
              <p className="text-text-secondary leading-relaxed text-sm">
                En utilisant l'application Food Delivery BF, vous acceptez ces conditions d'utilisation.
                Si vous n'acceptez pas ces conditions, veuillez ne pas utiliser notre application.
              </p>
            </section>

            <section>
              <h3 className="text-base font-medium text-text-primary mb-4 flex items-center gap-2">
                <AlertCircle size={16} strokeWidth={1.5} style={{ color: '#C1652E' }} />
                Utilisation du service
              </h3>
              <p className="text-text-secondary leading-relaxed text-sm">
                Food Delivery BF vous permet de commander des repas auprès de nos restaurants partenaires.
                Vous devez être âgé d'au moins 18 ans pour utiliser notre service.
                Vous êtes responsable de la sécurité de votre compte et de toutes les activités
                effectuées sous votre compte.
              </p>
            </section>

            <section>
              <h3 className="text-base font-medium text-text-primary mb-4 flex items-center gap-2">
                <Scale size={16} strokeWidth={1.5} style={{ color: '#C1652E' }} />
                Commandes et paiements
              </h3>
              <p className="text-text-secondary leading-relaxed text-sm">
                Toutes les commandes sont sujettes à disponibilité. Les prix peuvent varier.
                Nous acceptons divers modes de paiement: Wave, Orange Money, Moov Money,
                Telecel Money et cartes bancaires. Les paiements sont sécurisés.
              </p>
            </section>

            <section>
              <h3 className="text-base font-medium text-text-primary mb-4">Livraison</h3>
              <p className="text-text-secondary leading-relaxed text-sm">
                Les délais de livraison sont estimés et peuvent varier selon les conditions
                météorologiques et le trafic. Nous ne sommes pas responsables des retards
                dus à des circonstances indépendantes de notre volonté.
              </p>
            </section>

            <section>
              <h3 className="text-base font-medium text-text-primary mb-4">Annulations et remboursements</h3>
              <p className="text-text-secondary leading-relaxed text-sm">
                Vous pouvez annuler votre commande tant qu'elle n'a pas été acceptée par le restaurant.
                Une fois acceptée, les annulations sont à la discrétion du restaurant.
                Les remboursements seront traités dans les 5-7 jours ouvrables.
              </p>
            </section>

            <section>
              <h3 className="text-base font-medium text-text-primary mb-4">Propriété intellectuelle</h3>
              <p className="text-text-secondary leading-relaxed text-sm">
                Tout le contenu de l'application (logos, images, textes) est la propriété
                de Food Delivery BF ou de ses partenaires. Toute reproduction non autorisée
                est interdite.
              </p>
            </section>

            <section>
              <h3 className="text-base font-medium text-text-primary mb-4">Limitation de responsabilité</h3>
              <p className="text-text-secondary leading-relaxed text-sm">
                Food Delivery BF ne peut être tenu responsable des dommages directs ou indirects
                résultant de l'utilisation de notre service. Nous nous efforçons de fournir
                un service de qualité mais ne garantissons pas une disponibilité à 100%.
              </p>
            </section>

            <section>
              <h3 className="text-base font-medium text-text-primary mb-4">Modifications</h3>
              <p className="text-text-secondary leading-relaxed text-sm">
                Nous nous réservons le droit de modifier ces conditions à tout moment.
                Les modifications seront notifiées via l'application. Votre utilisation continue
                du service après les modifications constitue une acceptation des nouvelles conditions.
              </p>
            </section>

            <section>
              <h3 className="text-base font-medium text-text-primary mb-4">Contact</h3>
              <p className="text-text-secondary leading-relaxed text-sm">
                Pour toute question concernant ces conditions, contactez-nous à:
                <span style={{ color: '#C1652E' }}> legal@fooddeliverybf.com</span>
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
