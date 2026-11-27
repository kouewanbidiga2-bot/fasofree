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
import { Link } from 'react-router-dom';
import { ArrowRight, RefreshCw, Timer } from 'lucide-react';
import Shell from '../components/Shell';
import {
  Amount,
  CardSkeleton,
  Empty,
  ErrorNote,
  RouteLine,
  StatusPill,
  Toggle,
  formatFcfa,
  isToday,
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
  setDriverStatus,
  statusLabel,
} from '../services/courier';
import { connectDispatch } from '../services/realtime';

const REFRESH_MS = 20000;
const DONE_STATUSES = ['DELIVERED', 'COMPLETED'];

const Missions = () => {
  const user = useAuthStore((s) => s.user);
  const [online, setOnline] = useState(false);
  const [mine, setMine] = useState([]);
  const [available, setAvailable] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const mounted = useRef(true);

  const { coords, error: geoError } = useLiveLocation({ enabled: online });
  const onlineRef = useRef(online);
  onlineRef.current = online;

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const rows = await fetchMyOrders();
      if (!mounted.current) return;
      setMine(Array.isArray(rows) ? rows : []);

      if (onlineRef.current) {
        const list = await fetchAvailableCourses();
        if (!mounted.current) return;
        setAvailable(list);
      } else {
        setAvailable([]);
      }
      setError(null);
    } catch (err) {
      if (mounted.current) setError(err.message);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    load();
    return () => {
      mounted.current = false;
    };
  }, [load]);

  // Rabattement périodique : le socket peut être muet dans un tunnel réseau.
  useEffect(() => {
    const id = setInterval(() => load({ silent: true }), REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  // Opportunité poussée par le dispatch : on rafraîchit la liste.
  useEffect(() => {
    const socket = connectDispatch();
    const onOpportunity = () => load({ silent: true });
    socket.on('delivery_opportunity', onOpportunity);
    socket.on('newOrderAlert', onOpportunity);
    return () => {
      socket.off('delivery_opportunity', onOpportunity);
      socket.off('newOrderAlert', onOpportunity);
    };
  }, [load]);

  const active = useMemo(
    () => mine.filter((order) => ACTIVE_STATUSES.includes(order.status)),
    [mine],
  );

  /** Activité du jour, déduite des courses déjà livrées (liste serveur, pas de calcul local du solde). */
  const today = useMemo(() => {
    const rows = mine.filter(
      (order) =>
        DONE_STATUSES.includes(order.status) &&
        isToday(order.deliveredAt || order.updatedAt || order.createdAt),
    );
    return {
      count: rows.length,
      net: rows.reduce((sum, order) => sum + earningOf(order).net, 0),
    };
  }, [mine]);

  const toggleOnline = async () => {
    const next = !online;
    setOnline(next);
    setError(null);
    try {
      await setDriverStatus({
        isOnline: next,
        isAvailable: next,
        ...(coords ? { latitude: coords.latitude, longitude: coords.longitude } : {}),
      });
      load({ silent: true });
    } catch (err) {
      setOnline(!next);
      setError(err.message);
    }
  };

  const onAccept = async (orderId) => {
    setBusyId(orderId);
    setError(null);
    try {
      await acceptCourse(orderId);
      await load({ silent: true });
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
      <section className="card card-ink">
        <div className="row">
          <div className="stack">
            <span className="topbar-kicker">Bonne route</span>
            <span className="strong" style={{ fontSize: 17 }}>
              {user?.fullName || 'Coursier'}
            </span>
          </div>
          <Toggle checked={online} onChange={toggleOnline} label="Disponibilité" />
        </div>

        <div className="row row-tight">
          <span className="muted">
            {online ? 'Vous recevez les courses autour de vous.' : 'Passez en ligne pour recevoir des courses.'}
          </span>
          {today.count > 0 ? (
            <span className="amount" style={{ fontSize: 18 }}>
              {formatFcfa(today.net)}
              <small>{today.count} course{today.count > 1 ? 's' : ''} aujourd'hui</small>
            </span>
          ) : null}
        </div>

        {geoError ? <p className="muted" style={{ color: '#7a3a10', margin: 0 }}>{geoError}</p> : null}
      </section>

      <ErrorNote>{error}</ErrorNote>

      <p className="section-title">Ma course</p>

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
            <Link key={order.id} to={`/missions/${order.id}`} className="card card-link">
              <div className="row">
                <StatusPill tone={statusTone(order.status)}>{statusLabel(order.status)}</StatusPill>
                <Amount value={money.net} caption="à percevoir" />
              </div>
              <RouteLine pickup={order.pickupLocation} dropoff={order.dropoffLocation} compact />
              <div className="row">
                <span className="muted">{order.trackingReference || order.id.slice(0, 8)}</span>
                <span className="strong" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13.5 }}>
                  Ouvrir <ArrowRight size={15} />
                </span>
              </div>
            </Link>
          );
        })
      )}

      <p className="section-title">Courses disponibles</p>

      {!online ? (
        <div className="card card-flat">
          <p className="muted" style={{ margin: 0 }}>
            Activez votre disponibilité pour voir les courses publiées à Ouagadougou.
          </p>
        </div>
      ) : loading && available.length === 0 ? (
        <>
          <CardSkeleton lines={4} />
          <CardSkeleton lines={4} />
        </>
      ) : available.length === 0 ? (
        <Empty title="Aucune course pour le moment" hint="Restez en ligne : nous vous prévenons dès qu'une course est publiée." />
      ) : (
        available.map((order) => {
          const money = earningOf(order);
          return (
            <article key={order.id} className="card">
              <div className="row">
                <StatusPill tone="accent">{statusLabel(order.status)}</StatusPill>
                <Amount value={money.net} />
              </div>

              <RouteLine pickup={order.pickupLocation} dropoff={order.dropoffLocation} />

              <div className="meta">
                {order.distanceKm ? (
                  <span className="pill">
                    <Timer size={12} /> {order.distanceKm} km
                  </span>
                ) : null}
                {money.fee ? <span className="pill">commission {formatFcfa(money.fee)}</span> : null}
                {order.packageDetails?.isFragile ? <span className="pill pill-warn">Fragile</span> : null}
              </div>

              <div className="btn-row">
                <Link className="btn btn-ghost" to={`/missions/${order.id}`}>
                  Détails
                </Link>
                <button
                  type="button"
                  className="btn btn-accent"
                  disabled={busyId === order.id}
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
