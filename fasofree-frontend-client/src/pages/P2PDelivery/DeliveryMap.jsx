import { useId, useRef, useState } from 'react';
import { ArrowUpRight, Crosshair, LocateFixed, Maximize, Minimize } from 'lucide-react';
import GoogleMapCanvas from '../../components/GoogleMapCanvas';
import GooglePlacePicker from './GooglePlacePicker';

export default function DeliveryMap({
  anchor, zoom, point, label, title, instruction, mapsUrl, onSearch, onPick, onConfirm,
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
    const center = map.getCenter();
    if (center) onPick(center.toJSON());
  }

  function recenter() {
    if (!map) return;
    const target = point ?? anchor;
    map.setCenter(target);
    map.setZoom(Math.max(zoom, map.getZoom()));
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
      <GooglePlacePicker map={map} onSearch={onSearch} />
      <div className="p2p-map-frame">
        <GoogleMapCanvas
          className="p2p-map-canvas" center={anchor} zoom={zoom} onPick={onPick} onReady={setMap}
          pins={point ? [{ position: point, title: 'Entrée sélectionnée', label: 'E' }] : []}
        />
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
          <button type="button" className="app-action-secondary" disabled={!map} onClick={chooseCenter}>
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
