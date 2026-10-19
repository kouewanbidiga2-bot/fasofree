import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Gavel,
  RefreshCw,
  ShieldOff,
} from 'lucide-react';
import {
  createPenalty,
  getAvailableDrivers,
  getQualityOverview,
  revokePenalty,
} from '../../services/penaltyService';
import { getAgencies } from '../../services/agencyService';
import { LoadingSkeleton, EmptyState } from './StatCard';

/**
 * ⚖️ Onglet « Qualité livraisons » (bloc C).
 *
 * Monté à l'identique chez SUPER_ADMIN, ADMIN et SUPPORT : mêmes droits
 * côté API, donc même écran — un composant partagé garantit qu'une
 * correction profite aux trois rôles au lieu de diverger.
 *
 * Répond aux trois crans de sanction :
 *  ① avertissement          — posé AUTOMATIQUEMENT sur livraison en retard
 *  ② baisse de priorité     — décision humaine, impacte le scoring dispatch
 *  ③ suspension temporaire  — décision humaine, exclut du dispatch
 *
 * Aucune suppression : une sanction se révoque (`active = false`) ou expire.
 * L'historique reste consultable, une contestation peut être levée.
 */

const LEVELS = [
  {
    value: 'WARNING',
    label: '① Avertissement',
    hint: 'Trace seule, sans effet technique sur le dispatch',
    cls: 'bg-status-warningBg text-status-warning',
  },
  {
    value: 'PRIORITY_DOWNGRADE',
    label: '② Baisse de priorité',
    hint: 'Passe après ses équivalents au dispatch (sans être exclu)',
    cls: 'bg-status-warningBg text-status-warning',
  },
  {
    value: 'SUSPENSION',
    label: '③ Suspension temporaire',
    hint: 'Exclu du dispatch jusqu\u2019à la date de fin',
    cls: 'bg-status-errorBg text-status-error',
  },
];

const levelMeta = (value) =>
  LEVELS.find((l) => l.value === value) || {
    value,
    label: value,
    hint: '',
    cls: 'bg-border-light text-text-secondary',
  };

const fmtDate = (value) =>
  value
    ? new Date(value).toLocaleString('fr-FR', {
        dateStyle: 'short',
        timeStyle: 'short',
      })
    : '—';

const fmtMinutes = (value) =>
  value == null ? '—' : `${Math.round(Number(value))} min`;

const emptyForm = {
  targetType: 'DRIVER',
  driverId: '',
  agencyId: '',
  level: 'PRIORITY_DOWNGRADE',
  reason: '',
  durationDays: 7,
};

const DeliveryQualityTab = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Fenêtre + filtres de la vue
  const [days, setDays] = useState(7);
  const [filterTarget, setFilterTarget] = useState('');
  const [filterActive, setFilterActive] = useState(false);

  // Formulaire de sanction
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);
  // Commande rattachée : renseignée en cliquant « Sanctionner » sur un retard
  // (on a alors le vrai UUID). Jamais saisie à la main : un UUID tapé de
  // mémoire produirait un 400 opaque au lieu d'un geste utile.
  const [linkedOrder, setLinkedOrder] = useState(null);

  const [drivers, setDrivers] = useState([]);
  const [agencies, setAgencies] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await getQualityOverview({
        days,
        targetType: filterTarget || undefined,
        activeOnly: filterActive || undefined,
      });
      setData(result);
    } catch (err) {
      setData(null);
      const status = err?.response?.status;
      setError(
        status === 403
          ? 'Accès refusé : cet écran est réservé aux administrateurs et au support.'
          : err?.response?.data?.message ||
              'Impossible de charger le tableau de bord qualité.',
      );
    } finally {
      setLoading(false);
    }
  }, [days, filterTarget, filterActive]);

  useEffect(() => {
    load();
  }, [load]);

  // Sélecteurs de cible : chargés une seule fois. Un échec n'est pas bloquant
  // (on peut toujours consulter et révoquer), donc pas de remontée d'erreur.
  useEffect(() => {
    (async () => {
      try {
        const [driverData, agencyData] = await Promise.all([
          getAvailableDrivers().catch(() => []),
          getAgencies().catch(() => []),
        ]);
        setDrivers(Array.isArray(driverData) ? driverData : []);
        setAgencies(Array.isArray(agencyData) ? agencyData : []);
      } catch {
        setDrivers([]);
        setAgencies([]);
      }
    })();
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    if (form.targetType === 'DRIVER' && !form.driverId) {
      setError('Sélectionne le livreur à sanctionner.');
      return;
    }
    if (form.targetType === 'AGENCY' && !form.agencyId) {
      setError('Sélectionne la société de livraison à sanctionner.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        targetType: form.targetType,
        driverId: form.targetType === 'DRIVER' ? form.driverId : undefined,
        agencyId: form.targetType === 'AGENCY' ? form.agencyId : undefined,
        orderId: linkedOrder?.id || undefined,
        level: form.level,
        reason: form.reason.trim() || undefined,
      };
      // Seule une suspension a besoin d'un terme explicite ici : les autres
      // niveaux restent jusqu'à révocation (le backend applique 7 jours par
      // défaut à une suspension si on ne précise rien, on le rend explicite).
      if (form.level === 'SUSPENSION' && Number(form.durationDays) > 0) {
        payload.effectiveUntil = new Date(
          Date.now() + Number(form.durationDays) * 24 * 60 * 60 * 1000,
        ).toISOString();
      }

      await createPenalty(payload);
      setNotice(`${levelMeta(form.level).label} appliqué avec succès.`);
      setForm((prev) => ({
        ...prev,
        driverId: '',
        agencyId: '',
        reason: '',
      }));
      setLinkedOrder(null);
      await load();
    } catch (err) {
      const status = err?.response?.status;
      setError(
        status === 403
          ? 'Action refusée : droits insuffisants.'
          : err?.response?.data?.message ||
              "Impossible d'appliquer la sanction.",
      );
    } finally {
      setSaving(false);
    }
  };

  const onRevoke = async (penalty) => {
    setBusyId(penalty.id);
    setError('');
    setNotice('');
    try {
      await revokePenalty(penalty.id);
      setNotice(`Sanction levée pour ${penalty.targetName}.`);
      await load();
    } catch (err) {
      setError(
        err?.response?.data?.message || 'Impossible de révoquer la sanction.',
      );
    } finally {
      setBusyId(null);
    }
  };

  // Pré-remplit le formulaire depuis une ligne de retard : la cible et
  // l'UUID de commande sont alors exacts, sans saisie manuelle.
  const onSanctionLate = (row) => {
    setError('');
    setNotice(
      `Commande ${row.ref} sélectionnée — choisis le niveau puis applique.`,
    );
    setLinkedOrder({ id: row.id, ref: row.ref });
    setForm((prev) => ({
      ...prev,
      targetType: row.driverId ? 'DRIVER' : 'AGENCY',
      driverId: row.driverId || '',
      agencyId: row.agencyId || '',
    }));
  };

  const counts = data?.counts || {
    warning: 0,
    priorityDowngrade: 0,
    suspension: 0,
    totalActive: 0,
  };
  const sla = data?.sla || {
    deliveries: 0,
    lateDeliveries: 0,
    lateRate: 0,
    averageEtaMinutes: null,
    averageDurationMinutes: null,
  };
  const penalties = data?.penalties || [];
  const lateDeliveries = data?.lateDeliveries || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-text-primary">
            Qualité des livraisons
          </h2>
          <p className="text-sm text-text-secondary">
            {counts.totalActive} sanction(s) active(s) · sur les{' '}
            {data?.window?.days ?? days} derniers jours
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="px-3 py-2 rounded-lg bg-background-secondary border border-border-light text-sm"
          >
            <option value={1}>24 h</option>
            <option value={7}>7 jours</option>
            <option value={30}>30 jours</option>
            <option value={90}>90 jours</option>
          </select>
          <button
            onClick={load}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border-light hover:bg-background-secondary transition-colors text-sm"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Actualiser
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-status-errorBg border border-status-error/30 rounded-lg p-4 text-sm text-status-error">
          {error}
        </div>
      )}
      {notice && (
        <div className="bg-status-successBg border border-status-success/30 rounded-lg p-4 text-sm text-status-success">
          {notice}
        </div>
      )}

      {/* ── Indicateurs ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-background-card border border-border-light rounded-xl p-4">
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <AlertTriangle size={14} />
            Avertissements
          </div>
          <p className="text-2xl font-bold text-text-primary mt-1">
            {counts.warning}
          </p>
        </div>
        <div className="bg-background-card border border-border-light rounded-xl p-4">
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <Gavel size={14} />
            Priorité baissée
          </div>
          <p className="text-2xl font-bold text-text-primary mt-1">
            {counts.priorityDowngrade}
          </p>
        </div>
        <div className="bg-background-card border border-border-light rounded-xl p-4">
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <ShieldOff size={14} />
            Suspensions
          </div>
          <p className="text-2xl font-bold text-text-primary mt-1">
            {counts.suspension}
          </p>
        </div>
        <div className="bg-background-card border border-border-light rounded-xl p-4">
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <Clock size={14} />
            Retards observés
          </div>
          <p className="text-2xl font-bold text-text-primary mt-1">
            {sla.lateDeliveries}
            <span className="text-sm font-normal text-text-secondary">
              {' '}
              / {sla.deliveries}
            </span>
          </p>
          <p className="text-xs text-text-secondary mt-0.5">
            {(Number(sla.lateRate || 0) * 100).toFixed(1)} % des livraisons
          </p>
        </div>
        <div className="bg-background-card border border-border-light rounded-xl p-4">
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <Clock size={14} />
            Durée moyenne
          </div>
          <p className="text-2xl font-bold text-text-primary mt-1">
            {fmtMinutes(sla.averageDurationMinutes)}
          </p>
          <p className="text-xs text-text-secondary mt-0.5">
            ETA estimée : {fmtMinutes(sla.averageEtaMinutes)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Tableau des sanctions ─────────────────────────────── */}
        <div className="lg:col-span-2 bg-background-card border border-border-light rounded-xl overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-border-light">
            <h3 className="font-semibold text-text-primary">Sanctions</h3>
            <div className="flex items-center gap-3 text-xs">
              <select
                value={filterTarget}
                onChange={(e) => setFilterTarget(e.target.value)}
                className="px-2 py-1 rounded-lg bg-background-secondary border border-border-light text-xs"
              >
                <option value="">Toutes les cibles</option>
                <option value="DRIVER">Livreurs</option>
                <option value="AGENCY">Sociétés</option>
              </select>
              <label className="flex items-center gap-1 text-text-secondary">
                <input
                  type="checkbox"
                  checked={filterActive}
                  onChange={(e) => setFilterActive(e.target.checked)}
                />
                Actives seulement
              </label>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-background-secondary text-text-secondary text-xs">
                <tr>
                  <th className="text-left px-4 py-3">Cible</th>
                  <th className="text-left px-4 py-3">Niveau</th>
                  <th className="text-left px-4 py-3">Motif</th>
                  <th className="text-left px-4 py-3">Commande</th>
                  <th className="text-left px-4 py-3">Fin</th>
                  <th className="text-right px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading && !data ? (
                  <tr>
                    <td colSpan={6} className="p-4">
                      <LoadingSkeleton height="h-10" />
                    </td>
                  </tr>
                ) : penalties.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8">
                      <EmptyState
                        icon={CheckCircle}
                        title="Aucune sanction sur la période"
                        description="Les avertissements automatiques (retard) et les décisions manuelles apparaîtront ici."
                      />
                    </td>
                  </tr>
                ) : (
                  penalties.map((p) => {
                    const meta = levelMeta(p.level);
                    return (
                      <tr key={p.id} className="border-t border-border-light">
                        <td className="px-4 py-3">
                          <div className="font-medium text-text-primary">
                            {p.targetName}
                          </div>
                          <div className="text-xs text-text-secondary">
                            {p.targetType === 'DRIVER'
                              ? 'Livreur'
                              : 'Société de livraison'}
                            {p.targetPhone ? ` · ${p.targetPhone}` : ''}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${meta.cls}`}
                          >
                            {meta.label}
                          </span>
                          {p.automatic && (
                            <div className="text-[10px] text-text-secondary mt-1">
                              automatique
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-text-secondary max-w-[220px]">
                          <span className="line-clamp-2">{p.reason || '—'}</span>
                        </td>
                        <td className="px-4 py-3 text-text-secondary">
                          {p.orderRef || '—'}
                        </td>
                        <td className="px-4 py-3 text-text-secondary">
                          {p.revoked
                            ? 'Révoquée'
                            : p.effectiveUntil
                              ? fmtDate(p.effectiveUntil)
                              : 'Jusqu\u2019à révocation'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {p.active ? (
                            <button
                              onClick={() => onRevoke(p)}
                              disabled={busyId === p.id}
                              className="px-3 py-1 rounded-lg border border-border-light text-xs hover:bg-background-secondary disabled:opacity-50"
                            >
                              {busyId === p.id ? 'Révocation…' : 'Révoquer'}
                            </button>
                          ) : (
                            <span className="text-xs text-text-secondary">
                              {p.revoked ? 'clôturée' : 'expirée'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Appliquer une sanction ───────────────────────────── */}
        <form
          onSubmit={onSubmit}
          className="bg-background-card border border-border-light rounded-xl p-4 space-y-3 h-fit"
        >
          <div className="flex items-center gap-2">
            <Gavel size={16} className="text-text-secondary" />
            <h3 className="font-semibold text-text-primary">
              Appliquer une sanction
            </h3>
          </div>

          <div className="flex gap-2">
            {['DRIVER', 'AGENCY'].map((type) => (
              <button
                key={type}
                type="button"
                onClick={() =>
                  setForm({ ...form, targetType: type })
                }
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                  form.targetType === type
                    ? 'bg-accent-primary text-white border-accent-primary'
                    : 'border-border-light text-text-secondary'
                }`}
              >
                {type === 'DRIVER' ? 'Livreur' : 'Société'}
              </button>
            ))}
          </div>

          {form.targetType === 'DRIVER' ? (
            <select
              value={form.driverId}
              onChange={(e) => setForm({ ...form, driverId: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-background-secondary border border-border-light text-sm"
            >
              <option value="">Choisir un livreur…</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                  {d.phone ? ` — ${d.phone}` : ''}
                </option>
              ))}
            </select>
          ) : (
            <select
              value={form.agencyId}
              onChange={(e) => setForm({ ...form, agencyId: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-background-secondary border border-border-light text-sm"
            >
              <option value="">Choisir une société…</option>
              {agencies.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          )}

          <select
            value={form.level}
            onChange={(e) => setForm({ ...form, level: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-background-secondary border border-border-light text-sm"
          >
            {LEVELS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-text-secondary -mt-1">
            {levelMeta(form.level).hint}
          </p>

          {form.level === 'SUSPENSION' && (
            <div>
              <label className="block text-xs text-text-secondary mb-1">
                Durée de la suspension (jours)
              </label>
              <input
                type="number"
                min="1"
                max="365"
                value={form.durationDays}
                onChange={(e) =>
                  setForm({ ...form, durationDays: e.target.value })
                }
                className="w-full px-3 py-2 rounded-lg bg-background-secondary border border-border-light text-sm"
              />
            </div>
          )}

          <textarea
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
            rows={2}
            placeholder="Motif (sans donnée personnelle du client)"
            className="w-full px-3 py-2 rounded-lg bg-background-secondary border border-border-light text-sm"
          />

          {linkedOrder && (
            <div className="flex items-center justify-between gap-2 rounded-lg bg-background-secondary px-3 py-2 text-xs text-text-secondary">
              <span>Rattachée à la commande {linkedOrder.ref}</span>
              <button
                type="button"
                onClick={() => setLinkedOrder(null)}
                className="underline"
              >
                retirer
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-accent-primary text-white text-sm disabled:opacity-50"
          >
            <Gavel size={16} />
            {saving ? 'Application…' : 'Appliquer'}
          </button>

          <p className="text-[11px] text-text-secondary">
            Les avertissements de retard sont posés automatiquement. Les
            niveaux ② et ③ impactent réellement le dispatch : baisse de
            priorité au scoring, suspension = exclusion temporaire.
          </p>
        </form>
      </div>

      {/* ── Retards observés ──────────────────────────────────── */}
      <div className="bg-background-card border border-border-light rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border-light">
          <h3 className="font-semibold text-text-primary">
            Livraisons en retard
          </h3>
          <p className="text-xs text-text-secondary">
            Retard constaté au-delà de +25 % de l&apos;ETA estimée (départ
            effectif de la course). Cliquez « Sanctionner » pour rattacher une
            décision à la commande.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-background-secondary text-text-secondary text-xs">
              <tr>
                <th className="text-left px-4 py-3">Commande</th>
                <th className="text-left px-4 py-3">Commerce</th>
                <th className="text-left px-4 py-3">Livré par</th>
                <th className="text-left px-4 py-3">ETA</th>
                <th className="text-left px-4 py-3">Durée réelle</th>
                <th className="text-left px-4 py-3">Retard</th>
                <th className="text-left px-4 py-3">Livrée le</th>
                <th className="text-right px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && !data ? (
                <tr>
                  <td colSpan={8} className="p-4">
                    <LoadingSkeleton height="h-10" />
                  </td>
                </tr>
              ) : lateDeliveries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8">
                    <EmptyState
                      icon={CheckCircle}
                      title="Aucun retard sur la période"
                      description="Toutes les livraisons terminées respectent la tolérance."
                    />
                  </td>
                </tr>
              ) : (
                lateDeliveries.map((row) => (
                  <tr key={row.id} className="border-t border-border-light">
                    <td className="px-4 py-3 text-text-primary font-medium">
                      {row.ref}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {row.businessName || '—'}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {row.driverName || row.agencyName || '—'}
                      {row.agencyName && row.driverName ? (
                        <div className="text-xs">{row.agencyName}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {fmtMinutes(row.etaMinutes)}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {fmtMinutes(row.durationMinutes)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-semibold text-status-error">
                        {row.lateMinutes == null
                          ? '—'
                          : `+${Math.round(row.lateMinutes)} min`}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {fmtDate(row.deliveredAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => onSanctionLate(row)}
                        className="px-3 py-1 rounded-lg border border-border-light text-xs hover:bg-background-secondary"
                      >
                        Sanctionner
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DeliveryQualityTab;
