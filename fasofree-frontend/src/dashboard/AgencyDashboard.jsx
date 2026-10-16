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
  X,
} from 'lucide-react';
import {
  getMyAgency,
  getAgencyDeliveries,
  getAgencyDrivers,
  assignAgencyDelivery,
  getAgencyOpenOffers,
  acceptAgencyOffer,
  refuseAgencyOffer,
} from '../services/agencyService';
import { getDispatchSocket } from '../services/realtime';

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
  // Horloge locale : fait vivre le compte à rebours des offres sans
  // re-interroger le serveur chaque seconde.
  const [now, setNow] = useState(() => Date.now());

  const loadAll = useCallback(async () => {
    try {
      const [agencyData, deliveriesData, driversData, offersData] =
        await Promise.all([
          getMyAgency(),
          getAgencyDeliveries(),
          getAgencyDrivers(),
          // Les offres d'appel d'offres sont un flux distinct : tant
          // qu'aucune agence n'a gagné, la course n'a pas encore de
          // `deliveryProviderId` et n'apparaît pas dans `deliveries`.
          getAgencyOpenOffers().catch(() => []),
        ]);
      setAgency(agencyData);
      setDeliveries(deliveriesData || []);
      setDrivers(driversData || []);
      setOffers(offersData || []);
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
            <div className="w-10 h-10 rounded-xl bg-accent-primary/10 flex items-center justify-center">
              <Building2 className="text-accent-primary" size={22} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-text-primary">
                {agency.name}
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
              <p className="text-[10px] tracking-[0.2em] uppercase">En attente</p>
            </div>
            <p className="text-2xl font-bold text-text-primary">{stats.pending}</p>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-2 text-text-tertiary mb-1">
              <Truck size={14} />
              <p className="text-[10px] tracking-[0.2em] uppercase">En cours</p>
            </div>
            <p className="text-2xl font-bold text-text-primary">{stats.assigned}</p>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-2 text-text-tertiary mb-1">
              <CheckCircle2 size={14} />
              <p className="text-[10px] tracking-[0.2em] uppercase">Livrées</p>
            </div>
            <p className="text-2xl font-bold text-status-success">{stats.delivered}</p>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-2 text-text-tertiary mb-1">
              <DollarSign size={14} />
              <p className="text-[10px] tracking-[0.2em] uppercase">Commission</p>
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
              <h3 className="text-xs font-bold tracking-[0.2em] uppercase flex items-center gap-2 text-accent-primary">
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
            <h3 className="text-xs font-bold tracking-[0.2em] text-[#70645C] uppercase">
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
            <h3 className="text-xs font-bold tracking-[0.2em] text-[#70645C] uppercase">
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
      </main>
    </div>
  );
};

export default AgencyDashboard;
