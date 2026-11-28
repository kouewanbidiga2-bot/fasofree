import { useEffect, useMemo, useRef, useState } from 'react';
import { LocateFixed, Map, Maximize2, Minus, Plus } from 'lucide-react';
import { fetchCourierRoute } from '../services/courier';
import { hasGoogleMapsKey, loadGoogleMaps } from '../services/googleMaps';

const CITY = { lat: 12.3714, lng: -1.5197 };

function fitPositions(map, maps, positions, zoom = 16) {
  if (!positions.length) return;
  const bounds = new maps.LatLngBounds();
  positions.forEach(point => bounds.extend(point));
  if (bounds.getNorthEast().equals(bounds.getSouthWest())) {
    map.setCenter(bounds.getCenter());
    map.setZoom(zoom);
  } else map.fitBounds(bounds, 44);
}

function movedEnough(previous, current) {
  const latitude = (current.latitude - previous.latitude) * 111_000;
  const longitude = (current.longitude - previous.longitude) * 111_000 * Math.cos(current.latitude * Math.PI / 180);
  return Math.hypot(latitude, longitude) >= 55;
}

export function locationPoint(location) {
  if (location?.latitude == null || location?.longitude == null) return null;
  const lat = Number(location.latitude);
  const lng = Number(location.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 85 || Math.abs(lng) > 180
      || (lat === CITY.lat && lng === CITY.lng)) return null;
  return { lat, lng };
}

export function navigationUrl(location) {
  const point = locationPoint(location);
  if (!point) return null;
  const params = new URLSearchParams({ api: '1', destination: `${point.lat},${point.lng}`, travelmode: 'driving', dir_action: 'navigate' });
  return `https://www.google.com/maps/dir/?${params}`;
}

export default function MissionMap({ orderId, pickup, destination, coords, toDestination, active, eta }) {
  const targetRef = useRef(null);
  const latest = useRef(coords);
  const [instance, setInstance] = useState(null);
  const [route, setRoute] = useState(null);
  const [mapIssue, setMapIssue] = useState(false);
  const [geoIssue, setGeoIssue] = useState(false);
  const [localPosition, setLocalPosition] = useState(null);
  const [follow, setFollow] = useState(false);
  latest.current = coords;
  const driver = locationPoint(coords) ?? localPosition;

  const pickupLat = pickup?.latitude;
  const pickupLng = pickup?.longitude;
  const destinationLat = destination?.latitude;
  const destinationLng = destination?.longitude;
  const stops = useMemo(() => [
    locationPoint({ latitude: pickupLat, longitude: pickupLng }),
    locationPoint({ latitude: destinationLat, longitude: destinationLng }),
  ], [pickupLat, pickupLng, destinationLat, destinationLng]);
  const nextStop = stops[toDestination ? 1 : 0];
  const hasPosition = Boolean(coords);
  const mapLabel = orderId ? 'Carte interactive de la course' : 'Carte de Ouagadougou';

  useEffect(() => {
    if (!hasGoogleMapsKey) return;
    let current = true;
    let drag;
    const fail = () => { if (current) setMapIssue(true); };
    window.addEventListener('koliwa-maps-auth-failure', fail);
    loadGoogleMaps().then(async (maps) => {
      const [{ Map, Circle, Polyline }, { Marker }] = await Promise.all([
        maps.importLibrary('maps'), maps.importLibrary('marker'),
      ]);
      if (!current) return;
      const map = new Map(targetRef.current, {
        center: CITY, zoom: 13, gestureHandling: 'greedy', zoomControl: false,
        streetViewControl: false, mapTypeControl: false, fullscreenControl: false,
        clickableIcons: false,
      });
      drag = map.addListener('dragstart', () => setFollow(false));
      setInstance({ map, maps, Circle, Marker, Polyline });
    }).catch(fail);
    return () => {
      current = false;
      drag?.remove();
      window.removeEventListener('koliwa-maps-auth-failure', fail);
    };
  }, []);

  useEffect(() => {
    if (!instance) return;
    const { map, maps, Marker } = instance;
    const markers = stops.flatMap((position, index) => position ? [new Marker({
      position, map, label: index ? 'B' : 'A', title: index ? 'Remise' : 'Retrait', clickable: false,
    })] : []);
    fitPositions(map, maps, stops.filter(Boolean));
    return () => markers.forEach(marker => marker.setMap(null));
  }, [instance, stops]);

  useEffect(() => {
    if (!instance || !driver) return;
    const { map, maps, Marker, Circle } = instance;
    const marker = new Marker({
      map, position: driver, title: 'Votre position', clickable: false,
      icon: { path: maps.SymbolPath.CIRCLE, scale: 8, fillColor: '#29465b', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 },
    });
    const accuracy = coords?.accuracy;
    const circle = Number.isFinite(accuracy) && accuracy <= 150 ? new Circle({
      map, center: driver, radius: accuracy, fillColor: '#29465b', fillOpacity: 0.14, strokeWeight: 1, clickable: false,
    }) : null;
    if (follow) map.panTo(driver);
    return () => { marker.setMap(null); circle?.setMap(null); };
  }, [instance, driver?.lat, driver?.lng, coords?.accuracy, follow]);

  useEffect(() => {
    setRoute(undefined);
    if (!active || !hasPosition || !nextStop) return;
    let controller;
    let lastPoint;
    let lastRoute;
    const refresh = async () => {
      const point = latest.current;
      if (!point || Date.now() - point.observedAt > 30_000) return;
      if (lastRoute && lastPoint && !movedEnough(lastPoint, point)) return;
      controller?.abort();
      controller = new AbortController();
      const { signal } = controller;
      try {
        const result = await fetchCourierRoute(orderId, point, signal);
        if (signal.aborted) return;
        lastPoint = point;
        lastRoute = result;
        setRoute(result || null);
      } catch {
        if (!signal.aborted) setRoute(null);
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, 45_000);
    return () => { controller?.abort(); window.clearInterval(timer); };
  }, [orderId, active, hasPosition, nextStop]);

  useEffect(() => {
    if (!instance || !route?.points?.length) return;
    const line = new instance.Polyline({
      map: instance.map, path: route.points.map(([lat, lng]) => ({ lat, lng })),
      strokeColor: '#29465b', strokeWeight: 6, clickable: false,
    });
    return () => line.setMap(null);
  }, [instance, route]);

  const fitAll = () => {
    if (!instance) return;
    const points = [...stops.filter(Boolean), ...(route?.points ?? []).map(([lat, lng]) => ({ lat, lng }))];
    if (driver) points.push(driver);
    setFollow(false);
    fitPositions(instance.map, instance.maps, points, 17);
  };

  const center = () => {
    if (!instance) return;
    const { map } = instance;
    if (driver) {
      setFollow(Boolean(coords));
      map.setCenter(driver);
      map.setZoom(Math.max(map.getZoom(), 16));
    } else if (nextStop) {
      map.setCenter(nextStop);
      map.setZoom(16);
    } else if (!orderId && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(({ coords: position }) => {
        const point = locationPoint(position);
        if (!point) return;
        setGeoIssue(false);
        setLocalPosition(point);
        map.setCenter(point);
        map.setZoom(16);
      }, () => setGeoIssue(true), { timeout: 8000, maximumAge: 10_000 });
    } else setGeoIssue(true);
  };

  const mapReady = Boolean(instance) && !mapIssue;
  return (
    <div className="mission-map">
      <div ref={targetRef} className="mission-map-canvas" aria-label={mapLabel} />
      <div className="mission-map-controls" role="group" aria-label="Commandes de la carte">
        <button type="button" disabled={!mapReady} onClick={() => instance.map.setZoom(instance.map.getZoom() + 1)} aria-label="Zoom avant"><Plus size={20} /></button>
        <button type="button" disabled={!mapReady} onClick={() => instance.map.setZoom(instance.map.getZoom() - 1)} aria-label="Zoom arrière"><Minus size={20} /></button>
        <button type="button" onClick={center} disabled={!mapReady || (Boolean(orderId) && !driver && !nextStop)} aria-label={orderId ? 'Recentrer la carte' : 'Voir ma position'}><LocateFixed size={20} /></button>
        <button type="button" onClick={fitAll} disabled={!mapReady || (!driver && !stops.some(Boolean))} aria-label="Voir tous les repères"><Maximize2 size={19} /></button>
      </div>
      <div className="mission-map-caption" role="status">
        <Map size={15} aria-hidden="true" />
        {geoIssue ? 'Vérifiez l’autorisation de localisation' : !hasGoogleMapsKey ? 'Google Maps en cours de configuration' : mapIssue ? 'Google Maps indisponible' : !mapReady ? 'Chargement de Google Maps…' : eta
          ? `${eta.stop === 'pickup' ? 'Retrait' : 'Remise'} · ${eta.source === 'approximate' ? 'env. ' : ''}${eta.totalMinutes} min`
          : active && !hasPosition ? 'En attente du GPS' : orderId ? 'A · Retrait   B · Remise' : 'Ouagadougou'}
      </div>
    </div>
  );
}
