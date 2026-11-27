import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, LocateFixed, MapPin, Navigation, Package, Phone } from 'lucide-react';
import Shell from '../components/Shell';
import MissionMap, { navigationUrl } from '../components/MissionMap';
import { Amount, ErrorNote, GoodNote, Loading, StatusPill, statusTone } from '../components/ui';
import useLiveLocation from '../hooks/useLiveLocation';
import { earningOf, fetchOrder, markDelivered, markPickedUp, statusLabel } from '../services/courier';

const movingStatuses = ['DRIVER_ASSIGNED', 'PROCESSING', 'IN_DELIVERY'];
const atHandoff = 'DELIVERED_PENDING_CONFIRMATION';

function phoneLink(phone) {
  const number = typeof phone === 'string' ? phone.replace(/[\s().-]/g, '') : '';
  return /^\+?[0-9]{6,15}$/.test(number) ? `tel:${number}` : null;
}

function Stop({ label, point }) {
  return (
    <div className="mission-stop">
      <MapPin size={17} aria-hidden="true" />
      <div>
        <span className="muted">{label}</span>
        <strong>{point?.address || 'Voir le repère sur la carte'}</strong>
      </div>
    </div>
  );
}

export default function MissionDetail() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);
  const [busy, setBusy] = useState(false);
  const version = useRef(0);
  const view = order?.id === id ? order : null;
  const status = view?.status;
  const active = movingStatuses.includes(status);
  const { coords, error: gpsError, sharedAt, sharingUnavailable } = useLiveLocation({ orderId: id, enabled: active });

  const load = useCallback(async () => {
    const request = ++version.current;
    try {
      const result = await fetchOrder(id);
      if (request !== version.current) return;
      setOrder(result);
      setError(null);
    } catch (failure) {
      if (request === version.current) setError(failure.message);
    } finally {
      if (request === version.current) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    setLoading(true);
    setDone(null);
    void load();
    const timer = setInterval(load, 20_000);
    return () => { version.current += 1; clearInterval(timer); };
  }, [load]);

  const update = async (action, message) => {
    setBusy(true);
    setError(null);
    try {
      await action(id);
      setDone(message);
      await load();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };

  const back = <Link className="btn btn-ghost btn-icon" to="/missions" aria-label="Retour aux courses"><ArrowLeft size={20} /></Link>;

  if (loading || !view) {
    return (
      <Shell title="Course" right={back}>
        {loading ? <Loading /> : <ErrorNote>{error || 'Course introuvable.'}</ErrorNote>}
      </Shell>
    );
  }

  const pickup = view.pickupLocation;
  const destination = view.dropoffLocation ?? view.deliveryLocation;
  const toDestination = status === 'IN_DELIVERY' || status === atHandoff;
  const next = toDestination ? destination : pickup;
  const nextLabel = toDestination ? 'Remettre le colis' : 'Récupérer le colis';
  const contactPhone = (active || status === atHandoff) && phoneLink(next?.contactPhone);
  const directions = active ? navigationUrl(next) : null;
  const showContact = active || status === atHandoff;
  const locationMessage = gpsError || (sharingUnavailable ? 'Partage en pause. Nouvelle tentative automatique.'
    : sharedAt ? 'GPS partagé pendant que cet écran est ouvert' : 'Connexion au suivi GPS…');

  return (
    <Shell title="Ma course" kicker={view.trackingReference || 'Détail de la course'} right={back} hideNav>
      <MissionMap orderId={id} pickup={pickup} destination={destination} coords={coords}
        toDestination={toDestination} active={active} />
      <section className="card mission-panel" aria-label={showContact ? nextLabel : 'Détails de la course'}>
        <div className="mission-stage">
          {showContact && <span>{toDestination ? 'B · Remise' : 'A · Retrait'}</span>}
          <StatusPill tone={statusTone(status)}>{statusLabel(status)}</StatusPill>
        </div>

        {showContact && (
          <>
            <h2>{nextLabel}</h2>
            <p className="mission-address">{next?.address || 'Adresse à confirmer'}</p>
            {next?.instructions && <p className="mission-instructions">{next.instructions}</p>}
            <p className="mission-contact">
              <strong>{next?.contactName || 'Contact non renseigné'}</strong>
              {contactPhone && <span>{next.contactPhone}</span>}
            </p>
            {(directions || contactPhone) && (
              <div className="mission-tools">
                {directions && (
                  <a className="btn btn-primary" href={directions} target="_blank" rel="noopener noreferrer"
                    aria-label="Ouvrir l’itinéraire dans Google Maps">
                    <Navigation size={18} aria-hidden="true" /> Itinéraire
                  </a>
                )}
                {contactPhone && <a className="btn btn-ghost" href={contactPhone}><Phone size={17} aria-hidden="true" /> Appeler</a>}
              </div>
            )}
          </>
        )}
        {active && <p className="mission-signal" role="status"><LocateFixed size={16} aria-hidden="true" />{locationMessage}</p>}
        <details className="mission-stops">
          <summary>Détails de la course</summary>
          <Stop label="A · Retrait" point={pickup} />
          <Stop label="B · Remise" point={destination} />
          {view.packageDetails?.description && (
            <p className="mission-parcel"><Package size={16} aria-hidden="true" />{view.packageDetails.description}</p>
          )}
          <Amount value={earningOf(view).net} caption="à percevoir" />
        </details>
      </section>
      <ErrorNote>{error}</ErrorNote>
      <GoodNote>{done}</GoodNote>
      <div className="actionbar">
        {status === 'DRIVER_ASSIGNED' ? (
          <button type="button" className="btn btn-accent btn-block" disabled={busy}
            onClick={() => update(markPickedUp, 'Retrait confirmé.')}>
            {busy ? 'Enregistrement…' : 'J’ai récupéré le colis'}
          </button>
        ) : status === 'IN_DELIVERY' ? (
          <button type="button" className="btn btn-accent btn-block" disabled={busy}
            onClick={() => update(markDelivered, 'Remise signalée au destinataire.')}>
            {busy ? 'Enregistrement…' : 'J’ai remis le colis'}
          </button>
        ) : status === atHandoff ? (
          <p className="note note-warn">Le destinataire confirme la réception avec son code dans le suivi Koliwa.</p>
        ) : (
          <Link className="btn btn-primary btn-block" to="/missions">Retour aux courses</Link>
        )}
      </div>
    </Shell>
  );
}
