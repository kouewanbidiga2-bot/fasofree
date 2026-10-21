/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Send, Repeat, Clock, Ban, Wallet } from 'lucide-react';
import { selfServicePushCampaignService } from '../../services/selfServicePushCampaignService';
import { LoadingSkeleton, EmptyState } from './StatCard';
import WalletTopupButton from './WalletTopupButton';

/**
 * 💳 Campagnes push AUTO-SERVICE (marchand / agence) — Lots 3 et 3.1.
 *
 * Composant PARTAGÉ : `role="merchant"` (espace commerçant) ou
 * `role="agency"` (espace agence). Les deux diffèrent par l'audience
 * autorisée et le préfixe d'API.
 *
 * Règles produit reflétées ici :
 *  - le prix est PAR ENVOI, pas par destinataire, et dépend de l'AUDIENCE
 *    (grille réglée par le Super Admin, donc lue depuis l'API) ;
 *  - une campagne récurrente est facturée à CHAQUE diffusion ;
 *  - le ciblage anti-spam interdit de viser toute la base : un marchand
 *    atteint ses clients (ou tous les clients, au tarif premium), une agence
 *    ses livreurs, les clients qu'elle a livrés, ou tous les clients (premium).
 *
 * ⚠️ `timeOfDay` est interprété dans le fuseau de la campagne
 * (Africa/Ouagadougou par défaut = heure locale du Burkina).
 */

const AUDIENCES = {
  merchant: [
    { value: 'OWN_CLIENTS', label: 'Mes clients (ceux qui ont commandé)' },
    { value: 'ALL_CLIENTS', label: 'Tous les clients FasoFree (premium)' },
  ],
  agency: [
    { value: 'OWN_DRIVERS', label: 'Mes livreurs' },
    { value: 'OWN_CLIENTS', label: 'Les clients que j’ai livrés' },
    { value: 'ALL_CLIENTS', label: 'Tous les clients FasoFree (premium)' },
  ],
};

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

const AUDIENCE_LABELS = {
  ALL: 'Toute la base',
  ALL_CLIENTS: 'Tous les clients',
  OWN_CLIENTS: 'Mes clients',
  OWN_DRIVERS: 'Mes livreurs',
};

/** 0 = dimanche … 6 = samedi (même convention que le backend). */
const WEEKDAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

/** 'datetime-local' (heure locale du navigateur) → ISO, ou null si vide. */
const toIso = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

const formatDateTime = (value) =>
  value ? new Date(value).toLocaleString('fr-FR') : '—';

const SelfServicePushCampaigns = ({ role = 'merchant' }) => {
  const [campaigns, setCampaigns] = useState([]);
  /** Grille { audience: prixFCFA } renvoyée par l'API (réglée par le Super Admin). */
  const [pricing, setPricing] = useState(null);
  const [unitPrice, setUnitPrice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [sending, setSending] = useState(false);
  const [stoppingId, setStoppingId] = useState('');
  const initialAudience = AUDIENCES[role]?.[0]?.value ?? 'ALL_CLIENTS';
  const [form, setForm] = useState({
    title: '',
    body: '',
    audience: initialAudience,
    mode: 'NOW',
    scheduledAt: '',
    recurrence: 'DAILY',
    timeOfDay: '09:00',
    daysOfWeek: [],
    endsAt: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [data, pricingPayload] = await Promise.all([
        selfServicePushCampaignService.list(role, 100),
        selfServicePushCampaignService.pricing(role).catch(() => null),
      ]);
      setCampaigns(Array.isArray(data) ? data : []);
      if (
        pricingPayload &&
        Number.isFinite(Number(pricingPayload.unitPriceXof))
      ) {
        setUnitPrice(Number(pricingPayload.unitPriceXof));
      }
      if (pricingPayload?.pricing && typeof pricingPayload.pricing === 'object') {
        setPricing(pricingPayload.pricing);
      }
    } catch (err) {
      setCampaigns([]);
      const status = err?.response?.status;
      setError(
        status === 403
          ? "Accès refusé : ce compte n'est pas autorisé à envoyer des campagnes."
          : 'Impossible de charger vos campagnes push.',
      );
    } finally {
      setLoading(false);
    }
  }, [role]);

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
        audience: form.audience,
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

      const res = await selfServicePushCampaignService.create(role, dto);

      if (form.mode === 'RECURRING') {
        setNotice(
          res?.nextRunAt
            ? `Campagne récurrente créée. 1ʳᵉ diffusion : ${formatDateTime(res.nextRunAt)} (facturée à chaque envoi).`
            : 'Campagne récurrente créée, mais aucune diffusion à venir — vérifie la date de fin.',
        );
      } else if (res?.status === 'SCHEDULED') {
        setNotice(
          `Campagne programmée pour le ${formatDateTime(res.scheduledAt)}. Le montant sera débité à l'envoi.`,
        );
      } else {
        setNotice(
          `Campagne envoyée à ${res?.recipientCount ?? 0} destinataire(s) — ${res?.billedXof ?? 0} FCFA débités.`,
        );
      }

      setForm((prev) => ({ ...prev, title: '', body: '' }));
      await load();
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          "Impossible d'envoyer la campagne. Vérifie ton solde.",
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
      await selfServicePushCampaignService.stop(role, campaign.id);
      setNotice(`Campagne « ${campaign.title} » arrêtée.`);
      await load();
    } catch (err) {
      setError(
        err?.response?.data?.message || "Impossible d'arrêter cette campagne.",
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

  /** Prix d'un envoi pour une audience : grille du dashboard, sinon prix de base. */
  const priceForAudience = (audience) => {
    const fromGrid = pricing?.[audience];
    if (Number.isFinite(Number(fromGrid))) return Number(fromGrid);
    return unitPrice;
  };
  const selectedPrice = priceForAudience(form.audience);
  const priceLabel = Number.isFinite(Number(selectedPrice))
    ? `${selectedPrice} FCFA`
    : '—';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-text-primary">
            Campagnes push
          </h2>
          <p className="text-sm text-text-secondary">
            Envoyez une notification (cloche + push) à votre audience.
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

      <div className="rounded-lg bg-accent-primary/5 border border-accent-primary/20 p-3 text-sm text-text-secondary">
        <div className="flex items-start gap-2">
          <Wallet size={16} className="mt-0.5 shrink-0 text-accent-primary" />
          <span>
            <strong className="text-text-primary">
              {priceLabel} par campagne envoyée
            </strong>{' '}
            pour l'audience choisie — débité de votre portefeuille, jamais par
            destinataire. Une campagne récurrente est facturée à chaque
            diffusion.
            {form.audience === 'ALL_CLIENTS' &&
              " L'audience « tous les clients » est facturée au tarif premium : réservez-la aux annonces importantes."}
          </span>
        </div>
        {/* 💳 Recharge directe : sans solde, aucune campagne ne peut partir. */}
        <div className="mt-2 pl-6">
          <WalletTopupButton label="Recharger mon portefeuille" />
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
            Audience
            <select
              value={form.audience}
              onChange={(e) => setForm({ ...form, audience: e.target.value })}
              className="mt-1 w-full px-3 py-2 rounded-lg bg-background-secondary border border-border-light text-sm text-text-primary"
            >
              {(AUDIENCES[role] ?? AUDIENCES.merchant).map((a) => {
                const price = priceForAudience(a.value);
                return (
                  <option key={a.value} value={a.value}>
                    {Number.isFinite(Number(price))
                      ? `${a.label} — ${price} F`
                      : a.label}
                  </option>
                );
              })}
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
              La 1ʳᵉ diffusion est planifiée (jamais immédiate). Chaque
              diffusion est facturée ; en cas de solde insuffisant, la campagne
              est suspendue et vous êtes prévenu.
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={sending || !form.title.trim() || !form.body.trim()}
          className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-accent-primary text-white text-sm disabled:opacity-50"
        >
          {form.mode === 'RECURRING' ? <Repeat size={16} /> : <Send size={16} />}
          {sending
            ? 'Enregistrement…'
            : form.mode === 'NOW'
              ? `Envoyer (${priceLabel})`
              : form.mode === 'SCHEDULED'
                ? 'Programmer'
                : 'Créer la récurrence'}
        </button>
      </form>

      <div className="bg-background-card border border-border-light rounded-xl overflow-hidden">
        {/* Scroll interne : le wrapper overflow-hidden rognait la colonne
            « Action » sur téléphone (7 colonnes) — désormais elle reste
            accessible sans faire glisser la page. */}
        <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-background-secondary text-text-secondary text-xs">
            <tr>
              <th className="text-left px-4 py-3">Titre</th>
              <th className="text-left px-4 py-3">Audience</th>
              <th className="text-left px-4 py-3">Statut</th>
              <th className="text-left px-4 py-3">Planification</th>
              <th className="text-left px-4 py-3">Destinataires</th>
              <th className="text-left px-4 py-3">Facturé</th>
              <th className="text-left px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="p-4">
                  <LoadingSkeleton height="h-10" />
                </td>
              </tr>
            ) : campaigns.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8">
                  <EmptyState
                    icon={Send}
                    title="Aucune campagne"
                    description="Vos envois apparaîtront ici."
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
                      <div className="text-xs text-text-secondary">
                        {c.body}
                      </div>
                      {c.failureReason ? (
                        <div className="text-xs text-status-error mt-1">
                          {c.failureReason}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {AUDIENCE_LABELS[c.audience] || c.audience || '—'}
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
                      {!recurrence && c.status !== 'ACTIVE' && c.status !== 'SCHEDULED'
                        ? '—'
                        : null}
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
                      {c.billedXof ?? 0} FCFA
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
    </div>
  );
};

export default SelfServicePushCampaigns;
