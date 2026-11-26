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
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, RefreshCw, ArrowRight, Timer } from 'lucide-react';
import Shell from '../components/Shell';
import { Loading, Empty, ErrorNote, StatusPill, formatFcfa } from '../components/ui';
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

const AddressLine = ({ location, fallback }) => (
  <div className="row" style={{ alignItems: 'flex-start', gap: 8 }}>
    <MapPin size={16} style={{ marginTop: 2, flex: 'none', color: 'var(--ink-soft)' }} />
    <span className="muted" style={{ margin: 0 }}>{location?.address || fallback}</span>
  </div>
);

const Missions = () => {
  const user = useAuthStore((s) => s.user);
  const [online, setOnline] = useState(false);
  const [active, setActive] = useState([]);
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
      const mine = await fetchMyOrders();
      if (!mounted.current) return;
      const rows = Array.isArray(mine) ? mine : [];
      setActive(rows.filter((o) => ACTIVE_STATUSES.includes(o.status)));

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
          onClick={toggleOnline}
          className={online ? 'btn btn-accent' : 'btn'}
          style={{ minHeight: 40, padding: '8px 14px', fontSize: 13, borderRadius: 999 }}
        >
          {online ? 'En ligne' : 'Hors ligne'}
        </button>
      }
    >
      <div className="card" style={{ gap: 8 }}>
        <div className="row">
          <div className="stack">
            <span className="strong">{user?.fullName || 'Coursier'}</span>
            <span className="muted">{online ? 'Vous recevez les courses' : 'Passez en ligne pour recevoir des courses'}</span>
          </div>
          <StatusPill tone={online ? 'ok' : 'warn'}>{online ? 'En ligne' : 'Hors ligne'}</StatusPill>
        </div>
        {geoError ? <div className="note note-warn">{geoError}</div> : null}
      </div>

      <ErrorNote>{error}</ErrorNote>

      <div className="row">
        <p className="section-title" style={{ margin: 0 }}>Ma course</p>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => load({ silent: true })}
          style={{ minHeight: 34, padding: '4px 8px', fontSize: 12, border: 0 }}
        >
          <RefreshCw size={14} /> Rafraîchir
        </button>
      </div>

      {loading && active.length === 0 ? (
        <Loading />
      ) : active.length === 0 ? (
        <div className="card"><p className="muted" style={{ margin: 0 }}>Aucune course en cours.</p></div>
      ) : (
        active.map((order) => {
          const money = earningOf(order);
          return (
            <Link key={order.id} to={`/missions/${order.id}`} className="card card-link">
              <div className="row">
                <StatusPill tone={order.status === 'DELIVERED_PENDING_CONFIRMATION' ? 'warn' : 'ok'}>
                  {statusLabel(order.status)}
                </StatusPill>
                <span className="pill">{money.net ? formatFcfa(money.net) : 'À livrer'}</span>
              </div>
              <AddressLine location={order.pickupLocation} fallback="Point de retrait à confirmer" />
              <AddressLine location={order.dropoffLocation} fallback="Point de livraison à confirmer" />
              <div className="row">
                <span className="muted">{order.trackingReference || order.id.slice(0, 8)}</span>
                <span className="strong" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  Ouvrir <ArrowRight size={16} />
                </span>
              </div>
            </Link>
          );
        })
      )}

      <p className="section-title">Courses disponibles</p>

      {!online ? (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            Passez en ligne pour voir les courses autour de vous.
          </p>
        </div>
      ) : available.length === 0 && !loading ? (
        <Empty title="Aucune course pour le moment" hint="Nous vous prévenons dès qu'une course est publiée." />
      ) : (
        available.map((order) => {
          const money = earningOf(order);
          return (
            <div key={order.id} className="card">
              <div className="row">
                <StatusPill tone="ok">{statusLabel(order.status)}</StatusPill>
                <span className="amount">
                  {formatFcfa(money.net)} <small>net</small>
                </span>
              </div>
              <AddressLine location={order.pickupLocation} fallback="Retrait" />
              <AddressLine location={order.dropoffLocation} fallback="Livraison" />
              {order.distanceKm ? (
                <span className="pill"><Timer size={13} /> {order.distanceKm} km</span>
              ) : null}
              <div className="btn-row">
                <Link className="btn btn-ghost" to={`/missions/${order.id}`} style={{ textAlign: 'center' }}>
                  Détails
                </Link>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busyId === order.id}
                  onClick={() => onAccept(order.id)}
                >
                  {busyId === order.id ? 'Acceptation…' : 'Accepter'}
                </button>
              </div>
            </div>
          );
        })
      )}
    </Shell>
  );
};

export default Missions;
