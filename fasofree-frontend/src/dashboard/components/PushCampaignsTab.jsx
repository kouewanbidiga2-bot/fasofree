import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Send } from 'lucide-react';
import { pushCampaignService } from '../../services/pushCampaignService';
import { LoadingSkeleton, EmptyState } from './StatCard';

const TARGET_LABELS = {
  ALL: 'Tous les utilisateurs',
  CLIENT: 'Clients',
  DRIVER: 'Livreurs',
  MERCHANT: 'Commerçants',
};

/**
 * Onglet Campagnes push (SUPER_ADMIN / ADMIN) : historique + envoi.
 */
const PushCampaignsTab = () => {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState({
    title: '',
    body: '',
    target: 'ALL',
  });
  const [sending, setSending] = useState(false);

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
      const res = await pushCampaignService.createCampaign({
        title: form.title.trim(),
        body: form.body.trim(),
        target: form.target,
      });
      setNotice(
        `Campagne envoyée à ${res?.recipientCount ?? 0} destinataire(s).`,
      );
      setForm({ title: '', body: '', target: 'ALL' });
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-text-primary">Campagnes push</h2>
          <p className="text-sm text-text-secondary">
            Envoi de notifications FCM par public cible
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
        <div className="flex flex-col md:flex-row gap-3">
          <select
            value={form.target}
            onChange={(e) => setForm({ ...form, target: e.target.value })}
            className="px-3 py-2 rounded-lg bg-background-secondary border border-border-light text-sm"
          >
            {Object.entries(TARGET_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={sending || !form.title.trim() || !form.body.trim()}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-accent-primary text-white text-sm disabled:opacity-50"
          >
            <Send size={16} />
            {sending ? 'Envoi…' : 'Envoyer'}
          </button>
        </div>
      </form>

      <div className="bg-background-card border border-border-light rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-background-secondary text-text-secondary text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3">Titre</th>
              <th className="text-left px-4 py-3">Cible</th>
              <th className="text-left px-4 py-3">Destinataires</th>
              <th className="text-left px-4 py-3">Envoyée par</th>
              <th className="text-left px-4 py-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="p-4">
                  <LoadingSkeleton height="h-10" />
                </td>
              </tr>
            ) : campaigns.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8">
                  <EmptyState
                    icon={Send}
                    title="Aucune campagne"
                    description="L'historique d'envoi apparaîtra ici."
                  />
                </td>
              </tr>
            ) : (
              campaigns.map((c) => (
                <tr key={c.id} className="border-t border-border-light">
                  <td className="px-4 py-3 text-text-primary font-medium">
                    {c.title}
                    <div className="text-xs text-text-secondary">{c.body}</div>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    {TARGET_LABELS[c.target] || c.target}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    {c.recipientCount ?? 0}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    {c.sentBy || '—'}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    {c.createdAt
                      ? new Date(c.createdAt).toLocaleString('fr-FR')
                      : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PushCampaignsTab;
