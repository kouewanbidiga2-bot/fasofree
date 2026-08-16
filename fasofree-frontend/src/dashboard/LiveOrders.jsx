/**
 * FasoFree — Tour de contrôle en direct
 * Carte temps réel des commandes et positions des livreurs (SUPER_ADMIN / ADMIN / SUPPORT).
 * Rafraîchissement automatique toutes les 10 secondes.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { ArrowLeft, Radio, RefreshCw, Truck, MapPin, Package } from 'lucide-react';
import useAuthStore from '../store/authStore';
import { getAdminOrders } from '../services/ordersService';
import { StatusBadge } from './components/StatCard';

const STATUS_LABELS = {
  PENDING: 'En attente',
  ACCEPTED: 'Acceptée',
  IN_TRANSIT: 'En livraison',
  OUT_FOR_DELIVERY: 'En cours de livraison',
  DELIVERED: 'Livrée',
  COMPLETED: 'Terminée',
  CANCELLED: 'Annulée',
  REJECTED: 'Rejetée',
};

const OUAGADOUGOU = [12.3714, -1.5197];

const LiveOrders = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await getAdminOrders(status || undefined);
      setOrders(Array.isArray(data) ? data : []);
      setError(null);
      setLastUpdate(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
    const timer = setInterval(() => load(true), 10000);
    return () => clearInterval(timer);
  }, [load]);

  const counts = useMemo(() => {
    const c = { total: orders.length };
    orders.forEach((o) => {
      c[o.status] = (c[o.status] || 0) + 1;
    });
    return c;
  }, [orders]);

  const geo = (loc) =>
    loc &&
    typeof loc.latitude === 'number' &&
    typeof loc.longitude === 'number'
      ? [loc.latitude, loc.longitude]
      : null;

  const mapOrders = useMemo(
    () =>
      orders.filter((o) => geo(o.pickupLocation) || geo(o.deliveryLocation) || geo(o.driverLocation)),
    [orders],
  );

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background-primary">
      {/* ─── HEADER ─────────────────────────────────────────────────── */}
      <header className="bg-background-card border-b border-border-light sticky top-0 z-30">
        <div className="max-w-screen-2xl mx-auto px-4 lg:px-6 py-4 flex flex-wrap items-center gap-3">
          <button
            onClick={() => navigate('/financier')}
            className="btn-secondary gap-2 text-sm"
          >
            <ArrowLeft size={16} /> Console
          </button>

          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-text-primary">Tour de contrôle</h1>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-status-successBg text-status-success text-xs font-bold">
              <Radio size={13} className="animate-pulse" />
              EN DIRECT
            </span>
          </div>

          <div className="flex-1" />

          <select
            className="input-field !w-auto !py-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Tous les statuts ({counts.total})</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label} ({counts[value] || 0})
              </option>
            ))}
          </select>

          <button onClick={() => load()} className="btn-secondary gap-2 text-sm">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Actualiser
          </button>

          <span className="text-xs text-text-tertiary">
            {lastUpdate ? `Dernière MAJ : ${lastUpdate.toLocaleTimeString('fr-FR')}` : '—'}
          </span>

          <button
            onClick={handleLogout}
            className="nav-item px-3 py-2 text-status-error hover:bg-status-errorBg rounded-lg text-sm"
          >
            Déconnexion
          </button>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto p-4 lg:p-6 space-y-6">
        {error && (
          <div className="p-3 rounded-lg bg-status-errorBg border border-status-error/30 text-status-error text-sm">
            {error}
          </div>
        )}

        {/* Stats rapides */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card p-4 flex items-center gap-3">
            <Package size={18} className="text-accent-primary" />
            <div>
              <p className="text-2xl font-bold text-text-primary">{counts.total}</p>
              <p className="text-xs text-text-secondary">Commandes actives</p>
            </div>
          </div>
          <div className="card p-4 flex items-center gap-3">
            <Truck size={18} className="text-status-success" />
            <div>
              <p className="text-2xl font-bold text-text-primary">
                {(counts.IN_TRANSIT || 0) + (counts.OUT_FOR_DELIVERY || 0)}
              </p>
              <p className="text-xs text-text-secondary">En livraison</p>
            </div>
          </div>
          <div className="card p-4 flex items-center gap-3">
            <MapPin size={18} className="text-status-warning" />
            <div>
              <p className="text-2xl font-bold text-text-primary">{orders.filter((o) => o.driverLocation).length}</p>
              <p className="text-xs text-text-secondary">Livreurs géolocalisés</p>
            </div>
          </div>
          <div className="card p-4 flex items-center gap-3">
            <Radio size={18} className="text-status-error" />
            <div>
              <p className="text-2xl font-bold text-text-primary">{counts.PENDING || 0}</p>
              <p className="text-xs text-text-secondary">En attente d'acceptation</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ─── CARTE LIVE ───────────────────────────────────────── */}
          <div className="lg:col-span-2 card overflow-hidden">
            <div className="p-4 border-b border-border-light flex items-center justify-between">
              <h2 className="font-bold text-text-primary">Carte en direct</h2>
              <div className="flex items-center gap-4 text-xs text-text-secondary">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-status-success inline-block" /> Livreur
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-accent-primary inline-block" /> Retrait
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-status-error inline-block" /> Livraison
                </span>
              </div>
            </div>
            <div className="h-[480px] w-full">
              <MapContainer
                center={OUAGADOUGOU}
                zoom={12}
                className="h-full w-full z-0"
                scrollWheelZoom
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {mapOrders.map((o) => (
                  <React.Fragment key={o.id}>
                    {geo(o.driverLocation) && (
                      <CircleMarker
                        center={geo(o.driverLocation)}
                        radius={9}
                        pathOptions={{ color: '#22C55E', fillColor: '#22C55E', fillOpacity: 0.7 }}
                      >
                        <Popup>
                          <p className="font-bold text-sm mb-1">Livreur</p>
                          <p className="text-xs text-text-secondary">Commande #{o.id.slice(0, 8)}</p>
                        </Popup>
                      </CircleMarker>
                    )}
                    {geo(o.pickupLocation) && (
                      <CircleMarker
                        center={geo(o.pickupLocation)}
                        radius={7}
                        pathOptions={{ color: '#C1652E', fillColor: '#C1652E', fillOpacity: 0.7 }}
                      >
                        <Popup>
                          <p className="font-bold text-sm mb-1">Point de retrait</p>
                          <p className="text-xs text-text-secondary">Commande #{o.id.slice(0, 8)}</p>
                        </Popup>
                      </CircleMarker>
                    )}
                    {geo(o.deliveryLocation || o.dropoffLocation) && (
                      <CircleMarker
                        center={geo(o.deliveryLocation || o.dropoffLocation)}
                        radius={6}
                        pathOptions={{ color: '#EF4444', fillColor: '#EF4444', fillOpacity: 0.7 }}
                      >
                        <Popup>
                          <p className="font-bold text-sm mb-1">Point de livraison</p>
                          <p className="text-xs text-text-secondary">Commande #{o.id.slice(0, 8)}</p>
                        </Popup>
                      </CircleMarker>
                    )}
                  </React.Fragment>
                ))}
                {mapOrders.length === 0 && (
                  <Popup position={OUAGADOUGOU}>
                    <p className="text-sm">Aucune commande géolocalisée pour l'instant</p>
                  </Popup>
                )}
              </MapContainer>
            </div>
          </div>

          {/* ─── LISTE DES COMMANDES ───────────────────────────────── */}
          <div className="card overflow-hidden flex flex-col">
            <div className="p-4 border-b border-border-light">
              <h2 className="font-bold text-text-primary">Commandes en temps réel</h2>
            </div>
            <div className="flex-1 overflow-y-auto max-h-[520px] divide-y divide-border-light">
              {loading && orders.length === 0 ? (
                <div className="p-6 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-background-secondary rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : orders.length === 0 ? (
                <div className="p-8 text-center">
                  <Package size={40} className="mx-auto text-text-tertiary mb-3" strokeWidth={1} />
                  <p className="text-text-secondary text-sm font-semibold">Aucune commande</p>
                  <p className="text-text-tertiary text-xs mt-1">Changez le filtre ou attendez de nouvelles commandes.</p>
                </div>
              ) : (
                orders.map((o) => (
                  <div key={o.id} className="p-4 hover:bg-background-secondary transition-colors">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <p className="font-mono text-xs font-bold text-text-primary">#{o.id.slice(0, 8)}</p>
                      <StatusBadge
                        status={o.status || 'PENDING'}
                        statusConfig={Object.fromEntries(
                          Object.keys(STATUS_LABELS).map((s) => [
                            s,
                            {
                              label: STATUS_LABELS[s],
                              color:
                                s === 'CANCELLED' || s === 'REJECTED'
                                  ? 'gray'
                                  : s === 'COMPLETED' || s === 'DELIVERED'
                                    ? 'success'
                                    : 'warning',
                              dot:
                                s === 'CANCELLED' || s === 'REJECTED'
                                  ? '#A09890'
                                  : s === 'COMPLETED' || s === 'DELIVERED'
                                    ? '#22C55E'
                                    : '#F59E0B',
                            },
                          ]),
                        )}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-text-secondary">
                        {Number(o.totalAmount || 0).toLocaleString('fr-FR')} FCFA
                      </span>
                      <span className="flex items-center gap-1 text-text-tertiary">
                        {o.driverLocation ? (
                          <>
                            <Truck size={12} className="text-status-success" />
                            Livreur en ligne
                          </>
                        ) : (
                          <>
                            <Truck size={12} />
                            {o.driverId ? 'En route' : 'Aucun livreur'}
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default LiveOrders;
