import { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps, hasGoogleMapsKey } from '../services/googleMaps';

const CITY = { lat: 12.3714, lng: -1.5197 };

export function mapPosition(value) {
  const lat = value?.lat ?? value?.latitude ?? value?.[0];
  const lng = value?.lng ?? value?.longitude ?? value?.[1];
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 85 && Math.abs(lng) <= 180
    ? { lat, lng } : null;
}

export default function GoogleMapCanvas({
  center, zoom = 13, className, pins = [], path = [], fitKey, onPick, onReady, children,
}) {
  const container = useRef(null);
  const onPickRef = useRef(onPick);
  const onReadyRef = useRef(onReady);
  onPickRef.current = onPick;
  onReadyRef.current = onReady;
  const [instance, setInstance] = useState(null);
  const [error, setError] = useState(false);
  const initial = useRef(mapPosition(center) ?? CITY);
  const lastFit = useRef(null);
  const lat = mapPosition(center)?.lat;
  const lng = mapPosition(center)?.lng;

  useEffect(() => {
    if (!hasGoogleMapsKey) return;
    let active = true;
    let dispose;
    const fail = () => { if (active) setError(true); };
    window.addEventListener('koliwa-maps-auth-failure', fail);
    loadGoogleMaps().then(async (maps) => {
      const [{ Map, Polyline }, { Marker }] = await Promise.all([
        maps.importLibrary('maps'), maps.importLibrary('marker'),
      ]);
      if (!active) return;
      const map = new Map(container.current, {
        center: initial.current, zoom: 13, gestureHandling: 'cooperative',
        streetViewControl: false, mapTypeControl: false, fullscreenControl: false,
        clickableIcons: false,
      });
      const click = map.addListener('click', ({ latLng }) => {
        if (latLng) onPickRef.current?.(latLng.toJSON());
      });
      dispose = () => {
        click.remove();
        onReadyRef.current?.(null);
      };
      setInstance({ map, maps, Marker, Polyline });
      onReadyRef.current?.(map);
    }).catch(fail);
    return () => {
      active = false;
      window.removeEventListener('koliwa-maps-auth-failure', fail);
      dispose?.();
    };
  }, []);

  useEffect(() => {
    if (instance && lat != null && lng != null) {
      instance.map.setCenter({ lat, lng });
      instance.map.setZoom(zoom);
    }
  }, [instance, lat, lng, zoom]);

  useEffect(() => {
    if (!instance) return;
    const { map, maps, Marker } = instance;
    const markers = pins.flatMap(({ position, label, title, onClick }) => {
      const location = mapPosition(position);
      if (!location) return [];
      const marker = new Marker({
        map, position: location, title, label, clickable: Boolean(onClick),
        icon: {
          path: maps.SymbolPath.CIRCLE, scale: 13, fillColor: '#d1ee62',
          fillOpacity: 1, strokeColor: '#293322', strokeWeight: 2,
        },
      });
      const click = onClick && marker.addListener('click', onClick);
      return [{ marker, click, location }];
    });
    if (fitKey && lastFit.current !== fitKey && markers.length) {
      lastFit.current = fitKey;
      if (markers.length === 1) {
        map.setCenter(markers[0].location);
        map.setZoom(15);
      } else {
        const bounds = new maps.LatLngBounds();
        for (const entry of markers) bounds.extend(entry.location);
        if (bounds.getNorthEast().equals(bounds.getSouthWest())) {
          map.setCenter(bounds.getCenter());
          map.setZoom(15);
        } else map.fitBounds(bounds, 45);
      }
    }
    return () => markers.forEach(({ marker, click }) => {
      click?.remove();
      marker.setMap(null);
    });
  }, [instance, pins, fitKey]);

  useEffect(() => {
    if (!instance || path.length < 2) return;
    const points = path.map(mapPosition).filter(Boolean);
    const line = new instance.Polyline({
      map: instance.map, path: points, strokeColor: '#526c25', strokeWeight: 4, clickable: false,
    });
    return () => line.setMap(null);
  }, [instance, path]);

  const message = !hasGoogleMapsKey ? 'La carte Google Maps est en cours de configuration.'
    : error ? 'Google Maps est momentanément indisponible.' : !instance ? 'Chargement de la carte…' : '';
  return (
    <div className={[`google-map-canvas`, className].filter(Boolean).join(' ')}>
      <div ref={container} style={{ width: '100%', height: '100%' }} />
      {message && <div className="tracking-feedback" role="status" style={{ position: 'absolute', inset: 0 }}>{message}</div>}
      {!message && children}
    </div>
  );
}
