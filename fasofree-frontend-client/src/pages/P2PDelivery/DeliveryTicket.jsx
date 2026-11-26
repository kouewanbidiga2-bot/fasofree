import { MapPin, Package } from 'lucide-react';
import { P2P_SERVICE_FEE } from '../../utils/p2pPricing';

const formatAmount = new Intl.NumberFormat('fr-BF');
const amount = (value) => `${formatAmount.format(value)} F CFA`;

export default function DeliveryTicket({ pickup, dropoff, estimate, showPrice }) {
  const extras = estimate?.breakdown;
  const rounding = extras && estimate.price - extras.basePrice - extras.distancePrice - extras.fragileSurcharge - extras.weightSurcharge;

  return (
    <aside className="delivery-ticket" data-show-price={showPrice} aria-labelledby="delivery-ticket-title">
      <div className="delivery-ticket-heading">
        <h2 id="delivery-ticket-title">Votre trajet</h2>
        {estimate && <span>{estimate.distance.toLocaleString('fr-BF')} km estimés</span>}
      </div>
      <dl className="delivery-ticket-stops">
        <div>
          <MapPin size={18} aria-hidden="true" />
          <dt>Départ</dt>
          <dd>{pickup.address || 'Adresse de départ à renseigner'}</dd>
        </div>
        <div>
          <Package size={18} aria-hidden="true" />
          <dt>Arrivée</dt>
          <dd>{dropoff.address || 'Adresse de remise à renseigner'}</dd>
        </div>
      </dl>
      {showPrice && (
        <div className="delivery-ticket-price">
          <p>Estimation du total à payer</p>
          {estimate ? (
            <>
              <strong>{amount(estimate.price + P2P_SERVICE_FEE)}</strong>
              <p>Dont {amount(P2P_SERVICE_FEE)} de frais de service FasoFree, offerts avec le Pass VIP.</p>
              <p>Le montant final s’affiche avant le paiement.</p>
              <details>
                <summary>Détail du tarif</summary>
                <dl>
                  <div><dt>Tarif de départ</dt><dd>{amount(extras.basePrice)}</dd></div>
                  <div><dt>Distance</dt><dd>{amount(extras.distancePrice)}</dd></div>
                  {extras.fragileSurcharge > 0 && <div><dt>Colis fragile</dt><dd>{amount(extras.fragileSurcharge)}</dd></div>}
                  {extras.weightSurcharge > 0 && <div><dt>Surcoût de poids</dt><dd>{amount(extras.weightSurcharge)}</dd></div>}
                  {rounding > 0 && <div><dt>Arrondi</dt><dd>{amount(rounding)}</dd></div>}
                  <div><dt>Frais de service FasoFree</dt><dd>{amount(P2P_SERVICE_FEE)}</dd></div>
                </dl>
              </details>
            </>
          ) : <p>Confirmez les deux points sur la carte pour obtenir le tarif.</p>}
        </div>
      )}
    </aside>
  );
}
