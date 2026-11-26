/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, LocateFixed, MapPin, Search } from 'lucide-react';
import { formatBurkinaPhone } from '../../utils/phone';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import { createPlaceIndex, findPlaces, placeDistance } from './placeSearch';
import DeliveryMap from './DeliveryMap';
import { mapsSearchUrl, readMapLocation } from './mapsLocation';


export default function LocationStep({
  title,
  contactLabel,
  phoneLabel,
  value,
  onUpdate,
  allowCurrentLocation = false,
  onSelectPoint,
  onSavedAddress,
  isMerchantPickup = false,
}) {
  const id = useId();
  const mapPickerRef = useRef(null);
  const mapsImportRef = useRef(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [highlightedPlace, setHighlightedPlace] = useState(-1);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [gateChoice, setGateChoice] = useState(null);

  useEffect(() => {
    if (!mapOpen) return;
    mapPickerRef.current?.focus({ preventScroll: true });
    mapPickerRef.current?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }, [mapOpen]);
  const [mapsLink, setMapsLink] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const gpsRequest = useRef(0);
  useEffect(() => () => { gpsRequest.current += 1; }, []);
  const [previewPoint, setPreviewPoint] = useState(null);
  const [manualPoint, setManualPoint] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locationFeedback, setLocationFeedback] = useState('');
  const [linkError, setLinkError] = useState('');
  const userId = useAuthStore((state) => state.isAuthenticated ? state.user?.id : null);
  const { data: savedAddresses = [] } = useQuery({
    queryKey: ['saved-delivery-addresses', userId],
    queryFn: async () => {
      const addresses = await api.getAddresses();
      return Array.isArray(addresses) ? addresses : [];
    },
    enabled: Boolean(userId),
    staleTime: 20_000,
  });
  const showPlaces = searchOpen && value.address.trim().length >= 3;
  const { data: placeDirectory, isError: placesUnavailable } = useQuery({
    queryKey: ['ouagadougou-place-index'],
    queryFn: async () => createPlaceIndex((await import('./ouagadougou-places.json')).default),
    enabled: showPlaces,
    staleTime: Infinity,
    retry: false,
  });
  const localPlaces = showPlaces && placeDirectory ? findPlaces(placeDirectory, value.address) : [];
  // Fallback OpenStreetMap (Nominatim) : compléte le répertoire local quand
  // aucun lieu n'est trouvé (certains quartiers/rues manquent dans l'extrait).
  const [osmResults, setOsmResults] = useState([]);
  const [osmLoading, setOsmLoading] = useState(false);
  useEffect(() => {
    if (!showPlaces) { setOsmResults([]); return; }
    if (localPlaces.length > 0) { setOsmResults([]); return; }
    const q = value.address.trim();
    if (q.length < 3) return;
    setOsmLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        let mapped = [];
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q + ', Burkina Faso')}&countrycodes=bf&limit=8&addressdetails=1`,
            { signal: controller.signal, headers: { 'Accept-Language': 'fr' } },
          );
          const json = await response.json();
          mapped = (Array.isArray(json) ? json : []).map((item, index) => ({
            id: `osm-${item.place_id || index}`,
            name: String(item.display_name || '').split(',')[0].trim() || 'Lieu',
            kind: 'Lieu OSM',
            lat: Number(item.lat),
            lng: Number(item.lon),
            area: String(item.display_name || '').split(',').slice(1).map((part) => part.trim()).filter(Boolean).join(', '),
            gates: [],
          })).filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng));
        } catch {
          mapped = [];
        }
        // Fallback Photon (Komoot) si Nominatim ne renvoie rien : géocoder
        // plus tolérant sur les adresses approximatives.
        if (mapped.length === 0) {
          try {
            const response = await fetch(
              `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=8&lang=fr`,
              { signal: controller.signal },
            );
            const json = await response.json();
            mapped = (Array.isArray(json?.features) ? json.features : []).map((feature, index) => ({
              id: `photon-${index}`,
              name: feature?.properties?.name || feature?.properties?.street || 'Lieu',
              kind: 'Lieu OSM',
              lat: Number(feature?.geometry?.coordinates?.[1]),
              lng: Number(feature?.geometry?.coordinates?.[0]),
              area: [feature?.properties?.city, feature?.properties?.country].filter(Boolean).join(', '),
              gates: [],
            })).filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng));
          } catch {
            mapped = [];
          }
        }
        setOsmResults(mapped);
      } catch {
        setOsmResults([]);
      } finally {
        setOsmLoading(false);
      }
    }, 450);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [showPlaces, value.address, localPlaces.length]);
  const places = localPlaces.length > 0 ? localPlaces : osmResults;
  const listOpen = showPlaces && places.length > 0;
  const activePlace = listOpen ? places[highlightedPlace] : null;
  const mapped = value.locationSource !== 'approximate';
  const gates = selectedPlace?.gates || [];
  const choosingGate = gateChoice === 'choose-gate';
  const choosingPoint = gateChoice === 'place-point';
  const storedPoint = useMemo(() => ({ lat: value.latitude, lng: value.longitude }), [value.latitude, value.longitude]);
  const anchor = previewPoint ?? storedPoint;
  const selectedPoint = manualPoint ?? (choosingGate || choosingPoint ? null : previewPoint ?? (mapped ? storedPoint : null));
  const zoom = previewPoint?.zoom ?? (mapped ? 17 : 14);
  const mapsPoint = selectedPoint ? mapsSearchUrl(`${selectedPoint.lat},${selectedPoint.lng}`) : null;
  const query = value.address.trim();
  const searchUrl = query ? mapsSearchUrl(`${query}, Burkina Faso`) : null;
  const mapsImport = mapsLink.trim() ? readMapLocation(mapsLink) : null;

  function cancelLocationRequest() {
    gpsRequest.current += 1;
    setLocating(false);
  }

  function clearPlaceSelection() {
    setSelectedPlace(null);
    setGateChoice(null);
    setManualPoint(null);
  }

  function previewPlace(place) {
    cancelLocationRequest();
    const defaultGate = place.gates?.length === 1 ? place.gates[0] : null;
    const needsGate = (place.gates?.length ?? 0) > 1;
    const isArea = place.kind === 'Rue' || place.kind === 'Quartier';
    const area = place.area || (place.nearby && `près de ${place.nearby}`);
    onUpdate('address', [place.name, area].filter(Boolean).join(', '));
    onUpdate('locationSource', 'approximate');
    setSelectedPlace(place);
    setManualPoint(null);
    setGateChoice(needsGate ? 'choose-gate' : isArea ? 'place-point' : defaultGate?.id ?? null);
    const { lat, lng } = defaultGate || place;
    setPreviewPoint({ lat, lng, zoom: place.gates?.length ? 19 : place.kind === 'Quartier' ? 15 : 17 });
    setSearchOpen(false);
    setHighlightedPlace(-1);
    setLocationFeedback('');
    setMapOpen(true);
  }

  function selectGate(gate) {
    setGateChoice(gate.id);
    setManualPoint(null);
    setPreviewPoint({ lat: gate.lat, lng: gate.lng, zoom: 19 });
  }

  function placePoint(point) {
    setGateChoice(null);
    setManualPoint(point);
    onUpdate('locationSource', 'approximate');
  }

  function confirmPoint() {
    if (!selectedPoint) return;
    cancelLocationRequest();
    const confirmedGate = gates.find(gate => placeDistance(selectedPoint, gate) <= 12);
    if (confirmedGate) onUpdate('address', `${value.address} — ${confirmedGate.name}`);
    else if (!value.address.trim()) onUpdate('address', 'Point indiqué sur la carte');
    onSelectPoint(selectedPoint);
    clearPlaceSelection();
    setLocationFeedback('');
    setPreviewPoint(null);
    setMapOpen(false);
  }

  function handleSearchKeys(event) {
    if (event.key === 'Escape') {
      setSearchOpen(false);
      setHighlightedPlace(-1);
    }
    if (!listOpen) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const next = highlightedPlace < 0
        ? event.key === 'ArrowDown' ? 0 : places.length - 1
        : Math.max(0, Math.min(places.length - 1, highlightedPlace + (event.key === 'ArrowDown' ? 1 : -1)));
      setHighlightedPlace(next);
      document.getElementById(`${id}-place-${next}`)?.scrollIntoView({ block: 'nearest' });
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (activePlace) previewPlace(activePlace);
    }
  }

  function locatePickup() {
    const request = ++gpsRequest.current;
    setSearchOpen(false);
    clearPlaceSelection();
    setPreviewPoint(null);

    function fallback(message) {
      if (request !== gpsRequest.current) return;
      setLocating(false);
      setMapOpen(true);
      setLocationFeedback(message);
    }

    if (!window.isSecureContext) {
      fallback('Le GPS est bloqué sur cette adresse HTTP. Ouvrez Koliwa en HTTPS ou placez le point sur la carte.');
      return;
    }
    const policy = document.permissionsPolicy ?? document.featurePolicy;
    if (policy?.allowsFeature('geolocation') === false) {
      fallback('Cette fenêtre bloque le GPS. Ouvrez Koliwa dans votre navigateur ou choisissez le point sur la carte.');
      return;
    }
    if (!navigator.geolocation) {
      fallback('Le GPS est indisponible sur cet appareil. Choisissez votre entrée sur la carte.');
      return;
    }

    setLocating(true);
    setLocationFeedback('');
    const showPosition = ({ coords }) => {
      if (request !== gpsRequest.current) return;
      setLocating(false);
      onUpdate('locationSource', 'approximate');
      setPreviewPoint({ lat: coords.latitude, lng: coords.longitude, zoom: 17 });
      setLocationFeedback(coords.accuracy > 75
        ? 'La position est approximative. Glissez la carte jusqu’à l’entrée exacte.'
        : 'Vérifiez que le repère pointe sur l’entrée.');
      setMapOpen(true);
    };
    function onLocationError(error, mayRetry) {
      if (request !== gpsRequest.current) return;
      if (error.code === 1) {
        fallback('Autorisez la localisation dans les réglages du site ou choisissez le point sur la carte.');
      } else if (mayRetry) {
        navigator.geolocation.getCurrentPosition(showPosition, nextError => onLocationError(nextError, false), {
          enableHighAccuracy: false, timeout: 6000, maximumAge: 60000,
        });
      } else {
        fallback('Votre appareil ne trouve pas votre position. Choisissez votre entrée sur la carte.');
      }
    }

    navigator.geolocation.getCurrentPosition(showPosition, error => onLocationError(error, true), {
      enableHighAccuracy: true, timeout: 8000, maximumAge: 0,
    });
  }


  function applyMapsLink(location = mapsImport) {
    if (!location?.point) {
      setLinkError(location?.shortUrl
        ? 'Ce lien est raccourci. Ouvrez-le, puis copiez l’URL complète ou les coordonnées du repère.'
        : 'Collez les coordonnées du repère ou un lien Google Maps qui contient une position.');
      return;
    }
    cancelLocationRequest();
    clearPlaceSelection();
    setSearchOpen(false);
    if (location.name) onUpdate('address', location.name);
    onUpdate('locationSource', 'approximate');
    setPreviewPoint({ ...location.point, zoom: location.zoom ?? 18 });
    if (location.overview) setGateChoice('place-point');
    setLocationFeedback(location.overview ? 'Le lien ouvre une vue de la carte. Touchez l’entrée pour y placer le repère.' : '');
    setLinkError('');
    setMapsLink('');
    if (mapsImportRef.current) mapsImportRef.current.open = false;
    setMapOpen(true);
  }

  function pasteMapLocation(event) {
    const pasted = event.clipboardData.getData('text');
    const location = readMapLocation(pasted);
    if (!location) return;

    event.preventDefault();
    if (location.shortUrl) {
      setMapsLink(pasted);
      setSearchOpen(false);
      setLinkError('');
      if (mapsImportRef.current) {
        mapsImportRef.current.open = true;
        mapsImportRef.current.querySelector('input')?.focus();
      }
      return;
    }
    applyMapsLink(location);
  }

  return (
    <>
    {savedAddresses.length > 0 && (
      <section className="p2p-saved" aria-label="Adresses enregistrées">
        <p>Pré-remplir depuis vos adresses</p>
        <div>
          {savedAddresses.map((address) => (
            <button type="button" key={address.id} onClick={() => {
              clearPlaceSelection();
              setPreviewPoint(null);
              setLocationFeedback('');
              setMapOpen(false);
              cancelLocationRequest();
              setSearchOpen(false);
              onSavedAddress(address);
            }}>
              <MapPin size={14} aria-hidden="true" /> {address.label || address.address}
            </button>
          ))}
        </div>
      </section>
    )}
    <section className="app-panel p2p-location p-4 sm:p-6 mb-6 fade-in" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="mb-4 text-lg font-display font-bold">{title}</h2>
      <div className="p2p-fields">
        <div className="p2p-place-search" onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setSearchOpen(false);
            setHighlightedPlace(-1);
          }
        }}>
          <label htmlFor={`${id}-address`}>
            {isMerchantPickup ? 'Nom et adresse du commerce' : 'Quartier, adresse ou lieu connu'}
          </label>
          <div className="p2p-place-input">
            <Search size={18} aria-hidden="true" />
            <input
              id={`${id}-address`}
              className="app-input"
              required
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={listOpen}
              aria-controls={listOpen ? `${id}-places` : undefined}
              aria-activedescendant={activePlace ? `${id}-place-${highlightedPlace}` : undefined}
              autoComplete="off"
              value={value.address}
              placeholder={isMerchantPickup ? 'Ex. Boutique Wend Raabo, Patte d’Oie' : 'Ex. rue de la Science, 2iE ou Zogona'}
              onPaste={pasteMapLocation}
              onChange={(event) => {
                cancelLocationRequest();
                clearPlaceSelection();
                if (mapOpen) setGateChoice('place-point');
                else setPreviewPoint(null);
                setLocationFeedback('');
                setHighlightedPlace(-1);
                setSearchOpen(true);
                onUpdate('address', event.target.value);
              }}
              onFocus={() => {
                if (!mapOpen && !mapped) setSearchOpen(true);
              }}
              onKeyDown={handleSearchKeys}
            />
          </div>
          {showPlaces && (
            <div className="p2p-place-results">
              {listOpen ? (
                <ul id={`${id}-places`} role="listbox" aria-label="Suggestions de lieux">
                  {places.map((place, index) => (
                    <li role="presentation" key={place.id}>
                      <button type="button" id={`${id}-place-${index}`} tabIndex={-1}
                        role="option" aria-selected={index === highlightedPlace}
                        onMouseDown={event => event.preventDefault()} onClick={() => previewPlace(place)}
                      >
                        <MapPin size={18} aria-hidden="true" />
                        <span>
                          <strong>{place.name}</strong>
                          <small>{[
                            place.area || place.context,
                            place.landmark ? `Repère près de ${place.landmark}` : place.kind === 'Rue' ? 'Voie' : place.kind,
                          ].filter(Boolean).join(' · ')}</small>
                        </span>
                        {place.gates?.length > 0 && <span className="p2p-place-gates">{place.gates.length} {place.gates.length > 1 ? 'portails' : 'portail'}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p role="status">
                  {placesUnavailable ? 'Le répertoire local est indisponible.' : osmLoading ? 'Recherche dans OpenStreetMap…' : placeDirectory ? 'Aucun lieu trouvé localement. Recherche étendue en cours…' : 'Recherche des lieux…'}
                </p>
              )}
              {(placeDirectory || placesUnavailable) && (
                <div className="p2p-place-links">
                  <a className="p2p-maps-search" href={searchUrl} target="_blank" rel="noopener noreferrer">
                    <ArrowUpRight size={16} aria-hidden="true" /> Chercher dans Google Maps
                  </a>
                  {listOpen && (
                    <a className="p2p-place-credit" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
                      © OpenStreetMap
                    </a>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p2p-map-options">
          <button type="button" className="app-action-secondary" aria-expanded={mapOpen} onClick={() => {
            cancelLocationRequest();
            setSearchOpen(false);
            if (mapOpen) setLocationFeedback('');
            setMapOpen(!mapOpen);
          }}>
            <MapPin size={16} aria-hidden="true" /> {mapOpen ? 'Fermer la carte' : mapped ? 'Revoir sur la carte' : 'Choisir sur la carte'}
          </button>
          {allowCurrentLocation && (
            <button type="button" className="app-action-secondary" disabled={locating} onClick={locatePickup}>
              <LocateFixed size={16} aria-hidden="true" /> {locating ? 'Recherche de votre position…' : 'Je suis sur place'}
            </button>
          )}
        </div>
        {locationFeedback && <p className="p2p-position-label" role="status">{locationFeedback}</p>}
        {!mapOpen && mapped && mapsPoint && (
          <a className="p2p-maps-search" href={mapsPoint} target="_blank" rel="noopener noreferrer">
            <ArrowUpRight size={16} aria-hidden="true" /> Voir le repère dans Google Maps
          </a>
        )}
        {mapOpen && (
          <section className="p2p-map-picker" ref={mapPickerRef} tabIndex={-1} aria-label="Choisir le point exact">
            <DeliveryMap
              anchor={anchor} zoom={zoom} point={selectedPoint}
              title={title} label={selectedPlace?.name || value.address} mapsUrl={mapsPoint}
              showArea={!selectedPoint && (selectedPlace?.kind === 'Rue' || selectedPlace?.kind === 'Quartier')}
              instruction={choosingGate
                ? 'Choisissez un portail ou touchez un point sur la carte.'
                : selectedPoint
                  ? 'Le repère reste en place pendant que vous explorez. Touchez la carte pour le déplacer.'
                  : 'Touchez l’entrée sur la carte ou déplacez la carte puis placez le repère au centre.'}
              gates={gates} gateChoice={gateChoice} onGate={selectGate}
              onManual={() => { setManualPoint(null); setGateChoice('place-point'); }}
              onPick={placePoint} onConfirm={confirmPoint}
            />
          </section>
        )}


        <details ref={mapsImportRef} className="p2p-map-link">
          <summary>Importer depuis Google Maps</summary>
          <label>
            <span>Lien Google Maps ou coordonnées</span>
            <input
              type="text"
              inputMode="url"
              className="app-input"
              value={mapsLink}
              placeholder="https://www.google.com/maps/…"
              onChange={(event) => {
                setMapsLink(event.target.value);
                setLinkError('');
              }}
            />
          </label>
          <button type="button" className="app-action-secondary" disabled={!mapsLink.trim()} onClick={() => applyMapsLink()}>
            Afficher le lieu sur la carte
          </button>
          {linkError && <p className="p2p-position-label" role="alert">{linkError}</p>}
          {mapsImport?.shortUrl && (
            <a className="p2p-maps-search" href={mapsImport.shortUrl} target="_blank" rel="noopener noreferrer">
              <ArrowUpRight size={16} aria-hidden="true" /> Ouvrir le lien court
            </a>
          )}
        </details>
        <label>
          <span>{isMerchantPickup ? 'Repère de récupération' : 'Repère ou instructions (facultatif)'}</span>
          <input
            required={isMerchantPickup}
            className="app-input"
            value={value.instructions}
            onChange={(event) => onUpdate('instructions', event.target.value)}
            placeholder={isMerchantPickup ? 'Ex. À côté de la station, entrée côté cour' : 'Ex. En face de la pharmacie'}
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span>{contactLabel}</span>
            <input required className="app-input" value={value.contactName} onChange={(event) => onUpdate('contactName', event.target.value)} autoComplete="off" />
          </label>
          <label>
            <span>{phoneLabel}</span>
            <input
              type="tel"
              required
              className="app-input"
              placeholder="66 10 10 01"
              value={value.contactPhone}
              onChange={(event) => onUpdate('contactPhone', event.target.value)}
              onBlur={(event) => {
                const normalized = formatBurkinaPhone(event.target.value);
                if (normalized) onUpdate('contactPhone', normalized);
              }}
              maxLength={14}
            />
          </label>
        </div>
        {mapped && <p className="p2p-position-label" role="status">{value.locationSource === 'gps' ? 'Position détectée. Vérifiez l’entrée sur la carte.' : 'Point confirmé. Ajoutez un repère pour aider le coursier.'}</p>}
      </div>
    </section>
    </>
  );
}
