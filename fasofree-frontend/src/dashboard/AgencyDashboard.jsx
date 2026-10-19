import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Package,
  Truck,
  CheckCircle2,
  DollarSign,
  MapPin,
  RefreshCw,
  UserPlus,
  Building2,
  Megaphone,
  BadgeCheck,
  X,
} from 'lucide-react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
  getMyAgency,
  getAgencyDeliveries,
  getAgencyDrivers,
  assignAgencyDelivery,
  getAgencyOpenOffers,
  acceptAgencyOffer,
  refuseAgencyOffer,
  getAgencyMap,
  getAgencyPenalties,
} from '../services/agencyService';
import { getDispatchSocket } from '../services/realtime';
import SelfServicePushCampaigns from './components/SelfServicePushCampaigns';

/**
 * 🏢 Espace Agence (Niveau 2 du dispatch multi-niveaux).
 *
 * L'agence consulte les courses que FasoFree lui a routées (pool
 * interne indisponible) et les assigne à SES chauffeurs. Le chauffeur
 * est un DRIVER classique : validation livraison, PIN et paiements
 * inchangés.
 *
 * Temps réel : room WebSocket `agency_<id>` (événement `agency_delivery`).
 */
const STATUS_LABELS = {
  ROUTED: 'En attente',
  OFFERED: 'Appel d’offres',
  ACCEPTED: 'À assigner',
  DISPATCHED: 'Dispatchée',
  MANUAL_QUEUE: 'File manuelle',
  ESCALATED: 'Escaladée',
};

const AgencyDashboard = () => {
  const [agency, setAgency] = useState(null);
  const [deliveries, setDeliveries] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [assigning, setAssigning] = useState({});
  const [assignTarget, setAssignTarget] = useState({});
  const [responding, setResponding] = useState({});
  // 📍 Carte temps réel (bloc E) : positions des chauffeurs + courses actives.
  // `null` = pas encore chargé ou chargement en cours.
  const [mapData, setMapData] = useState(null);
  // ⚖️ Sanctions qualité de l'agence (bloc C).
  const [penalties, setPenalties] = useState([]);
  // Horloge locale : fait vivre le compte à rebours des offres sans
  // re-interroger le serveur chaque seconde.
  const [now, setNow] = useState(() => Date.now());

  const loadAll = useCallback(async () => {
    try {
      const [
        agencyData,
        deliveriesData,
        driversData,
        offersData,
        mapDataResult,
        penaltiesData,
      ] = await Promise.all([
        getMyAgency(),
        getAgencyDeliveries(),
        getAgencyDrivers(),
        // Les offres d'appel d'offres sont un flux distinct : tant
        // qu'aucune agence n'a gagné, la course n'a pas encore de
        // `deliveryProviderId` et n'apparaît pas dans `deliveries`.
        getAgencyOpenOffers().catch(() => []),
        // La carte et les sanctions sont des lectures annexes : un échec
        // ne doit pas faire échouer le chargement principal de l'espace.
        getAgencyMap().catch(() => null),
        getAgencyPenalties().catch(() => []),
      ]);
      setAgency(agencyData);
      setDeliveries(deliveriesData || []);
      setDrivers(driversData || []);
      setOffers(offersData || []);
      setMapData(mapDataResult);
      setPenalties(penaltiesData || []);
      setError(null);
    } catch (err) {
      setError(err.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
    const interval = setInterval(loadAll, 30000); // fallback polling
    return () => clearInterval(interval);
  }, [loadAll]);

  // ⏱️ Compte à rebours local (1 s) des fenêtres d'acceptation de 5 min.
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  // 🔌 Temps réel : rejoindre la room agence et rafraîchir à chaque course routée
  useEffect(() => {
    if (!agency?.id) return undefined;
    const socket = getDispatchSocket();
    socket.connect();
    socket.emit('joinAgencyRoom', { agencyId: agency.id });
    const onNewDelivery = () => loadAll();
    socket.on('agency_delivery', onNewDelivery);
    return () => {
      socket.off('agency_delivery', onNewDelivery);
    };
  }, [agency?.id, loadAll]);

  const stats = useMemo(() => {
    const pending = deliveries.filter((d) => !d.driverId).length;
    const assigned = deliveries.filter((d) => d.driverId).length;
    const delivered = deliveries.filter(
      (d) => d.status === 'DELIVERED' || d.status === 'COMPLETED',
    ).length;
    const commission = deliveries.reduce(
      (sum, d) => sum + Number(d.agencyCommissionXof || 0),
      0,
    );
    return { pending, assigned, delivered, commission };
  }, [deliveries]);

  // 🎚️ Qualité de livraison (blocs B + C) : calculée sur les courses
  // terminées de l'agence. `deliveryLate` est posé par le backend au
  // moment de la remise (tolérance +25 % de l'ETA) — l'agence n'a donc
  // rien à calculer elle-même, elle lit la mesure.
  const quality = useMemo(() => {
    const done = deliveries.filter(
      (d) => d.deliveredAt || d.status === 'DELIVERED' || d.status === 'COMPLETED',
    );
    const late = done.filter((d) => d.deliveryLate).length;
    const onTime = done.length - late;
    const avg = (key) =>
      done.length
        ? done.reduce((sum, d) => sum + (Number(d[key]) || 0), 0) / done.length
        : null;
    return {
      total: done.length,
      late,
      onTime,
      rate: done.length ? Math.round((onTime / done.length) * 100) : null,
      avgDuration: avg('deliveryDurationMinutes'),
      avgEta: avg('deliveryEtaMinutes'),
    };
  }, [deliveries]);

  const activePenalties = penalties.filter((p) => p.active);

  // 📍 Centre de la carte : première position connue (chauffeur ou course),
  // sinon Ouagadougou par défaut. Sans position du tout, on reste sur la
  // ville plutôt que d'afficher une carte vide centrée sur l'océan.
  const mapCenter = useMemo(() => {
    if (!mapData) return null;
    const pts = [
      ...mapData.drivers.map((d) => d.location),
      ...mapData.orders.flatMap((o) => [o.pickup, o.dropoff, o.driverLocation]),
    ].filter(Boolean);
    if (pts.length === 0) return [12.37, -1.52];
    return [pts[0].latitude, pts[0].longitude];
  }, [mapData]);

  const handleAssign = async (orderId) => {
    const driverId = assignTarget[orderId];
    if (!driverId) return;
    setAssigning((prev) => ({ ...prev, [orderId]: true }));
    try {
      await assignAgencyDelivery(orderId, driverId);
      await loadAll();
    } catch (err) {
      setError(err.message || 'Échec de l\'assignation');
    } finally {
      setAssigning((prev) => ({ ...prev, [orderId]: false }));
    }
  };

  // ✅ Accepter une offre d'appel d'offres — « premier qui accepte gagne ».
  // Un 400 signifie qu'une autre agence a été plus rapide (ou fenêtre
  // écoulée) : on rafraîchit la liste pour la faire disparaître.
  const handleAcceptOffer = async (orderId) => {
    setResponding((prev) => ({ ...prev, [orderId]: 'accept' }));
    try {
      await acceptAgencyOffer(orderId);
      await loadAll();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Échec de l'acceptation",
      );
      await loadAll();
    } finally {
      setResponding((prev) => ({ ...prev, [orderId]: null }));
    }
  };

  // 🚫 Refuser une offre — l'appel d'offres continue pour les autres agences.
  const handleRefuseOffer = async (orderId) => {
    setResponding((prev) => ({ ...prev, [orderId]: 'refuse' }));
    try {
      await refuseAgencyOffer(orderId);
      setOffers((prev) => prev.filter((o) => o.orderId !== orderId));
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Échec du refus');
    } finally {
      setResponding((prev) => ({ ...prev, [orderId]: null }));
    }
  };

  const formatCountdown = (seconds) => {
    const safe = Math.max(0, seconds);
    const m = Math.floor(safe / 60);
    const s = safe % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <RefreshCw className="animate-spin text-accent-primary" size={32} />
      </div>
    );
  }

  if (!agency) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="card p-8 max-w-md text-center">
          <Building2 className="mx-auto text-status-error mb-4" size={48} />
          <h1 className="text-xl font-bold text-text-primary mb-2">
            Aucune agence rattachée
          </h1>
          <p className="text-text-secondary text-sm">
            Votre compte n'est pas encore rattaché à une agence de livraison.
            Contactez l'administration FasoFree.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* ── EN-TÊTE ─────────────────────────────────────────── */}
      <header className="bg-card border-b border-border-light sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* 🏢 Lot 1 : logo de la société — c'est l'identité que le client
                verra sur le suivi de sa commande. */}
            {agency.logoUrl ? (
              <img
                src={agency.logoUrl}
                alt={agency.name}
                className="w-10 h-10 rounded-xl object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-accent-primary/10 flex items-center justify-center">
                <Building2 className="text-accent-primary" size={22} />
              </div>
            )}
            <div>
              <h1 className="flex items-center gap-1 text-lg font-bold text-text-primary">
                <span className="truncate">{agency.name}</span>
                {agency.isVerified === true && (
                  <BadgeCheck
                    size={16}
                    className="text-status-success shrink-0"
                    aria-label="Société vérifiée"
                  />
                )}
              </h1>
              <p className="text-xs text-text-tertiary">
                Espace Agence — FasoFree Livraison
              </p>
            </div>
          </div>
          <button onClick={loadAll} className="btn-secondary gap-2">
            <RefreshCw size={14} />
            Actualiser
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {error && (
          <div className="p-3 rounded-lg border bg-status-errorBg border-status-error/30 text-status-error text-sm">
            {error}
          </div>
        )}

        {/* ── STATISTIQUES ───────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="card p-4">
            <div className="flex items-center gap-2 text-text-tertiary mb-1">
              <Package size={14} />
              <p className="text-[11.5px]">En attente</p>
            </div>
            <p className="text-2xl font-bold text-text-primary">{stats.pending}</p>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-2 text-text-tertiary mb-1">
              <Truck size={14} />
              <p className="text-[11.5px]">En cours</p>
            </div>
            <p className="text-2xl font-bold text-text-primary">{stats.assigned}</p>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-2 text-text-tertiary mb-1">
              <CheckCircle2 size={14} />
              <p className="text-[11.5px]">Livrées</p>
            </div>
            <p className="text-2xl font-bold text-status-success">{stats.delivered}</p>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-2 text-text-tertiary mb-1">
              <DollarSign size={14} />
              <p className="text-[11.5px]">Commission</p>
            </div>
            <p className="text-2xl font-bold text-accent-primary">
              {stats.commission.toLocaleString()} <span className="text-xs text-text-secondary">FCFA</span>
            </p>
          </div>
        </div>

        {/* ── 📣 APPELS D'OFFRES OUVERTS (A4) ─────────────────── */}
        {offers.length > 0 && (
          <div className="card overflow-hidden border-2 border-accent-primary/40">
            <div className="px-5 py-3 border-b border-border-light flex items-center justify-between bg-accent-primary/5">
              <h3 className="text-[13.5px] font-bold text-text-primary flex items-center gap-2">
                <Megaphone size={14} />
                Appels d'offres — premier qui accepte gagne
              </h3>
              <span className="text-xs font-semibold text-accent-primary">
                {offers.length} à saisir
              </span>
            </div>
            <div className="divide-y divide-border-light">
              {offers.map((offer) => {
                const remaining = offer.expiresAt
                  ? Math.floor(
                      (new Date(offer.expiresAt).getTime() - now) / 1000,
                    )
                  : 0;
                const expired = remaining <= 0;
                const busy = responding[offer.orderId];
                return (
                  <div key={offer.offerId} className="px-5 py-4">
                    <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p className="text-sm font-semibold text-text-primary">
                            #{offer.orderId.slice(0, 8)}
                          </p>
                          {offer.order?.businessName && (
                            <span className="text-xs text-text-secondary">
                              · {offer.order.businessName}
                            </span>
                          )}
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              expired
                                ? 'bg-status-errorBg text-status-error'
                                : remaining <= 60
                                  ? 'bg-status-warningBg text-status-warning'
                                  : 'bg-accent-primary/10 text-accent-primary'
                            }`}
                          >
                            {expired
                              ? 'Fenêtre écoulée'
                              : `Reste ${formatCountdown(remaining)}`}
                          </span>
                          <span className="text-[10px] text-text-tertiary">
                            tour {offer.round}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-text-tertiary">
                          <MapPin size={12} />
                          <span className="truncate">
                            {offer.order?.pickupAddress || 'Ramassage'} →{' '}
                            {offer.order?.deliveryAddress || 'Livraison'}
                          </span>
                        </div>
                        <p className="text-xs text-text-tertiary mt-1">
                          Frais :{' '}
                          {Number(offer.order?.deliveryFee || 0).toLocaleString()}{' '}
                          FCFA
                          <span className="text-accent-primary font-semibold">
                            {' '}
                            · Ma commission :{' '}
                            {Number(
                              offer.agencyCommissionXof || 0,
                            ).toLocaleString()}{' '}
                            FCFA ({offer.commissionPct}%)
                          </span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleAcceptOffer(offer.orderId)}
                          disabled={expired || !!busy}
                          className="btn-primary gap-2 text-sm disabled:opacity-50"
                        >
                          <CheckCircle2 size={14} />
                          {busy === 'accept' ? '…' : 'Accepter'}
                        </button>
                        <button
                          onClick={() => handleRefuseOffer(offer.orderId)}
                          disabled={!!busy}
                          className="btn-secondary gap-2 text-sm"
                        >
                          <X size={14} />
                          {busy === 'refuse' ? '…' : 'Refuser'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── COURSES ROUTÉES ────────────────────────────────── */}
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-border-light flex items-center justify-between">
            <h3 className="text-[13.5px] font-bold text-text-primary">
              Livraisons routées vers mon agence
            </h3>
            <span className="text-xs text-text-tertiary">{deliveries.length} course(s)</span>
          </div>

          {deliveries.length === 0 ? (
            <div className="p-8 text-center text-text-tertiary text-sm">
              Aucune course routée pour le moment.
            </div>
          ) : (
            <div className="divide-y divide-border-light">
              {deliveries.map((order) => {
                const isPending = !order.driverId;
                return (
                  <div key={order.id} className="px-5 py-4">
                    <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                      {/* Infos course */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-semibold text-text-primary">
                            #{order.id.slice(0, 8)}
                          </p>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isPending
                              ? 'bg-status-warningBg text-status-warning'
                              : 'bg-status-successBg text-status-success'
                          }`}>
                            {STATUS_LABELS[order.deliveryProviderStatus] || (isPending ? 'En attente' : 'Assignée')}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-text-tertiary">
                          <MapPin size={12} />
                          <span className="truncate">
                            {order.pickupLocation?.address || 'Ramassage'} → {order.deliveryLocation?.address || 'Livraison'}
                          </span>
                        </div>
                        <p className="text-xs text-text-tertiary mt-1">
                          Frais : {Number(order.deliveryFee || 0).toLocaleString()} FCFA
                          {Number(order.agencyCommissionXof || 0) > 0 && (
                            <span className="text-accent-primary font-semibold">
                              {' '}· Commission : {Number(order.agencyCommissionXof).toLocaleString()} FCFA
                            </span>
                          )}
                        </p>
                      </div>

                      {/* Assignation */}
                      {isPending && (
                        <div className="flex items-center gap-2">
                          <select
                            className="input text-sm"
                            value={assignTarget[order.id] || ''}
                            onChange={(e) =>
                              setAssignTarget((prev) => ({
                                ...prev,
                                [order.id]: e.target.value,
                              }))
                            }
                          >
                            <option value="">Choisir un chauffeur…</option>
                            {drivers.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.fullName} {d.isOnline ? '🟢' : '⚪'}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => handleAssign(order.id)}
                            disabled={!assignTarget[order.id] || assigning[order.id]}
                            className="btn-primary gap-2 text-sm"
                          >
                            <UserPlus size={14} />
                            {assigning[order.id] ? '…' : 'Assigner'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── CHAUFFEURS DE L'AGENCE ─────────────────────────── */}
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-border-light">
            <h3 className="text-[13.5px] font-bold text-text-primary">
              Mes chauffeurs ({drivers.length})
            </h3>
          </div>
          {drivers.length === 0 ? (
            <div className="p-8 text-center text-text-tertiary text-sm">
              Aucun chauffeur rattaché à votre agence.
            </div>
          ) : (
            <div className="divide-y divide-border-light">
              {drivers.map((driver) => (
                <div key={driver.id} className="px-5 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full ${driver.isOnline ? 'bg-status-success' : 'bg-text-tertiary'}`} />
                    <div>
                      <p className="text-sm font-medium text-text-primary">{driver.fullName}</p>
                      <p className="text-[10px] text-text-tertiary">
                        {driver.vehicleType || 'Véhicule non précisé'} · Note : {driver.averageRating || '—'}
                      </p>
                    </div>
                  </div>
                  <span className={`text-xs font-semibold ${driver.isAvailable ? 'text-status-success' : 'text-status-warning'}`}>
                    {driver.isAvailable ? 'Disponible' : 'En course'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── 🎚️ QUALITÉ & SLA (blocs B + C) ─────────────────── */}
        <div className="card p-5">
          <h3 className="text-[13.5px] font-bold text-text-primary mb-1">
            Qualité de livraison
          </h3>
          <p className="text-xs text-text-secondary mb-4">
            Mesure posée par FasoFree au moment de la remise (tolérance +25 % de
            l'ETA). Une sanction se révoque, elle ne s'efface jamais.
          </p>

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="rounded-lg bg-background-secondary p-3">
              <p className="text-[11.5px] text-text-tertiary">Livrées</p>
              <p className="text-xl font-bold text-text-primary">{quality.total}</p>
            </div>
            <div className="rounded-lg bg-background-secondary p-3">
              <p className="text-[11.5px] text-text-tertiary">À temps</p>
              <p className="text-xl font-bold text-status-success">
                {quality.rate == null ? '—' : `${quality.rate} %`}
              </p>
            </div>
            <div className="rounded-lg bg-background-secondary p-3">
              <p className="text-[11.5px] text-text-tertiary">En retard</p>
              <p className="text-xl font-bold text-status-error">{quality.late}</p>
            </div>
            <div className="rounded-lg bg-background-secondary p-3">
              <p className="text-[11.5px] text-text-tertiary">Durée moy.</p>
              <p className="text-xl font-bold text-text-primary">
                {quality.avgDuration == null
                  ? '—'
                  : `${Math.round(quality.avgDuration)} min`}
              </p>
            </div>
            <div className="rounded-lg bg-background-secondary p-3">
              <p className="text-[11.5px] text-text-tertiary">Sanctions</p>
              <p className="text-xl font-bold text-status-warning">{activePenalties.length}</p>
            </div>
          </div>

          {penalties.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11.5px] text-text-tertiary border-b border-border-light">
                    <th className="py-2 pr-3">Niveau</th>
                    <th className="py-2 pr-3">Motif</th>
                    <th className="py-2 pr-3">Début</th>
                    <th className="py-2 pr-3">Fin</th>
                    <th className="py-2">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {penalties.map((p) => (
                    <tr key={p.id} className="border-b border-border-light/60">
                      <td className="py-2 pr-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          p.level === 'SUSPENSION'
                            ? 'bg-status-errorBg text-status-error'
                            : p.level === 'PRIORITY_DOWNGRADE'
                              ? 'bg-status-warningBg text-status-warning'
                              : 'bg-background-secondary text-text-secondary'
                        }`}>
                          {p.level === 'SUSPENSION'
                            ? 'Suspension'
                            : p.level === 'PRIORITY_DOWNGRADE'
                              ? 'Priorité baissée'
                              : 'Avertissement'}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-text-secondary max-w-[280px]">
                        <span className="line-clamp-2">{p.reason || '—'}</span>
                      </td>
                      <td className="py-2 pr-3 text-text-secondary text-xs">
                        {p.effectiveFrom
                          ? new Date(p.effectiveFrom).toLocaleDateString('fr-FR')
                          : '—'}
                      </td>
                      <td className="py-2 pr-3 text-text-secondary text-xs">
                        {p.effectiveUntil
                          ? new Date(p.effectiveUntil).toLocaleDateString('fr-FR')
                          : 'Jusqu\u2019à révocation'}
                      </td>
                      <td className="py-2 text-xs">
                        {p.active ? (
                          <span className="font-semibold text-status-error">Active</span>
                        ) : (
                          <span className="text-text-tertiary">Levée</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── 📍 CARTE TEMPS RÉEL (bloc E) ───────────────────── */}
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-border-light flex items-center justify-between">
            <h3 className="text-[13.5px] font-bold text-text-primary">
              Carte temps réel
            </h3>
            <span className="text-xs text-text-tertiary">
              {mapData
                ? `${mapData.drivers.length} chauffeur(s) · ${mapData.orders.length} course(s) active(s)`
                : 'Chargement…'}
            </span>
          </div>

          {!mapData || !mapCenter ? (
            <div className="p-10 text-center text-text-tertiary text-sm">
              Aucune position disponible pour le moment.
            </div>
          ) : (
            <MapContainer
              center={mapCenter}
              zoom={12}
              className="h-[420px] w-full"
              scrollWheelZoom
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/* Mes chauffeurs : point violet + encart */}
              {mapData.drivers.map((d) =>
                d.location ? (
                  <CircleMarker
                    key={`driver-${d.id}`}
                    center={[d.location.latitude, d.location.longitude]}
                    radius={7}
                    pathOptions={{ color: '#7C3AED', fillColor: '#7C3AED', fillOpacity: 0.8 }}
                  >
                    <Popup>
                      <div className="text-xs">
                        <p className="font-semibold">{d.name}</p>
                        <p>{d.vehicleType || 'Véhicule non précisé'}</p>
                        <p>
                          {d.isOnline ? 'En ligne' : 'Hors ligne'} · Note{' '}
                          {d.averageRating || '—'}
                        </p>
                        <p>
                          Position :{' '}
                          {new Date(d.location.updatedAt).toLocaleTimeString('fr-FR')}
                        </p>
                      </div>
                    </Popup>
                  </CircleMarker>
                ) : null,
              )}

              {/* Mes courses actives : ramassage (vert) et destination (orange) */}
              {mapData.orders.map((o) => (
                <React.Fragment key={`order-${o.id}`}>
                  {o.pickup && (
                    <CircleMarker
                      center={[o.pickup.latitude, o.pickup.longitude]}
                      radius={6}
                      pathOptions={{ color: '#22C55E', fillColor: '#22C55E', fillOpacity: 0.8 }}
                    >
                      <Popup>
                        <div className="text-xs">
                          <p className="font-semibold">Ramassage · {o.ref}</p>
                          <p>{o.pickup.address || 'Adresse non renseignée'}</p>
                        </div>
                      </Popup>
                    </CircleMarker>
                  )}
                  {o.dropoff && (
                    <CircleMarker
                      center={[o.dropoff.latitude, o.dropoff.longitude]}
                      radius={6}
                      pathOptions={{ color: '#F59E0B', fillColor: '#F59E0B', fillOpacity: 0.8 }}
                    >
                      <Popup>
                        <div className="text-xs">
                          <p className="font-semibold">Livraison · {o.ref}</p>
                          <p>{o.dropoff.address || 'Adresse non renseignée'}</p>
                          <p>Frais : {Number(o.deliveryFee).toLocaleString()} FCFA</p>
                        </div>
                      </Popup>
                    </CircleMarker>
                  )}
                  {o.driverLocation && (
                    <CircleMarker
                      center={[o.driverLocation.latitude, o.driverLocation.longitude]}
                      radius={9}
                      pathOptions={{ color: '#EF4444', fillColor: '#EF4444', fillOpacity: 0.9 }}
                    >
                      <Popup>
                        <div className="text-xs">
                          <p className="font-semibold">Livreur en route · {o.ref}</p>
                          <p>
                            {o.pickup?.address || '?'} → {o.dropoff?.address || '?'}
                          </p>
                        </div>
                      </Popup>
                    </CircleMarker>
                  )}
                </React.Fragment>
              ))}
            </MapContainer>
          )}

          <div className="px-5 py-3 border-t border-border-light flex flex-wrap gap-4 text-[11px] text-text-tertiary">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#7C3AED]" /> Mes chauffeurs
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444]" /> Livreur en route
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#22C55E]" /> Ramassage
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" /> Destination
            </span>
          </div>
        </div>

        {/* 💳 Lot 3 — campagne push auto-service payante (audience : mes
            livreurs ou tous les clients). Ne peut jamais viser toute la base. */}
        <SelfServicePushCampaigns role="agency" />
      </main>
    </div>
  );
};

export default AgencyDashboard;
