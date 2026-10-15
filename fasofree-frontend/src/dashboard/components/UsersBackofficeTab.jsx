import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, RefreshCw, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import { getUsers } from '../../services/usersService';
import { LoadingSkeleton, EmptyState } from './StatCard';

const ROLE_OPTIONS = [
  { value: '', label: 'Tous les rôles' },
  { value: 'CLIENT', label: 'Clients' },
  { value: 'BUSINESS_ADMIN', label: 'Commerçants' },
  { value: 'DRIVER', label: 'Livreurs' },
  { value: 'COURIER', label: 'Coursiers' },
  { value: 'AGENCY', label: 'Agences' },
  { value: 'SUPPORT', label: 'Support' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'SUPER_ADMIN', label: 'Super Admin' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'PENDING_APPROVAL', label: 'En attente' },
  { value: 'KYC_APPROVED', label: 'KYC validé' },
  { value: 'KYC_REJECTED', label: 'KYC rejeté' },
  { value: 'APPROVED', label: 'Approuvé' },
  { value: 'REJECTED', label: 'Rejeté' },
];

/**
 * Onglet Back-office utilisateurs (ADMIN / SUPPORT / SUPER_ADMIN).
 * Lecture seule : les actions sensibles restent dans SuperAdminDashboard.
 *
 * Auto-rafraîchissement :
 *  - `autoRefresh`        : active le polling interne (défaut : true).
 *  - `refreshIntervalMs`  : période du polling (défaut : 30 s).
 *  - `refreshTick`        : incrémenté par le parent pour forcer un
 *                           rafraîchissement immédiat (socket / visibilité).
 *
 * Les rafraîchissements de fond ne vident jamais le tableau et ne masquent
 * pas une erreur déjà affichée : seul un changement de filtres/page
 * déclenche un chargement « visible ».
 */
const UsersBackofficeTab = ({
  autoRefresh = true,
  refreshIntervalMs = 30_000,
  refreshTick = 0,
}) => {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [role, setRole] = useState('');
  const [applicationStatus, setApplicationStatus] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Empêche deux requêtes simultanées (polling + tick parent) de se
  // chevaucher et de désynchroniser `total` / `page`.
  const inFlightRef = useRef(false);

  // Debounce recherche : évite une requête par caractère.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => clearTimeout(t);
  }, [search]);

  /**
   * @param {boolean} silent - `true` pour un rafraîchissement de fond
   *   (pas de squelette, pas d'effacement du tableau ni de l'erreur).
   */
  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;

      if (!silent) {
        setLoading(true);
        setError('');
      }

      try {
        const res = await getUsers({
          role: role || undefined,
          search: debouncedSearch || undefined,
          applicationStatus: applicationStatus || undefined,
          page,
          limit,
        });
        setUsers(Array.isArray(res?.items) ? res.items : []);
        setTotal(Number(res?.total ?? 0));
        if (silent) setError('');
      } catch (err) {
        // Un rafraîchissement de fond ne doit pas vider un tableau déjà
        // affiché : on conserve la dernière liste connue.
        if (!silent) {
          setUsers([]);
          setTotal(0);
          const status = err?.response?.status;
          setError(
            status === 401 || status === 403
              ? "Accès refusé à la liste des utilisateurs."
              : "Impossible de charger les utilisateurs.",
          );
        }
      } finally {
        inFlightRef.current = false;
        if (!silent) setLoading(false);
      }
    },
    [role, debouncedSearch, applicationStatus, page, limit],
  );

  useEffect(() => {
    load();
  }, [load]);

  // 🔄 Rafraîchissement forcé par le parent (socket / retour onglet).
  useEffect(() => {
    if (refreshTick === 0) return;
    load({ silent: true });
  }, [refreshTick, load]);

  // 🔄 Polling interne : suit les inscriptions / bannissements / réactivations
  // sans dépendre d'un événement socket (qui n'est émis qu côté commandes).
  useEffect(() => {
    if (!autoRefresh || refreshIntervalMs <= 0) return undefined;

    const interval = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (inFlightRef.current) return;
      load({ silent: true });
    }, refreshIntervalMs);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshIntervalMs, load]);

  // 👁️ Retour sur l'onglet : rattrapage immédiat (l'intervalle peut avoir
  // été suspendu en arrière-plan).
  useEffect(() => {
    if (!autoRefresh) return undefined;

    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      if (inFlightRef.current) return;
      load({ silent: true });
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [autoRefresh, load]);

  // Retour page 1 à chaque changement de filtre (sauf pagination explicite).
  useEffect(() => {
    setPage(1);
  }, [role, applicationStatus, debouncedSearch]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / limit)),
    [total, limit],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-text-primary">Comptes utilisateurs</h2>
          <p className="text-sm text-text-secondary">
            Back-office filtré : {total} compte(s) trouvé(s)
          </p>
        </div>
        <button
          onClick={() => load()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border-light hover:bg-background-secondary transition-colors text-sm"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Actualiser
        </button>
      </div>

      <div className="bg-background-card border border-border-light rounded-xl p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="relative md:col-span-2">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher nom, email, téléphone"
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-background-secondary border border-border-light text-sm"
          />
        </div>

        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="px-3 py-2 rounded-lg bg-background-secondary border border-border-light text-sm"
        >
          {ROLE_OPTIONS.map((opt) => (
            <option key={opt.value || 'all'} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <select
          value={applicationStatus}
          onChange={(e) => setApplicationStatus(e.target.value)}
          className="px-3 py-2 rounded-lg bg-background-secondary border border-border-light text-sm"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value || 'all-status'} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="bg-status-errorBg border border-status-error/30 rounded-lg p-4 text-sm text-status-error">
          {error}
        </div>
      )}

      <div className="bg-background-card border border-border-light rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-background-secondary text-text-secondary text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3">Nom</th>
              <th className="text-left px-4 py-3">Email</th>
              <th className="text-left px-4 py-3">Téléphone</th>
              <th className="text-left px-4 py-3">Rôle</th>
              <th className="text-left px-4 py-3">Statut</th>
              <th className="text-left px-4 py-3">Actif</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="p-4">
                  <LoadingSkeleton height="h-10" />
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8">
                  <EmptyState
                    icon={Users}
                    title="Aucun compte"
                    description="Ajuste les filtres pour élargir la recherche."
                  />
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="border-t border-border-light">
                  <td className="px-4 py-3 text-text-primary font-medium">
                    {u.fullName || '—'}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{u.email}</td>
                  <td className="px-4 py-3 text-text-secondary">{u.phone || '—'}</td>
                  <td className="px-4 py-3 text-text-secondary">{u.role}</td>
                  <td className="px-4 py-3 text-text-secondary">
                    {u.applicationStatus || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        u.isActive === false
                          ? 'text-status-error font-semibold'
                          : 'text-status-success font-semibold'
                      }
                    >
                      {u.isActive === false ? 'Non' : 'Oui'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <p className="text-text-secondary">
          Page {page} sur {totalPages}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
            className="flex items-center gap-1 px-3 py-2 rounded-lg border border-border-light disabled:opacity-50"
          >
            <ChevronLeft size={16} /> Précédent
          </button>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || loading}
            className="flex items-center gap-1 px-3 py-2 rounded-lg border border-border-light disabled:opacity-50"
          >
            Suivant <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default UsersBackofficeTab;
