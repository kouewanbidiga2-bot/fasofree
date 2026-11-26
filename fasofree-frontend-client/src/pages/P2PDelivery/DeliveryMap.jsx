import { useEffect, useId, useRef, useState } from 'react';
import { ArrowUpRight, Crosshair, LocateFixed, Maximize, Minimize } from 'lucide-react';
import L from 'leaflet';
import { CircleMarker, MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const selectedPin = L.divIcon({
  className: 'p2p-selected-pin',
  html: '<span aria-hidden="true"></span>',
  iconSize: [32, 38],
  iconAnchor: [16, 38],
});

function MapInteraction({ anchor, zoom, expanded, onPick }) {
  const map = useMap();
  useMapEvents({ click: event => onPick(event.latlng.wrap()) });

  useEffect(() => {
    map.setView([anchor.lat, anchor.lng], zoom, { animate: false });
  }, [anchor, zoom, map]);

  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize({ animate: false, debounceMoveend: true }));
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);

  useEffect(() => {
    if (expanded) map.scrollWheelZoom.enable();
    else map.scrollWheelZoom.disable();
    return () => map.scrollWheelZoom.disable();
  }, [map, expanded]);

  return null;
}

export default function DeliveryMap({
  anchor, zoom, point, label, title, instruction, mapsUrl, showArea, gates, gateChoice, onGate, onManual, onPick, onConfirm,
}) {
  const heading = useId();
  const mapDialog = useRef(null);
  const expandButton = useRef(null);
  const [map, setMap] = useState(null);
  const [expanded, setExpanded] = useState(false);

  function toggleExpanded() {
    const dialog = mapDialog.current;
    if (!dialog) return;
    dialog.close();
    if (expanded) dialog.show();
    else dialog.showModal();
    setExpanded(!expanded);
    expandButton.current?.focus({ preventScroll: true });
  }

  function chooseCenter() {
    if (!map) return;
    map.stop();
    onPick(map.getCenter().wrap());
  }

  function recenter() {
    if (!map) return;
    const target = point ?? anchor;
    map.setView([target.lat, target.lng], Math.max(zoom, map.getZoom()), { animate: false });
  }

  return (
    <dialog ref={mapDialog} open className="p2p-map-dialog" aria-labelledby={heading} onCancel={event => {
      event.preventDefault();
      if (expanded) toggleExpanded();
    }}>
      <header className="p2p-map-heading">
        <div>
          <h3 id={heading}>{title}</h3>
          {label && <p>{label}</p>}
        </div>
        <button type="button" ref={expandButton} onClick={toggleExpanded} className="p2p-map-expand"
          aria-label={expanded ? 'Réduire la carte' : 'Agrandir la carte'} aria-pressed={expanded}>
          {expanded ? <Minimize size={19} aria-hidden="true" /> : <Maximize size={19} aria-hidden="true" />}
        </button>
      </header>
      {gates.length > 0 && (
        <div className="p2p-gate-picker">
          <strong>{gates.length > 1 ? 'Quel portail doit utiliser le livreur ?' : 'Portail disponible'}</strong>
          <div role="group" aria-label="Portails du lieu">
            {gates.map(gate => (
              <button key={gate.id} type="button" aria-pressed={gateChoice === gate.id} onClick={() => onGate(gate)}>
                {gate.name}
              </button>
            ))}
            {gates.length > 1 && (
              <button type="button" aria-pressed={gateChoice === 'place-point' || gateChoice === null} onClick={onManual}>
                Autre point
              </button>
            )}
          </div>
        </div>
      )}
      <div className="p2p-map-frame">
        <MapContainer ref={setMap} center={[anchor.lat, anchor.lng]} zoom={zoom} minZoom={6} maxZoom={21}
          className="p2p-map-canvas" touchZoom scrollWheelZoom={false} bounceAtZoomLimits={false}>
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxNativeZoom={19} maxZoom={21} />
          <MapInteraction anchor={anchor} zoom={zoom} expanded={expanded} onPick={onPick} />
          {gates.map(gate => (
            <CircleMarker key={gate.id} center={[gate.lat, gate.lng]} radius={6}
              pathOptions={{ color: '#34432b', fillColor: '#d7f36b', fillOpacity: 1, bubblingMouseEvents: false }}
              eventHandlers={{ click: () => onGate(gate) }}
            />
          ))}
          {showArea && <CircleMarker center={[anchor.lat, anchor.lng]} radius={12}
            pathOptions={{ color: '#405448', fillColor: '#d7f36b', fillOpacity: 0.48, dashArray: '3 3' }} interactive={false} />}
          {point && <Marker position={[point.lat, point.lng]} icon={selectedPin}
            alt="Point sélectionné" interactive={false} keyboard={false} />}
        </MapContainer>
        <div className="p2p-map-tools" role="group" aria-label="Commandes de la carte">
          <button type="button" onClick={recenter} disabled={!map} aria-label="Recentrer sur le lieu" title="Recentrer sur le lieu">
            <LocateFixed size={20} aria-hidden="true" />
          </button>
          {mapsUrl && (
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" aria-label="Voir le repère dans Google Maps" title="Voir le repère dans Google Maps">
              <ArrowUpRight size={20} aria-hidden="true" />
            </a>
          )}
        </div>
      </div>
      <footer className="p2p-map-dock">
        <p>{instruction}</p>
        <div className="p2p-map-actions">
          <button type="button" className="app-action-secondary" disabled={!map || gateChoice === 'choose-gate'} onClick={chooseCenter}>
            <Crosshair size={17} aria-hidden="true" /> Placer au centre
          </button>
          <button type="button" className="app-action p2p-map-confirm" disabled={!point} onClick={onConfirm}>
            Confirmer ce point
          </button>
        </div>
      </footer>
    </dialog>
  );
}
