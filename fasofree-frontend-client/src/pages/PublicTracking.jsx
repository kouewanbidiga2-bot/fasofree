/**
 * Copyright (c) 2026 BIDIGA Imrane - Koliwa. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import React, { useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Clock3, LocateFixed, MapPin, Package, Truck } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet';
import api from '../services/api';
import KoliwaHandoffBadge from '../components/KoliwaHandoffBadge';
import TrackingLookup from '../components/TrackingLookup';
import TrackingModeNav from '../components/TrackingModeNav';
import DeliveryGlyph from '../components/DeliveryGlyph';
import { formatTrackingReference, normalizeTrackingReference } from '../utils/trackingReference';

const STATUS_LABELS = {
  PENDING: 'Demande en attente',
  AWAITING_PAYMENT: 'Paiement en attente',
  PAID: 'Recherche d’un livreur',
  SCHEDULED: 'Livraison programmée',
  IN_PREPARATION: 'En attente de récupération',
  READY_FOR_PICKUP: 'En attente d’un livreur',
  DRIVER_ASSIGNED: 'Livreur assigné',
  PROCESSING: 'En route vers le point de récupération',
  IN_DELIVERY: 'En livraison',
  DELIVERED_PENDING_CONFIRMATION: 'Arrivée — confirmation du receveur attendue',
  DELIVERED: 'Réception confirmée',
  COMPLETED: 'Livraison terminée',
  CANCELLED: 'Livraison annulée',
  FAILED: 'Livraison échouée',
};
const TRACKING_STEPS = ['Payé', 'Attribué', 'En route', 'Arrivé', 'Remis'];
const TRACKING_PROGRESS = {
  AWAITING_PAYMENT: -1,
  PAID: 0,
  SCHEDULED: 0,
  DRIVER_ASSIGNED: 1,
  PROCESSING: 2,
  IN_DELIVERY: 2,
  DELIVERED_PENDING_CONFIRMATION: 3,
  DELIVERED: 4,
  COMPLETED: 4,
};

const marker = (kind, label) => L.divIcon({
  className: '',
  html: `<div class="tracking-pin tracking-pin--${kind}" aria-hidden="true">${label}</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const pickupIcon = marker('pickup', 'D');
const dropoffIcon = marker('destination', 'A');
const driverIcon = marker('courier', 'L');
const OUAGADOUGOU = [12.3714, -1.5197];
const DRIVER_ACTIVE_STATUSES = ['DRIVER_ASSIGNED', 'PROCESSING', 'IN_DELIVERY'];
const CLOSED_STATUSES = ['DELIVERED', 'COMPLETED', 'CANCELLED', 'FAILED', 'REFUNDED', 'DISPUTED'];

function FitBounds({ points }) {
  const map = useMap();
  React.useEffect(() => {
    if (points.length > 1) map.fitBounds(points, { padding: [32, 32] });
    else if (points.length === 1) map.setView(points[0], 14);
  }, [map, points]);
  return null;
}

function CenterOnCourier({ latitude, longitude }) {
  const map = useMap();
  return (
    <button type="button" className="tracking-center-courier" onClick={() => map.setView([latitude, longitude], Math.max(map.getZoom(), 15))}>
      <LocateFixed size={17} aria-hidden="true" /> Voir le livreur
    </button>
  );
}

function formatEta(eta) {
  if (!eta || !Number.isFinite(Number(eta.totalMinutes))) return 'Calcul en cours';
  const minutes = Number(eta.totalMinutes);
  return minutes <= 1 ? 'Moins d’une minute' : `Environ ${minutes} min`;
}

export default function PublicTracking({ byReference = false }) {
  const { token } = useParams();
  const requestedReference = useLocation().state?.reference;
  const reference = typeof requestedReference === 'string' ? normalizeTrackingReference(requestedReference) : null;
  const lookupKey = byReference ? reference : token;
  const [pinCode, setPinCode] = useState('');
  const [confirmMessage, setConfirmMessage] = useState('');
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: [byReference ? 'reference-tracking' : 'public-tracking', lookupKey],
    queryFn: ({ signal }) => byReference ? api.getActiveTrackingByReference(reference, signal) : api.getPublicTracking(token, signal),
    enabled: Boolean(lookupKey),
    retry: (count, failure) => !(failure.status >= 400 && failure.status < 500) && count < 1,
    refetchInterval: (query) => query.state.error?.status === 404 || CLOSED_STATUSES.includes(query.state.data?.status) ? false : 12000,
    staleTime: 8000,
  });
  const confirmMutation = useMutation({
    mutationFn: () => api.confirmPublicTracking(token, pinCode),
    onSuccess: () => {
      setConfirmMessage('Réception confirmée. Merci.');
      queryClient.invalidateQueries({ queryKey: ['public-tracking', token] });
    },
  });

  const resendPin = useMutation({
    mutationFn: () => api.resendPublicReceiptCode(token),
  });

  const pickup = data?.pickupLocation;
  const dropoff = data?.dropoffLocation || data?.deliveryLocation;
  const { latitude: pickupLat, longitude: pickupLng } = pickup || {};
  const { latitude: dropoffLat, longitude: dropoffLng } = dropoff || {};
  // Les nouvelles coordonnées du livreur déplacent son marqueur sans modifier le zoom du client.
  const points = useMemo(() => {
    const result = [];
    if (Number.isFinite(pickupLat) && Number.isFinite(pickupLng)) result.push([pickupLat, pickupLng]);
    if (Number.isFinite(dropoffLat) && Number.isFinite(dropoffLng)) result.push([dropoffLat, dropoffLng]);
    return result;
  }, [pickupLat, pickupLng, dropoffLat, dropoffLng]);

  const statusLabel = STATUS_LABELS[data?.status] || data?.status;
  const isClosed = CLOSED_STATUSES.includes(data?.status);
  const driverActive = DRIVER_ACTIVE_STATUSES.includes(data?.status);
  const location = data?.driverLocation;
  const age = location ? Date.now() - Number(location.updatedAt) : Infinity;
  const driver = driverActive && age <= 300000
    && Number.isFinite(location?.latitude) && Number.isFinite(location?.longitude) ? location : null;
  const driverLive = driver && age <= 30000 && !isError;
  const canDisplayData = data && !(isError && error?.status >= 400 && error?.status < 500);
  const driverUpdateTime = driver ? new Date(Number(driver.updatedAt)).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  }) : null;
  const trackingReference = formatTrackingReference(data?.trackingReference || reference);
  const missing = error?.status === 404;
  const progress = TRACKING_PROGRESS[data?.status];

  return (
    <div className="app-page tracking-page">
      <section className="tracking-frame" aria-labelledby="tracking-page-title">
        <header className="client-screen-heading">
          <div className="client-screen-title">
            <span><DeliveryGlyph kind="track" /></span>
            <h1 id="tracking-page-title">{byReference ? 'Suivre un colis' : 'Votre livraison'}</h1>
          </div>
        </header>
        {byReference && <TrackingModeNav />}
        {byReference && canDisplayData && <div className="tracking-search"><TrackingLookup /></div>}
        {isLoading ? (
          <p className="tracking-feedback" role="status">Chargement du suivi…</p>
        ) : !canDisplayData ? (
          <div className="tracking-feedback">
            <DeliveryGlyph kind="track" />
            {!isError && byReference && <p className="tracking-feedback-hint">Le numéro de suivi figure sur le récapitulatif de la livraison.</p>}
            {isError && <p role="alert">{missing ? (byReference ? 'Aucune livraison active pour ce numéro.' : 'Ce lien de suivi est indisponible.') : 'Le suivi est momentanément indisponible.'}</p>}
            {isError && !missing && <button className="app-action-secondary" onClick={() => refetch()}>Réessayer</button>}
            {byReference && <TrackingLookup />}
            {!byReference && <Link to="/suivre" className="app-action">Saisir un numéro</Link>}
          </div>
        ) : (
          <div className="tracking-stage">
            <header className="tracking-overview">
              <div>
                <p className="text-xs text-text-muted">Référence</p>
                <strong className="mt-1 break-words">{trackingReference || data.orderId?.slice(0, 12).toUpperCase()}</strong>
              </div>
              <div className="tracking-status" role="status">{statusLabel}</div>
            </header>
            <div className="tracking-map" role="region" aria-label="Carte de la livraison">
              {points.length || !isClosed ? (
                <MapContainer center={points[0] || OUAGADOUGOU} zoom={13} scrollWheelZoom={false} className="tracking-map-canvas">
                  <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <FitBounds points={points} />
                  {driver && <CenterOnCourier latitude={driver.latitude} longitude={driver.longitude} />}
                  {pickup?.latitude != null && <Marker position={[pickup.latitude, pickup.longitude]} icon={pickupIcon} />}
                  {dropoff?.latitude != null && <Marker position={[dropoff.latitude, dropoff.longitude]} icon={dropoffIcon} />}
                  {driver?.latitude != null && <Marker position={[driver.latitude, driver.longitude]} icon={driverIcon} alt="Position du livreur" title="Position du livreur" />}
                  {points.length === 2 && <Polyline positions={points} pathOptions={{ color: '#454b41', weight: 3, dashArray: '5 8' }} />}
                </MapContainer>
              ) : (
                <div className="tracking-feedback">Aucun repère GPS enregistré.</div>
              )}
            </div>

            <div className="tracking-details">
              <h2>Étapes de la livraison</h2>
              {progress != null && (
                <ol className="tracking-timeline" aria-label="Progression de la livraison">
                  {TRACKING_STEPS.map((label, index) => (
                    <li key={label} data-reached={index <= progress} aria-current={index === progress ? 'step' : undefined}>
                      <span>{index <= progress ? <Check size={13} aria-hidden="true" /> : index + 1}</span>
                      {label}
                    </li>
                  ))}
                </ol>
              )}
              {isError && <p className="mt-4 text-xs text-text-muted" role="status">Actualisation momentanément indisponible.</p>}
              {byReference && points.length > 0 && <p className="mt-4 text-xs text-text-muted">Les repères sur la carte sont approximatifs.</p>}
              <div className="mt-5 space-y-4">
                <div className="flex gap-3"><MapPin size={18} className="mt-0.5 text-accent-primary" /><div><p className="text-xs text-text-muted">Récupération</p><p className="text-sm">{pickup?.address || (pickup ? 'Point de départ sur la carte' : 'Point GPS indisponible')}</p></div></div>
                <div className="flex gap-3"><Package size={18} className="mt-0.5 text-accent-primary" /><div><p className="text-xs text-text-muted">Destination</p><p className="text-sm">{dropoff?.address || (dropoff ? 'Point d’arrivée sur la carte' : 'Point GPS indisponible')}</p></div></div>
                {!isClosed && <div className="flex gap-3"><Truck size={18} className="mt-0.5 text-accent-primary" /><div><p className="text-xs text-text-muted">Livreur</p><p className="text-sm">{driverLive ? `En direct · actualisé à ${driverUpdateTime}` : driver ? `Dernière position reçue à ${driverUpdateTime}` : driverActive ? 'En attente de la position du livreur' : 'La position s’affiche quand le livreur prend la route.'}</p></div></div>}
              </div>
              {data.status === 'IN_DELIVERY' && driverLive && data.eta && <div className="mt-6 border-t border-border-light pt-4 flex items-center gap-3"><Clock3 size={18} className="text-text-muted" /><div><p className="text-xs text-text-muted">Arrivée estimée</p><p className="text-sm font-medium">{formatEta(data.eta)}</p></div></div>}
              {data.status === 'DELIVERED_PENDING_CONFIRMATION' && <div className="mt-5 rounded-xl bg-status-warning/10 p-4 text-xs leading-5 text-text-secondary">Le livreur est arrivé. Le receveur doit confirmer la réception avec le code transmis par Koliwa.</div>}
              {!byReference && data.status === 'DELIVERED_PENDING_CONFIRMATION' && (
                <form
                  className="tracking-receipt"
                  onSubmit={(event) => {
                    event.preventDefault();
                    setConfirmMessage('');
                    confirmMutation.mutate();
                  }}
                >
                  <label className="text-xs font-medium text-text-primary" htmlFor="public-delivery-pin">Code de réception</label>
                  <div className="tracking-pin-control">
                    <input id="public-delivery-pin" value={pinCode} onChange={(event) => setPinCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="000000" className="min-w-0 flex-1 rounded-lg border border-border-subtle bg-background-primary px-3 py-2 text-sm tracking-[0.25em]" />
                    <button type="submit" disabled={pinCode.length !== 6 || confirmMutation.isPending} className="app-action disabled:opacity-40">{confirmMutation.isPending ? '…' : 'Confirmer'}</button>
                  </div>
                  <button type="button" className="mt-3 text-xs underline" onClick={() => resendPin.mutate()} disabled={resendPin.isPending}>
                    {resendPin.isPending ? 'Envoi du SMS…' : 'Renvoyer le code par SMS'}
                  </button>
                  {resendPin.isSuccess && <p className="mt-2 text-xs text-status-success" role="status">Code renvoyé au numéro du destinataire.</p>}
                  {resendPin.isError && <p className="mt-2 text-xs text-status-error" role="alert">{resendPin.error?.message || 'Envoi du SMS indisponible.'}</p>}
                  {confirmMutation.isError && <p className="mt-2 text-xs text-status-error">{confirmMutation.error?.message || 'Code invalide.'}</p>}
                  {confirmMessage && <p className="mt-2 text-xs text-status-success">{confirmMessage}</p>}
                </form>
              )}
              {(data.status === 'DELIVERED' || data.status === 'COMPLETED') && (
                <div className="mt-5 flex flex-wrap items-center gap-2 rounded-xl bg-status-success/10 p-4 text-sm text-status-success">
                  <KoliwaHandoffBadge />
                  <span>Réception confirmée.</span>
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
