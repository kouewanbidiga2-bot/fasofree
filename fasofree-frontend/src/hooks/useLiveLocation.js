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

    const watchId = navigator.geolocation.watchPosition(
      ({ coords: position, timestamp }) => {
        if (cancelled) return;
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
      },
      (failure) => {
        if (cancelled) return;
        latest = null;
        setError(failure.code === 1
          ? 'Autorisez la position dans les réglages du navigateur.'
          : 'La position GPS est momentanément indisponible.');
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20_000 },
    );
    const timer = window.setInterval(send, SEND_INTERVAL_MS);
    return () => {
      cancelled = true;
      navigator.geolocation.clearWatch(watchId);
      window.clearInterval(timer);
    };
  }, [enabled, orderId]);

  return { coords, error, sharedAt, sharingUnavailable };
}
