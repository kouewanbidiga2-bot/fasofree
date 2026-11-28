import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Headphones, LocateFixed, Map, MapPin, Navigation, Package, Phone } from 'lucide-react';
import Shell from '../components/Shell';
import MissionMap, { navigationUrl } from '../components/MissionMap';
import { Amount, ErrorNote, GoodNote, Loading, StatusPill, statusTone } from '../components/ui';
import useLiveLocation from '../hooks/useLiveLocation';
import { earningOf, fetchOrder, fetchOrderTracking, markDelivered, markPickedUp, ON_ROUTE_STATUSES, recordArrival, statusLabel } from '../services/courier';
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
  const [tracking, setTracking] = useState(null);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);
  const [busy, setBusy] = useState(false);
  const version = useRef(0);
  const view = order?.id === id ? order : null;
  const status = view?.status;
  const active = ON_ROUTE_STATUSES.includes(status);
  const { coords, error: gpsError, sharedAt, sharingUnavailable } = useLiveLocation({ orderId: id, enabled: active });

  const load = useCallback(async () => {
    const request = ++version.current;
    try {
      const result = await fetchOrder(id);
      if (request !== version.current) return;
      setOrder(result);
      setError(null);
      setLoading(false);
      if (!ON_ROUTE_STATUSES.includes(result.status)) {
        setTracking(null);
        return;
      }
      const live = await fetchOrderTracking(id).catch(() => null);
      if (request === version.current) setTracking(live);
    } catch (failure) {
      if (request === version.current) setError(failure.message);
    } finally {
      if (request === version.current) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    setLoading(true);
    setDone(null);
    setTracking(null);
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
  const stop = toDestination ? 'dropoff' : 'pickup';
  const arrival = toDestination ? view.dropoffArrival : view.pickupArrival;
  const arrived = Boolean(arrival && arrival.driverId === view.driverId);
  const eta = active && !arrived && tracking?.orderId === id && tracking?.eta?.stop === stop ? tracking.eta : null;
  const contactPhone = (active || status === atHandoff) && phoneLink(next?.contactPhone);
  const supportPhone = phoneLink(import.meta.env.VITE_SUPPORT_PHONE);
  const mapAction = () => document.getElementById('carte-course')?.scrollIntoView({ block: 'start' });
  const directions = active ? navigationUrl(next) : null;
  const showContact = active || status === atHandoff;
  const locationMessage = gpsError || (sharingUnavailable ? 'Partage en pause. Nouvelle tentative automatique.'
    : sharedAt ? 'GPS partagé pendant que cet écran est ouvert' : 'Connexion au suivi GPS…');

  return (
    <Shell title="Ma course" kicker={view.trackingReference || 'Détail de la course'} right={back} hideNav>
      <div id="carte-course" className="mission-map-anchor">
        <MissionMap orderId={id} pickup={pickup} destination={destination} coords={coords}
          toDestination={toDestination} active={active} eta={eta} />
      </div>
      <section className="card mission-panel" aria-label={showContact ? nextLabel : 'Détails de la course'}>
        <div className="mission-stage">
          {showContact && <span>{toDestination ? 'B · Remise' : 'A · Retrait'}</span>}
          <StatusPill tone={statusTone(status)}>{active && arrived ? 'Sur place' : statusLabel(status)}</StatusPill>
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
        {active && supportPhone && (
          <a className="btn btn-ghost mission-support" href={supportPhone}>
            <Headphones size={17} aria-hidden="true" /> Un problème sur cette course ?
          </a>
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
      <div className="actionbar mission-actions">
        <button type="button" className="btn btn-ghost mission-map-shortcut" onClick={mapAction}>
          <Map size={18} aria-hidden="true" /> Carte
        </button>
        {active && !arrived ? (
          <button type="button" className="btn btn-accent btn-block" disabled={busy}
            onClick={() => update((orderId) => recordArrival(orderId, stop), 'Arrivée enregistrée.')}>
            {busy ? 'Enregistrement…' : 'Je suis sur place'}
          </button>
        ) : active && !toDestination ? (
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
