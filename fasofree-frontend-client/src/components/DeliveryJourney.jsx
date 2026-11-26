import { useState } from 'react';
import { ArrowRight, Bike, MapPin, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

const steps = [
  {
    label: 'Ramassage', icon: MapPin, title: 'Indiquez où récupérer le colis.',
    detail: 'Recherchez un lieu ou placez le repère sur la carte. Un renseignement sur l’entrée aide le coursier à vous trouver.',
    link: 'Préparer un envoi', to: '/p2p-delivery',
  },
  {
    label: 'En route', icon: Bike, title: 'Suivez le trajet.',
    detail: 'L’expéditeur et le destinataire peuvent consulter la même livraison avec le lien de suivi.',
    link: 'Ouvrir le suivi', to: '/suivre',
  },
  {
    label: 'Remise', icon: ShieldCheck, title: 'Confirmez la réception.',
    detail: 'Le destinataire utilise son code de réception dans le lien qui lui a été envoyé.',
    link: 'Voir mes livraisons', to: '/order-history',
  },
];

export default function DeliveryJourney() {
  const [active, setActive] = useState(0);
  const step = steps[active];
  return (
    <section className="home-journey" aria-labelledby="home-journey-title">
      <h2 id="home-journey-title">De l’envoi à la remise</h2>
      <div className="home-journey-body">
        <div className="home-journey-steps" role="group" aria-label="Étapes d’une livraison">
          {steps.map(({ label, icon: Icon }, index) => (
            <button key={label} type="button" aria-pressed={active === index}
              aria-controls="home-journey-detail" onClick={() => setActive(index)}>
              <Icon size={21} strokeWidth={1.65} aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </div>
        <div id="home-journey-detail" className="home-journey-detail" aria-live="polite">
          <div key={step.label}>
            <h3>{step.title}</h3>
            <p>{step.detail}</p>
            <Link to={step.to}>{step.link} <ArrowRight size={16} aria-hidden="true" /></Link>
          </div>
        </div>
      </div>
    </section>
  );
}
