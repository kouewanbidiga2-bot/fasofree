/**
 * Copyright (c) 2026 BIDIGA Imrane - Koliwa. All rights reserved.
 * Proprietary and confidential.
 */

/**
 * Détail d'une course.
 *
 * Les actions suivent strictement la FSM du backend : accepter, marquer le
 * colis récupéré (IN_DELIVERY), puis signaler la remise (driver-validate).
 * La confirmation finale appartient au client, via son code PIN.
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Navigation, Phone, Copy, Check } from 'lucide-react';
import Shell from '../components/Shell';
import { Loading, ErrorNote, GoodNote, StatusPill, formatFcfa } from '../components/ui';
import useLiveLocation from '../hooks/useLiveLocation';
import {
  earningOf,
  fetchOrder,
  markDelivered,
  markPickedUp,
  statusLabel,
} from '../services/courier';

const Step = ({ state, title, hint }) => (
  <div className={`timeline-step ${state}`}>
    <span className="timeline-mark" />
    <div className="stack">
      <span className="strong" style={{ fontSize: 14 }}>{title}</span>
      {hint ? <span className="muted">{hint}</span> : null}
    </div>
  </div>
);

const ContactLine = ({ location, label, fallback }) => {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(location?.address || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard refusé : le lien d'itinéraire reste disponible */
    }
  };

  return (
    <div className="stack" style={{ gap: 6 }}>
      <span className="section-title" style={{ margin: 0 }}>{label}</span>
      <span className="strong">{location?.address || fallback}</span>
      {location?.contactName ? (
        <span className="muted">
          {location.contactName}
          {location.contactPhone ? ` · ${location.contactPhone}` : ''}
        </span>
      ) : null}
      {location?.instructions ? <span className="muted">« {location.instructions} »</span> : null}
      <div className="btn-row" style={{ marginTop: 4 }}>
        {location?.latitude && location?.longitude ? (
          <a
            className="btn btn-ghost"
            href={`https://www.google.com/maps/dir/?api=1&destination=${location.latitude},${location.longitude}`}
            target="_blank"
            rel="noreferrer"
            style={{ textAlign: 'center' }}
          >
            <Navigation size={16} /> Itinéraire
          </a>
        ) : null}
        {location?.contactPhone ? (
          <a className="btn btn-ghost" href={`tel:${location.contactPhone}`} style={{ textAlign: 'center' }}>
            <Phone size={16} /> Appeler
          </a>
        ) : null}
        {location?.address ? (
          <button type="button" className="btn btn-ghost" onClick={copy}>
            {copied ? <Check size={16} /> : <Copy size={16} />} Adresse
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

  // Position envoyée avec la course en cours pour que le client la voie bouger.
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
  const steps = [
    { key: 'accepted', title: 'Course acceptée', hint: 'Rendez-vous au point de retrait', done: true },
    {
      key: 'picked',
      title: 'Colis récupéré',
      hint: order.pickupLocation?.address,
      done: ['IN_DELIVERY', 'DELIVERED_PENDING_CONFIRMATION'].includes(status),
      current: status === 'DRIVER_ASSIGNED',
    },
    {
      key: 'delivered',
      title: 'Colis remis',
      hint: 'Le client confirme ensuite avec son code',
      done: ['DELIVERED_PENDING_CONFIRMATION', 'DELIVERED', 'COMPLETED'].includes(status),
      current: status === 'IN_DELIVERY',
    },
  ];

  return (
    <Shell
      title="Course"
      right={
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => navigate('/missions')}
          style={{ minHeight: 36, padding: '6px 10px', border: 0 }}
        >
          <ArrowLeft size={18} />
        </button>
      }
    >
      <div className="card">
        <div className="row">
          <StatusPill tone={status === 'DELIVERED_PENDING_CONFIRMATION' ? 'warn' : 'ok'}>
            {statusLabel(status)}
          </StatusPill>
          <span className="amount">
            {formatFcfa(money.net)} <small>net</small>
          </span>
        </div>
        <div className="row">
          <span className="muted">{order.trackingReference || order.id.slice(0, 8)}</span>
          {money.fee ? <span className="muted">commission {formatFcfa(money.fee)}</span> : null}
        </div>
      </div>

      <ErrorNote>{error}</ErrorNote>
      <GoodNote>{done}</GoodNote>

      {order.packageDetails?.description ? (
        <div className="card">
          <span className="section-title" style={{ margin: 0 }}>Colis</span>
          <span className="strong">{order.packageDetails.description}</span>
          <span className="muted">
            {order.packageDetails.isFragile ? 'Fragile' : 'Standard'}
            {order.packageDetails.weight ? ` · ${order.packageDetails.weight} kg` : ''}
          </span>
        </div>
      ) : null}

      <div className="card">
        <ContactLine location={order.pickupLocation} label="Retrait" fallback="Point de retrait" />
        <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '4px 0' }} />
        <ContactLine location={order.dropoffLocation} label="Livraison" fallback="Point de livraison" />
      </div>

      <div className="card">
        <div className="timeline">
          {steps.map((step) => (
            <Step
              key={step.key}
              state={step.done ? 'done' : step.current ? 'current' : ''}
              title={step.title}
              hint={step.hint}
            />
          ))}
        </div>
      </div>

      {status === 'READY_FOR_PICKUP' ? (
        <div className="note">Cette course est encore disponible : acceptez-la depuis la liste des courses.</div>
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
        <div className="note note-warn">
          Colis remis. Demandez au client son code à 6 chiffres pour clôturer la course.
        </div>
      ) : null}

      <button type="button" className="btn btn-block" onClick={() => navigate('/missions')}>
        Retour aux courses
      </button>
    </Shell>
  );
};

export default MissionDetail;
