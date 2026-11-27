import { useEffect, useMemo, useRef, useState } from 'react';
import { LocateFixed, Map, Maximize2, Minus, Plus } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { fetchCourierRoute } from '../services/courier';

const CITY = [12.3714, -1.5197];
const tiles = import.meta.env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

export function locationPoint(location) {
  if (location?.latitude == null || location?.longitude == null) return null;
  const lat = Number(location.latitude);
  const lng = Number(location.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 85 || Math.abs(lng) > 180
      || (lat === CITY[0] && lng === CITY[1])) return null;
  return [lat, lng];
}

export function navigationUrl(location) {
  const point = locationPoint(location);
  if (!point) return null;
  const params = new URLSearchParams({ api: '1', destination: point.join(','), travelmode: 'driving', dir_action: 'navigate' });
  return `https://www.google.com/maps/dir/?${params}`;
}

const pin = (kind, label) => L.divIcon({
  className: `mission-marker mission-marker--${kind}`,
  html: label,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

export default function MissionMap({ orderId, pickup, destination, coords, toDestination, active }) {
  const targetRef = useRef(null);
  const mapRef = useRef(null);
  const pins = useRef(null);
  const latest = useRef(coords);
  const [route, setRoute] = useState(undefined);
  const [tileIssue, setTileIssue] = useState(false);
  const [follow, setFollow] = useState(false);
  latest.current = coords;

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

  useEffect(() => {
    const map = L.map(targetRef.current, { zoomControl: false, scrollWheelZoom: false, maxZoom: 20 }).setView(CITY, 13);
    mapRef.current = map;
    const tileLayer = L.tileLayer(tiles, { maxNativeZoom: 19, attribution });
    tileLayer.on('tileerror', () => setTileIssue(true));
    tileLayer.on('load', () => {
      if (targetRef.current?.querySelector('.leaflet-tile-loaded')) setTileIssue(false);
    });
    tileLayer.addTo(map);
    const stopLayer = L.layerGroup().addTo(map);
    const driverLayer = L.layerGroup().addTo(map);
    const routeLayer = L.polyline([], { color: '#29465b', weight: 6, opacity: 0.92, interactive: false }).addTo(map);
    pins.current = { stopLayer, driverLayer, routeLayer };
    map.on('dragstart', () => setFollow(false));
    return () => {
      map.remove();
      mapRef.current = null;
      pins.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const { stopLayer } = pins.current;
    stopLayer.clearLayers();
    const labels = ['Retrait', 'Remise'];
    stops.forEach((point, index) => {
      if (!point) return;
      L.marker(point, { icon: pin(index ? 'destination' : 'pickup', index ? 'B' : 'A'), title: labels[index], alt: labels[index] })
        .bindTooltip(labels[index]).addTo(stopLayer);
    });
    const points = stops.filter(Boolean);
    if (points.length > 1) map.fitBounds(points, { padding: [35, 38], maxZoom: 16, animate: false });
    else if (points[0]) map.setView(points[0], 16, { animate: false });
  }, [stops]);

  useEffect(() => {
    const { driverLayer } = pins.current;
    driverLayer.clearLayers();
    if (!coords) return;
    const point = [coords.latitude, coords.longitude];
    if (Number.isFinite(coords.accuracy) && coords.accuracy <= 150) {
      L.circle(point, { radius: coords.accuracy, color: '#29465b', fillOpacity: 0.14, weight: 1, interactive: false })
        .addTo(driverLayer);
    }
    L.marker(point, { icon: pin('gps', '●'), title: 'Votre position', alt: 'Votre position' }).addTo(driverLayer);
    if (follow) mapRef.current.panTo(point, { animate: false });
  }, [coords, follow]);

  useEffect(() => {
    setRoute(undefined);
    if (!active || !hasPosition || !nextStop) return;
    let controller;
    let lastPoint;
    let lastRoute;
    const refresh = async () => {
      const point = latest.current;
      if (!point || Date.now() - point.observedAt > 30_000) return;
      if (lastRoute && lastPoint && L.latLng(lastPoint.latitude, lastPoint.longitude).distanceTo([point.latitude, point.longitude]) < 55) return;
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
    pins.current.routeLayer.setLatLngs(route?.points ?? []);
  }, [route]);

  const fitAll = () => {
    const points = [...stops.filter(Boolean), ...(route?.points ?? [])];
    if (coords) points.push([coords.latitude, coords.longitude]);
    if (!points.length) return;
    setFollow(false);
    mapRef.current?.fitBounds(points, { padding: [42, 44], maxZoom: 17, animate: false });
  };

  const center = () => {
    const map = mapRef.current;
    if (coords) {
      setFollow(true);
      map.setView([coords.latitude, coords.longitude], Math.max(map.getZoom(), 16), { animate: false });
    } else if (nextStop) {
      map.setView(nextStop, 16, { animate: false });
    }
  };

  return (
    <div className="mission-map">
      <div ref={targetRef} className="mission-map-canvas" aria-label="Carte interactive de la course" />
      <div className="mission-map-controls" role="group" aria-label="Commandes de la carte">
        <button type="button" onClick={() => mapRef.current?.zoomIn()} aria-label="Zoom avant"><Plus size={20} /></button>
        <button type="button" onClick={() => mapRef.current?.zoomOut()} aria-label="Zoom arrière"><Minus size={20} /></button>
        <button type="button" onClick={center} disabled={!coords && !nextStop} aria-label="Recentrer la carte"><LocateFixed size={20} /></button>
        <button type="button" onClick={fitAll} disabled={!coords && !stops.some(Boolean)} aria-label="Voir tous les repères"><Maximize2 size={19} /></button>
      </div>
      <div className="mission-map-caption" role="status">
        <Map size={15} aria-hidden="true" />
        {tileIssue ? 'Fond de carte indisponible' : route
          ? `${(route.distanceMeters / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km · env. ${Math.max(1, Math.round(route.durationSeconds / 60))} min`
          : active && !hasPosition ? 'En attente du GPS' : 'A · Retrait   B · Remise'}
      </div>
    </div>
  );
}
