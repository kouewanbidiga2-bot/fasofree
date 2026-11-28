/**
 * Copyright (c) 2026 BIDIGA Imrane - Koliwa. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, LocateFixed, MapPin } from 'lucide-react';
import { formatBurkinaPhone } from '../../utils/phone';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
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
  const mapsImportRef = useRef(null);
  const [mapOpen, setMapOpen] = useState(true);
  const [choosingPoint, setChoosingPoint] = useState(false);
  const [mapsLink, setMapsLink] = useState('');
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
  const mapped = ['map', 'gps'].includes(value.locationSource);
  const storedPoint = useMemo(() => ({ lat: value.latitude, lng: value.longitude }), [value.latitude, value.longitude]);
  const anchor = previewPoint ?? storedPoint;
  const selectedPoint = manualPoint ?? (choosingPoint ? null : mapped ? storedPoint : null);
  const zoom = previewPoint?.zoom ?? (mapped ? 17 : 14);
  const mapsPoint = selectedPoint ? mapsSearchUrl(`${selectedPoint.lat},${selectedPoint.lng}`) : null;
  const mapsImport = mapsLink.trim() ? readMapLocation(mapsLink) : null;

  function cancelLocationRequest() {
    gpsRequest.current += 1;
    setLocating(false);
  }

  function clearPoint() {
    setChoosingPoint(false);
    setManualPoint(null);
  }

  function placePoint(point) {
    setChoosingPoint(false);
    setManualPoint(point);
    onUpdate('locationSource', 'approximate');
  }

  function confirmPoint() {
    if (!selectedPoint) return;
    cancelLocationRequest();
    if (!value.address.trim()) onUpdate('address', 'Point indiqué sur la carte');
    onSelectPoint(selectedPoint);
    clearPoint();
    setLocationFeedback('');
    setPreviewPoint(null);
    setMapOpen(false);
  }

  function locatePickup() {
    const request = ++gpsRequest.current;
    clearPoint();
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
      const position = { lat: coords.latitude, lng: coords.longitude };
      setPreviewPoint({ ...position, zoom: 17 });
      setManualPoint(position);
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
    clearPoint();
    if (location.name) onUpdate('address', location.name);
    onUpdate('locationSource', 'approximate');
    setPreviewPoint({ ...location.point, zoom: location.zoom ?? 18 });
    if (!location.overview) setManualPoint(location.point);
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
              clearPoint();
              setPreviewPoint(null);
              setLocationFeedback('');
              setMapOpen(false);
              cancelLocationRequest();
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
        <label htmlFor={`${id}-address`}>
          <span>{isMerchantPickup ? 'Nom et adresse du commerce' : 'Adresse à transmettre au livreur'}</span>
          <input
            id={`${id}-address`}
            className="app-input"
            required
            autoComplete="off"
            value={value.address}
            placeholder={isMerchantPickup ? 'Ex. Boutique Wend Raabo, Patte d’Oie' : 'Ex. Rue de la Science, Zogona'}
            onPaste={pasteMapLocation}
            onChange={(event) => onUpdate('address', event.target.value)}
          />
        </label>

        <div className="p2p-map-options">
          <button type="button" className="app-action-secondary" aria-expanded={mapOpen} onClick={() => {
            cancelLocationRequest();
            if (mapOpen) setLocationFeedback('');
            setMapOpen(!mapOpen);
          }}>
            <MapPin size={16} aria-hidden="true" /> {mapOpen ? 'Fermer la carte' : mapped ? 'Revoir dans Google Maps' : 'Choisir dans Google Maps'}
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
          <section className="p2p-map-picker" aria-label="Choisir le point exact">
            <DeliveryMap
              anchor={anchor} zoom={zoom} point={selectedPoint}
              title={title} label={value.address} mapsUrl={mapsPoint}
              instruction={selectedPoint
                ? 'Touchez la carte pour déplacer le repère, puis confirmez.'
                : 'Touchez l’entrée sur la carte ou placez le repère au centre.'}
              onSearch={() => { setManualPoint(null); setChoosingPoint(true); }}
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
        <p className="text-xs text-text-muted">Indiquez la personne joignable sur place à l’arrivée du livreur.</p>
        {mapped && <p className="p2p-position-label" role="status">{value.locationSource === 'gps' ? 'Position détectée. Vérifiez l’entrée sur la carte.' : 'Point confirmé. Ajoutez un repère pour aider le coursier.'}</p>}
      </div>
    </section>
    </>
  );
}
