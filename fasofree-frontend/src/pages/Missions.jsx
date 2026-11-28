/**
 * Copyright (c) 2026 BIDIGA Imrane - Koliwa. All rights reserved.
 * Proprietary and confidential.
 */

/**
 * Courses — écran principal du livreur.
 *
 * Le livreur passe en ligne (position + disponibilité), voit sa course en
 * cours, puis les courses à prendre. La liste est rafraîchie toutes les 20 s
 * en secours ; le socket `/dispatch` déclenche aussi un rafraîchissement dès
 * qu'une opportunité arrive.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, RefreshCw, Timer } from 'lucide-react';
import Shell from '../components/Shell';
import {
  Amount,
  CardSkeleton,
  Empty,
  ErrorNote,
  StatusPill,
  Toggle,
  formatFcfa,
  statusTone,
} from '../components/ui';
import useAuthStore from '../store/authStore';
import useLiveLocation from '../hooks/useLiveLocation';
import {
  ACTIVE_STATUSES,
  acceptCourse,
  earningOf,
  fetchAvailableCourses,
  fetchMyOrders,
  fetchTodayEarnings,
  refuseCourse,
  setDriverStatus,
  statusLabel,
} from '../services/courier';
import { connectDispatch } from '../services/realtime';

const REFRESH_MS = 10000;

function TicketRoute({ order }) {
  return (
    <div className="mission-ticket-route">
      <span>
        <small>Retrait</small>
        <strong>{order.pickupLocation?.address || 'Point de retrait'}</strong>
      </span>
      <ArrowRight size={17} aria-hidden="true" />
      <span>
        <small>Remise</small>
        <strong>{order.dropoffLocation?.address || order.deliveryLocation?.address || 'Point de remise'}</strong>
      </span>
    </div>
  );
}

const Missions = () => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const updateAvailability = useAuthStore((s) => s.updateAvailability);
  const online = user?.isOnline === true;
  const [changingAvailability, setChangingAvailability] = useState(false);
  const [mine, setMine] = useState([]);
  const [available, setAvailable] = useState([]);
  const [today, setToday] = useState(null);
  const [clock, setClock] = useState(Date.now);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const mounted = useRef(true);
  const requestVersion = useRef(0);

  const { coords, error: geoError } = useLiveLocation({ enabled: online });
  const onlineRef = useRef(online);
  onlineRef.current = online;

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    const request = ++requestVersion.current;
    const isCurrent = () => mounted.current && request === requestVersion.current;
    try {
      const [rows, summary, list] = await Promise.all([
        fetchMyOrders(),
        fetchTodayEarnings().catch(() => null),
        onlineRef.current ? fetchAvailableCourses() : Promise.resolve([]),
      ]);
      if (!isCurrent()) return;
      setMine(Array.isArray(rows) ? rows : []);
      setToday(summary);
      setAvailable(onlineRef.current ? list : []);
      setClock(Date.now());
      setError(null);
    } catch (err) {
      if (isCurrent()) setError(err.message);
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    load();
    return () => {
      mounted.current = false;
      requestVersion.current += 1;
    };
  }, [load, online]);

  // Rabattement périodique : le socket peut être muet dans un tunnel réseau.
  useEffect(() => {
    const id = setInterval(() => load({ silent: true }), REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  // Opportunité poussée par le dispatch : on rafraîchit la liste.
  useEffect(() => {
    const socket = connectDispatch();
    const onOpportunity = () => load({ silent: true });
    const events = ['delivery_opportunity', 'targeted_order_offer', 'p2p_offer_closed', 'orderStatusChanged', 'newOrderAlert'];
    events.forEach(event => socket.on(event, onOpportunity));
    return () => {
      events.forEach(event => socket.off(event, onOpportunity));
    };
  }, [load]);

  const active = useMemo(
    () => mine.filter((order) => ACTIVE_STATUSES.includes(order.status)),
    [mine],
  );

  const currentOffers = available.filter(order => !order.expiresAt || Date.parse(order.expiresAt) > clock);
  const hasExpiringOffers = currentOffers.some(order => order.expiresAt);
  useEffect(() => {
    if (!hasExpiringOffers) return;
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [hasExpiringOffers]);

  const onRefuse = async (orderId) => {
    setBusyId(orderId);
    try {
      await refuseCourse(orderId);
      await load({ silent: true });
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusyId(null);
    }
  };

  const toggleOnline = async () => {
    const next = !online;
    setChangingAvailability(true);
    setError(null);
    try {
      await setDriverStatus({
        isOnline: next,
        isAvailable: next,
        ...(coords ? { latitude: coords.latitude, longitude: coords.longitude } : {}),
      });
      updateAvailability(user.id, next);
    } catch (err) {
      setError(err.message);
    } finally {
      setChangingAvailability(false);
    }
  };

  const onAccept = async (orderId) => {
    setBusyId(orderId);
    setError(null);
    try {
      await acceptCourse(orderId);
      navigate(`/missions/${orderId}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Shell
      title="Courses"
      right={
        <button
          type="button"
          className="btn btn-ghost btn-icon"
          onClick={() => load({ silent: true })}
          aria-label="Rafraîchir les courses"
        >
          <RefreshCw size={17} />
        </button>
      }
    >
      <section className="card mission-overview">
        <div className="row">
          <div className="stack">
            <span className="mission-availability" data-online={online}>{online ? 'En ligne' : 'Hors ligne'}</span>
            <span className="strong" style={{ fontSize: 17 }}>
              {user?.fullName || 'Coursier'}
            </span>
          </div>
          <Toggle checked={online} onChange={toggleOnline} disabled={changingAvailability} label="Disponibilité" />
        </div>

        <div className="row row-tight">
          <span className="muted">
            {online ? 'Vous recevez les courses autour de vous.' : 'Passez en ligne pour recevoir des courses.'}
          </span>
          {today ? (
            <span className="amount" style={{ fontSize: 18 }}>
              {formatFcfa(today.net)}
              <small>{today.count} course{today.count > 1 ? 's' : ''} aujourd'hui</small>
            </span>
          ) : null}
        </div>

        {geoError ? <p className="muted" style={{ color: '#7a3a10', margin: 0 }}>{geoError}</p> : null}
      </section>

      <ErrorNote>{error}</ErrorNote>

      <h2 className="mission-section-title">Mes courses en cours</h2>

      {loading && active.length === 0 ? (
        <>
          <CardSkeleton />
        </>
      ) : active.length === 0 ? (
        <div className="card card-flat">
          <p className="muted" style={{ margin: 0 }}>
            Aucune course en cours. Les courses acceptées apparaissent ici jusqu'à la confirmation du client.
          </p>
        </div>
      ) : (
        active.map((order) => {
          const money = earningOf(order);
          return (
            <Link key={order.id} to={`/missions/${order.id}`} className="card card-link mission-ticket">
              <div className="mission-ticket-head">
                <span className="mission-ticket-reference">{order.trackingReference || order.id.slice(0, 8)}</span>
                <StatusPill tone={statusTone(order.status)}>{statusLabel(order.status)}</StatusPill>
              </div>
              <TicketRoute order={order} />
              <div className="mission-ticket-foot">
                <Amount value={money.net} caption="à percevoir" />
                <span className="mission-ticket-open">
                  Voir la course <ArrowRight size={16} aria-hidden="true" />
                </span>
              </div>
            </Link>
          );
        })
      )}

      <h2 className="mission-section-title">Courses disponibles</h2>

      {!online ? (
        <div className="card card-flat">
          <p className="muted" style={{ margin: 0 }}>
            Activez votre disponibilité pour voir les courses publiées à Ouagadougou.
          </p>
        </div>
      ) : loading && currentOffers.length === 0 ? (
        <>
          <CardSkeleton lines={4} />
          <CardSkeleton lines={4} />
        </>
      ) : currentOffers.length === 0 ? (
        <Empty title={active.length >= 3 ? 'Trois courses en cours' : 'Aucune offre à proximité'}
          hint={active.length >= 3 ? 'Terminez une course pour recevoir de nouvelles offres.' : 'Gardez le GPS actif pour recevoir les offres proches du ramassage.'} />
      ) : (
        currentOffers.map((order) => {
          const money = earningOf(order);
          const remaining = order.expiresAt ? Math.ceil((Date.parse(order.expiresAt) - clock) / 1000) : null;
          return (
            <article key={order.id} className="card mission-ticket">
              <div className="mission-ticket-head">
                <span className="mission-ticket-reference">{order.trackingReference || order.id.slice(0, 8)}</span>
                <StatusPill tone="accent">{remaining == null ? statusLabel(order.status) : `${remaining} s pour répondre`}</StatusPill>
              </div>

              <TicketRoute order={order} />

              <div className="meta">
                {Number.isFinite(order.pickupDistanceKm) ? (
                  <span className="pill">
                    <Timer size={12} /> {order.pickupDistanceKm.toLocaleString('fr-FR')} km jusqu’au retrait
                  </span>
                ) : null}
                {money.fee ? <span className="pill">commission {formatFcfa(money.fee)}</span> : null}
                {order.packageDetails?.isFragile ? <span className="pill pill-warn">Fragile</span> : null}
              </div>

              <div className="mission-ticket-foot">
                <Amount value={money.net} caption="gain net" />
                {order.expiresAt && <button type="button" className="btn btn-ghost" disabled={Boolean(busyId)}
                  onClick={() => onRefuse(order.id)}>Refuser</button>}
                <button
                  type="button"
                  className="btn btn-accent"
                  disabled={Boolean(busyId)}
                  onClick={() => onAccept(order.id)}
                >
                  {busyId === order.id ? 'Acceptation…' : 'Accepter'}
                </button>
              </div>
            </article>
          );
        })
      )}
    </Shell>
  );
};

export default Missions;
