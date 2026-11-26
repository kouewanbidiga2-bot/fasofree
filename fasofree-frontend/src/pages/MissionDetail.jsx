/**
 * Copyright (c) 2026 BIDIGA Imrane - Koliwa. All rights reserved.
 * Proprietary and confidential.
 */

/**
 * Détail d'une course.
 *
 * Les actions suivent strictement la FSM du backend : accepter (depuis la
 * liste), marquer le colis récupéré (IN_DELIVERY), puis signaler la remise
 * (driver-validate). La confirmation finale appartient au client, via son code
 * PIN : le livreur ne clôture jamais une course lui-même.
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Copy, Navigation, Phone } from 'lucide-react';
import Shell from '../components/Shell';
import { Amount, ErrorNote, GoodNote, Loading, StatusPill, formatFcfa, statusTone } from '../components/ui';
import useLiveLocation from '../hooks/useLiveLocation';
import { earningOf, fetchOrder, markDelivered, markPickedUp, statusLabel } from '../services/courier';

const Step = ({ state, title, hint }) => (
  <div className={`timeline-step ${state}`}>
    <span className="timeline-mark" />
    <div className="stack">
      <span className="strong" style={{ fontSize: 14 }}>{title}</span>
      {hint ? <span className="muted">{hint}</span> : null}
    </div>
  </div>
);

const ContactLine = ({ location, label }) => {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(location?.address || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* presse-papiers refusé : le bouton Itinéraire reste disponible */
    }
  };

  return (
    <div className="stack" style={{ gap: 8 }}>
      <span className="section-title" style={{ margin: 0 }}>{label}</span>
      <span className="strong" style={{ fontSize: 15.5, lineHeight: 1.35 }}>
        {location?.address || 'Adresse à confirmer'}
      </span>
      {location?.contactName ? (
        <span className="muted">
          {location.contactName}
          {location.contactPhone ? ` · ${location.contactPhone}` : ''}
        </span>
      ) : null}
      {location?.instructions ? <span className="muted">« {location.instructions} »</span> : null}

      <div className="btn-row">
        {location?.latitude && location?.longitude ? (
          <a
            className="btn btn-ghost btn-sm"
            href={`https://www.google.com/maps/dir/?api=1&destination=${location.latitude},${location.longitude}`}
            target="_blank"
            rel="noreferrer"
          >
            <Navigation size={15} /> Itinéraire
          </a>
        ) : null}
        {location?.contactPhone ? (
          <a className="btn btn-ghost btn-sm" href={`tel:${location.contactPhone}`}>
            <Phone size={15} /> Appeler
          </a>
        ) : null}
        {location?.address ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={copy}>
            {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? 'Copié' : 'Adresse'}
          </button>
        ) : null}
      </div>
    </div>
  );
};

const MissionDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);
  const [busy, setBusy] = useState(false);

  // Position rattachée à la course : c'est elle que le client voit avancer.
  useLiveLocation({ orderId: id, enabled: Boolean(order) });

  const load = useCallback(async () => {
    try {
      const data = await fetchOrder(id);
      setOrder(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 20000);
    return () => clearInterval(timer);
  }, [load]);

  const run = async (fn, successMessage) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
      setDone(successMessage);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <Shell title="Course">
        <Loading />
      </Shell>
    );
  }

  if (!order) {
    return (
      <Shell title="Course">
        <ErrorNote>{error || 'Course introuvable.'}</ErrorNote>
        <button type="button" className="btn btn-block" onClick={() => navigate('/missions')}>
          Retour aux courses
        </button>
      </Shell>
    );
  }

  const money = earningOf(order);
  const status = order.status;
  const delivered = ['DELIVERED_PENDING_CONFIRMATION', 'DELIVERED', 'COMPLETED'].includes(status);
  const pickedUp = ['IN_DELIVERY', 'DELIVERED_PENDING_CONFIRMATION', 'DELIVERED', 'COMPLETED'].includes(status);

  return (
    <Shell
      title="Course"
      kicker={order.trackingReference || 'Détail de la course'}
      hideNav
      right={
        <button
          type="button"
          className="btn btn-ghost btn-icon"
          onClick={() => navigate('/missions')}
          aria-label="Retour aux courses"
        >
          <ArrowLeft size={18} />
        </button>
      }
    >
      <section className="card">
        <div className="row">
          <StatusPill tone={statusTone(status)}>{statusLabel(status)}</StatusPill>
          <Amount value={money.net} />
        </div>
        <hr className="divider" />
        <div className="row row-tight">
          <span className="muted">Prix de la livraison</span>
          <span className="strong" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatFcfa(money.gross)}</span>
        </div>
        {money.fee ? (
          <div className="row row-tight">
            <span className="muted">Commission Koliwa</span>
            <span className="muted" style={{ fontVariantNumeric: 'tabular-nums' }}>−{formatFcfa(money.fee)}</span>
          </div>
        ) : null}
      </section>

      <ErrorNote>{error}</ErrorNote>
      <GoodNote>{done}</GoodNote>

      {order.packageDetails?.description ? (
        <section className="card">
          <span className="section-title" style={{ margin: 0 }}>Colis</span>
          <span className="strong" style={{ fontSize: 15.5 }}>{order.packageDetails.description}</span>
          <div className="meta">
            <span className="pill">{order.packageDetails.isFragile ? 'Fragile' : 'Standard'}</span>
            {order.packageDetails.weight ? <span className="pill">{order.packageDetails.weight} kg</span> : null}
          </div>
        </section>
      ) : null}

      <section className="card">
        <ContactLine location={order.pickupLocation} label="Retrait" />
        <hr className="divider" />
        <ContactLine location={order.dropoffLocation} label="Livraison" />
      </section>

      <section className="card">
        <span className="section-title" style={{ margin: 0 }}>Avancement</span>
        <div className="timeline">
          <Step state="done" title="Course acceptée" hint="Rendez-vous au point de retrait" />
          <Step
            state={pickedUp ? 'done' : 'current'}
            title="Colis récupéré"
            hint={pickedUp ? order.pickupLocation?.address : 'Confirmez dès que le colis est en main'}
          />
          <Step
            state={delivered ? 'done' : pickedUp ? 'current' : ''}
            title="Colis remis"
            hint="Le client confirme ensuite avec son code à 6 chiffres"
          />
        </div>
      </section>

      <div className="actionbar">
        {status === 'READY_FOR_PICKUP' ? (
          <p className="muted" style={{ margin: 0 }}>
            Cette course est encore disponible : acceptez-la depuis la liste des courses.
          </p>
        ) : null}

        {status === 'DRIVER_ASSIGNED' ? (
          <button
            type="button"
            className="btn btn-primary btn-block"
            disabled={busy}
            onClick={() => run(() => markPickedUp(order.id), 'Colis marqué comme récupéré.')}
          >
            {busy ? 'Enregistrement…' : "J'ai récupéré le colis"}
          </button>
        ) : null}

        {status === 'IN_DELIVERY' ? (
          <button
            type="button"
            className="btn btn-accent btn-block"
            disabled={busy}
            onClick={() => run(() => markDelivered(order.id), 'Remise signalée. Demandez le code au client.')}
          >
            {busy ? 'Enregistrement…' : "J'ai remis le colis"}
          </button>
        ) : null}

        {status === 'DELIVERED_PENDING_CONFIRMATION' ? (
          <p className="note note-warn" style={{ margin: 0, textAlign: 'center' }}>
            Colis remis. Demandez au client son code à 6 chiffres pour clôturer la course.
          </p>
        ) : null}

        {delivered && status !== 'DELIVERED_PENDING_CONFIRMATION' ? (
          <button type="button" className="btn btn-primary btn-block" onClick={() => navigate('/missions')}>
            Retour aux courses
          </button>
        ) : null}

        {['CANCELLED', 'FAILED', 'DISPUTED', 'REFUNDED'].includes(status) ? (
          <button type="button" className="btn btn-block" onClick={() => navigate('/missions')}>
            Retour aux courses
          </button>
        ) : null}
      </div>
    </Shell>
  );
};

export default MissionDetail;
