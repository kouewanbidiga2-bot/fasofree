/**
 * Copyright (c) 2026 BIDIGA Imrane - Koliwa. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

/**
 * Koliwa Coursier — position GPS du livreur.
 *
 * `watchPosition` remonte la position en continu, mais on ne l'envoie au
 * serveur qu'une fois toutes les 10 s : au-delà, on sature le socket et la
 * batterie pour un déplacement que la carte n'affiche même pas.
 */
import { useEffect, useRef, useState } from 'react';
import { emitLocation } from '../services/realtime';

const SEND_INTERVAL_MS = 10000;

export const useLiveLocation = ({ orderId, enabled = true } = {}) => {
  const [coords, setCoords] = useState(null);
  const [error, setError] = useState(null);
  const lastSentAt = useRef(0);

  useEffect(() => {
    if (!enabled || !('geolocation' in navigator)) {
      if (!('geolocation' in navigator)) setError('Géolocalisation non disponible sur cet appareil.');
      return undefined;
    }

    let cancelled = false;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (cancelled) return;
        const next = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          heading: position.coords.heading ?? undefined,
        };
        setCoords(next);
        setError(null);

        const now = Date.now();
        if (now - lastSentAt.current >= SEND_INTERVAL_MS) {
          const sent = emitLocation({ orderId, ...next });
          if (sent) lastSentAt.current = now;
        }
      },
      (err) => {
        if (cancelled) return;
        setError(
          err.code === err.PERMISSION_DENIED
            ? 'Autorisez la localisation pour recevoir des courses.'
            : 'Position indisponible pour le moment.',
        );
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );

    return () => {
      cancelled = true;
      navigator.geolocation.clearWatch(watchId);
    };
  }, [enabled, orderId]);

  return { coords, error };
};

export default useLiveLocation;
