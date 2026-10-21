/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Send, Repeat, Clock, Ban } from 'lucide-react';
import { pushCampaignService } from '../../services/pushCampaignService';
import { LoadingSkeleton, EmptyState } from './StatCard';

const TARGET_LABELS = {
  ALL: 'Tous les utilisateurs',
  CLIENT: 'Clients',
  DRIVER: 'Livreurs',
  MERCHANT: 'Commerçants',
};

/**
 * ⏱️ Statuts renvoyés par le backend :
 *  SENT      = envoi unique déjà diffusé ;
 *  SCHEDULED = envoi unique programmé (cron) ;
 *  ACTIVE    = campagne récurrente en cours ;
 *  COMPLETED = récurrence terminée (arrêtée ou `endsAt` dépassé).
 */
const STATUS_LABELS = {
  SENT: { label: 'Envoyée', className: 'text-status-success' },
  SCHEDULED: { label: 'Programmée', className: 'text-status-warning' },
  ACTIVE: { label: 'Récurrente', className: 'text-accent-primary' },
  COMPLETED: { label: 'Terminée', className: 'text-text-tertiary' },
};

const RECURRENCE_LABELS = {
  NONE: 'Une seule fois',
  DAILY: 'Tous les jours',
  WEEKLY: 'Chaque semaine',
  MONTHLY: 'Chaque mois',
};

/** 0 = dimanche … 6 = samedi (même convention que le backend). */
const WEEKDAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

const emptyForm = {
  title: '',
  body: '',
  target: 'ALL',
  // 'NOW' = envoi immédiat, 'SCHEDULED' = une fois plus tard, 'RECURRING' = répété
  mode: 'NOW',
  scheduledAt: '',
  recurrence: 'DAILY',
  timeOfDay: '09:00',
  daysOfWeek: [],
  endsAt: '',
};

/** 'datetime-local' (heure locale du navigateur) → ISO, ou null si vide. */
const toIso = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

const formatDateTime = (value) =>
  value ? new Date(value).toLocaleString('fr-FR') : '—';

/**
 * Onglet Campagnes push (SUPER_ADMIN / ADMIN) : historique + envoi.
 *
 * Trois modes d'envoi :
 *  - immédiat ;
 *  - programmé une fois (`scheduledAt`) ;
 *  - récurrent (DAILY/WEEKLY/MONTHLY) — la 1ʳᵉ diffusion est planifiée,
 *    le cron rediffuse ensuite automatiquement jusqu'à `endsAt` ou un arrêt.
 *
 * ⚠️ `timeOfDay` est interprété dans le fuseau de la campagne
 * (Africa/Ouagadougou par défaut = UTC+0, l'heure locale du Burkina).
 */
const PushCampaignsTab = () => {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [sending, setSending] = useState(false);
  const [stoppingId, setStoppingId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await pushCampaignService.listCampaigns(100);
      setCampaigns(Array.isArray(data) ? data : []);
    } catch (err) {
      setCampaigns([]);
      const status = err?.response?.status;
      setError(
        status === 403
          ? 'Accès refusé : réservé aux administrateurs.'
          : 'Impossible de charger les campagnes push.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) return;
    setSending(true);
    setError('');
    setNotice('');
    try {
      const dto = {
        title: form.title.trim(),
        body: form.body.trim(),
        target: form.target,
      };

      if (form.mode === 'SCHEDULED') {
        const scheduledAt = toIso(form.scheduledAt);
        if (scheduledAt) dto.scheduledAt = scheduledAt;
      }

      if (form.mode === 'RECURRING') {
        dto.recurrence = form.recurrence;
        dto.timeOfDay = form.timeOfDay || undefined;
        if (form.recurrence === 'WEEKLY' && form.daysOfWeek.length > 0) {
          dto.daysOfWeek = form.daysOfWeek;
        }
        const scheduledAt = toIso(form.scheduledAt);
        if (scheduledAt) dto.scheduledAt = scheduledAt;
        const endsAt = toIso(form.endsAt);
        if (endsAt) dto.endsAt = endsAt;
      }

      const res = await pushCampaignService.createCampaign(dto);

      if (form.mode === 'RECURRING') {
        setNotice(
          res?.nextRunAt
            ? `Campagne récurrente créée. 1ʳᵉ diffusion : ${formatDateTime(res.nextRunAt)}.`
            : 'Campagne récurrente créée (aucune diffusion à venir — vérifie la date de fin).',
        );
      } else if (form.mode === 'SCHEDULED' || res?.status === 'SCHEDULED') {
        setNotice(
          `Campagne programmée pour le ${formatDateTime(res?.scheduledAt)}.`,
        );
      } else {
        setNotice(
          `Campagne envoyée à ${res?.recipientCount ?? 0} destinataire(s).`,
        );
      }

      setForm(emptyForm);
      await load();
    } catch (err) {
      const status = err?.response?.status;
      setError(
        status === 403
          ? 'Action refusée : tu ne peux pas envoyer de campagne.'
          : err?.response?.data?.message || "Impossible d'envoyer la campagne.",
      );
    } finally {
      setSending(false);
    }
  };

  const stop = async (campaign) => {
    setStoppingId(campaign.id);
    setError('');
    setNotice('');
    try {
      await pushCampaignService.stopCampaign(campaign.id);
      setNotice(`Campagne « ${campaign.title} » arrêtée.`);
      await load();
    } catch (err) {
      const status = err?.response?.status;
      setError(
        status === 403
          ? 'Action refusée : tu ne peux pas arrêter cette campagne.'
          : err?.response?.data?.message || "Impossible d'arrêter la campagne.",
      );
    } finally {
      setStoppingId('');
    }
  };

  const toggleWeekday = (day) => {
    setForm((prev) => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(day)
        ? prev.daysOfWeek.filter((d) => d !== day)
        : [...prev.daysOfWeek, day].sort((a, b) => a - b),
    }));
  };

  const canStop = (c) => c.status === 'ACTIVE' || c.status === 'SCHEDULED';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-text-primary">Campagnes push</h2>
          <p className="text-sm text-text-secondary">
            Envoi de notifications in-app + push FCM par public cible
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border-light hover:bg-background-secondary transition-colors text-sm"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Actualiser
        </button>
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

      <form
        onSubmit={submit}
        className="bg-background-card border border-border-light rounded-xl p-4 space-y-3"
      >
        <h3 className="font-semibold text-text-primary">Nouvelle campagne</h3>
        <input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="Titre"
          maxLength={200}
          className="w-full px-3 py-2 rounded-lg bg-background-secondary border border-border-light text-sm"
        />
        <textarea
          value={form.body}
          onChange={(e) => setForm({ ...form, body: e.target.value })}
          placeholder="Message"
          maxLength={1000}
          rows={4}
          className="w-full px-3 py-2 rounded-lg bg-background-secondary border border-border-light text-sm"
        />

        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-xs text-text-secondary">
            Cible
            <select
              value={form.target}
              onChange={(e) => setForm({ ...form, target: e.target.value })}
              className="mt-1 w-full px-3 py-2 rounded-lg bg-background-secondary border border-border-light text-sm text-text-primary"
            >
              {Object.entries(TARGET_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs text-text-secondary">
            Envoi
            <select
              value={form.mode}
              onChange={(e) => setForm({ ...form, mode: e.target.value })}
              className="mt-1 w-full px-3 py-2 rounded-lg bg-background-secondary border border-border-light text-sm text-text-primary"
            >
              <option value="NOW">Immédiat</option>
              <option value="SCHEDULED">Programmé une fois</option>
              <option value="RECURRING">Récurrent</option>
            </select>
          </label>
        </div>

        {form.mode !== 'NOW' && (
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs text-text-secondary">
              {form.mode === 'RECURRING'
                ? 'Première diffusion (optionnel)'
                : 'Date et heure de diffusion'}
              <input
                type="datetime-local"
                value={form.scheduledAt}
                onChange={(e) =>
                  setForm({ ...form, scheduledAt: e.target.value })
                }
                className="mt-1 w-full px-3 py-2 rounded-lg bg-background-secondary border border-border-light text-sm text-text-primary"
              />
            </label>
            {form.mode === 'RECURRING' && (
              <label className="text-xs text-text-secondary">
                Fin de la récurrence (optionnel)
                <input
                  type="datetime-local"
                  value={form.endsAt}
                  onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-background-secondary border border-border-light text-sm text-text-primary"
                />
              </label>
            )}
          </div>
        )}

        {form.mode === 'RECURRING' && (
          <div className="space-y-3 rounded-lg bg-background-secondary p-3">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-xs text-text-secondary">
                Fréquence
                <select
                  value={form.recurrence}
                  onChange={(e) =>
                    setForm({ ...form, recurrence: e.target.value })
                  }
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-background-card border border-border-light text-sm text-text-primary"
                >
                  <option value="DAILY">Tous les jours</option>
                  <option value="WEEKLY">Chaque semaine</option>
                  <option value="MONTHLY">Chaque mois</option>
                </select>
              </label>
              <label className="text-xs text-text-secondary">
                Heure (Ouagadougou)
                <input
                  type="time"
                  value={form.timeOfDay}
                  onChange={(e) =>
                    setForm({ ...form, timeOfDay: e.target.value })
                  }
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-background-card border border-border-light text-sm text-text-primary"
                />
              </label>
            </div>

            {form.recurrence === 'WEEKLY' && (
              <div className="text-xs text-text-secondary">
                Jours de diffusion
                <div className="mt-1 flex flex-wrap gap-2">
                  {WEEKDAYS.map((label, day) => {
                    const active = form.daysOfWeek.includes(day);
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => toggleWeekday(day)}
                        className={`px-3 py-1.5 rounded-lg border text-xs ${
                          active
                            ? 'bg-accent-primary text-white border-accent-primary'
                            : 'bg-background-card border-border-light text-text-secondary'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <p className="flex items-start gap-2 text-[11px] text-text-tertiary">
              <Repeat size={12} className="mt-0.5 shrink-0" />
              La première diffusion est planifiée (jamais immédiate) : tu peux
              l'arrêter à tout moment depuis la liste.
            </p>
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-3">
          <button
            type="submit"
            disabled={sending || !form.title.trim() || !form.body.trim()}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-accent-primary text-white text-sm disabled:opacity-50"
          >
            {form.mode === 'RECURRING' ? <Repeat size={16} /> : <Send size={16} />}
            {sending
              ? 'Enregistrement…'
              : form.mode === 'NOW'
                ? 'Envoyer'
                : form.mode === 'SCHEDULED'
                  ? 'Programmer'
                  : 'Créer la récurrence'}
          </button>
        </div>
      </form>

      <div className="bg-background-card border border-border-light rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-background-secondary text-text-secondary text-xs">
            <tr>
              <th className="text-left px-4 py-3">Titre</th>
              <th className="text-left px-4 py-3">Cible</th>
              <th className="text-left px-4 py-3">Statut</th>
              <th className="text-left px-4 py-3">Planification</th>
              <th className="text-left px-4 py-3">Destinataires</th>
              <th className="text-left px-4 py-3">Envoyée par</th>
              <th className="text-left px-4 py-3">Date</th>
              <th className="text-left px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="p-4">
                  <LoadingSkeleton height="h-10" />
                </td>
              </tr>
            ) : campaigns.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8">
                  <EmptyState
                    icon={Send}
                    title="Aucune campagne"
                    description="L'historique d'envoi apparaîtra ici."
                  />
                </td>
              </tr>
            ) : (
              campaigns.map((c) => {
                const status = STATUS_LABELS[c.status] || {
                  label: c.status || '—',
                  className: 'text-text-secondary',
                };
                const recurrence =
                  c.recurrence && c.recurrence !== 'NONE'
                    ? RECURRENCE_LABELS[c.recurrence] || c.recurrence
                    : null;
                return (
                  <tr key={c.id} className="border-t border-border-light">
                    <td className="px-4 py-3 text-text-primary font-medium">
                      {c.title}
                      <div className="text-xs text-text-secondary">{c.body}</div>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {TARGET_LABELS[c.target] || c.target}
                    </td>
                    <td className={`px-4 py-3 font-medium ${status.className}`}>
                      {status.label}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {recurrence ? (
                        <div className="flex items-center gap-1">
                          <Repeat size={12} className="shrink-0" />
                          <span>{recurrence}</span>
                        </div>
                      ) : null}
                      {c.status === 'ACTIVE' && (
                        <div className="flex items-center gap-1 text-xs">
                          <Clock size={11} className="shrink-0" />
                          <span>
                            Prochaine : {formatDateTime(c.nextRunAt)}
                          </span>
                        </div>
                      )}
                      {c.status === 'SCHEDULED' && (
                        <div className="text-xs">
                          Prévue : {formatDateTime(c.scheduledAt)}
                        </div>
                      )}
                      {c.status === 'ACTIVE' && c.endsAt ? (
                        <div className="text-xs text-text-tertiary">
                          Jusqu'au {formatDateTime(c.endsAt)}
                        </div>
                      ) : null}
                      {!recurrence && c.status !== 'ACTIVE' ? '—' : null}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {c.recipientCount ?? 0}
                      {recurrence ? (
                        <div className="text-xs text-text-tertiary">
                          {c.runCount ?? 0} envoi(s)
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {c.sentBy || '—'}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {formatDateTime(c.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      {canStop(c) ? (
                        <button
                          onClick={() => stop(c)}
                          disabled={stoppingId === c.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-status-error/40 text-status-error text-xs hover:bg-status-errorBg disabled:opacity-50"
                        >
                          <Ban size={12} />
                          {stoppingId === c.id ? 'Arrêt…' : 'Arrêter'}
                        </button>
                      ) : (
                        <span className="text-text-tertiary">—</span>
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
  );
};

export default PushCampaignsTab;
