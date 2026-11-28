import { useEffect, useState } from 'react';
import { reportCourierLocation } from '../services/courier';
import { emitLocation } from '../services/realtime';

const SEND_INTERVAL_MS = 10_000;

export default function useLiveLocation({ orderId, enabled = true } = {}) {
  const [coords, setCoords] = useState(null);
  const [error, setError] = useState(null);
  const [sharedAt, setSharedAt] = useState(null);
  const [sharingUnavailable, setSharingUnavailable] = useState(false);

  useEffect(() => {
    setCoords(null);
    setError(null);
    setSharedAt(null);
    setSharingUnavailable(false);
    if (!enabled) return;
    if (!navigator.geolocation) {
      setError('Géolocalisation non disponible sur cet appareil.');
      return;
    }

    let latest = null;
    let sentAt = 0;
    let inFlight = false;
    let cancelled = false;
    let refreshing = false;
    let permissionDenied = false;

    async function send() {
      if (cancelled || inFlight || !latest || Date.now() - latest.observedAt > 30_000
        || Date.now() - sentAt < SEND_INTERVAL_MS) return;

      inFlight = true;
      sentAt = Date.now();
      const { observedAt, ...position } = latest;
      let shared = await emitLocation({ orderId, ...position }).catch(() => false);
      if (!shared && orderId && !cancelled) {
        shared = await reportCourierLocation(orderId, position).catch(() => false);
      }
      inFlight = false;
      if (cancelled) return;
      setSharingUnavailable(!shared);
      if (shared) setSharedAt(Date.now());
    }

    const options = { enableHighAccuracy: true, maximumAge: 5000, timeout: 20_000 };
    const onPosition = ({ coords: position, timestamp }) => {
      if (cancelled || (latest && latest.observedAt > timestamp)) return;
      permissionDenied = false;
      latest = {
        latitude: position.latitude,
        longitude: position.longitude,
        accuracy: position.accuracy,
        heading: position.heading ?? undefined,
        observedAt: timestamp,
      };
      setCoords(latest);
      setError(null);
      void send();
    };
    const onFailure = (failure) => {
      if (cancelled) return;
      permissionDenied = failure.code === 1;
      if (permissionDenied || !latest || Date.now() - latest.observedAt > 30_000) {
        latest = null;
        setCoords(null);
        setError(permissionDenied
          ? 'Autorisez la position dans les réglages du navigateur.'
          : 'La position GPS est momentanément indisponible.');
      }
    };
    const watchId = navigator.geolocation.watchPosition(onPosition, onFailure, options);
    const refresh = () => {
      if (cancelled || document.visibilityState === 'hidden') return;
      void send();
      // Certains mobiles ne rappellent pas watchPosition lors d’un arrêt.
      if (refreshing || permissionDenied || (latest && Date.now() - latest.observedAt <= 20_000)) return;
      refreshing = true;
      navigator.geolocation.getCurrentPosition(
        position => { refreshing = false; onPosition(position); },
        failure => { refreshing = false; onFailure(failure); },
        options,
      );
    };
    const timer = window.setInterval(refresh, SEND_INTERVAL_MS);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      cancelled = true;
      navigator.geolocation.clearWatch(watchId);
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [enabled, orderId]);

  return { coords, error, sharedAt, sharingUnavailable };
}
