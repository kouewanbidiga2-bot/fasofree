import React, { useCallback, useEffect, useState } from 'react';
import { Building2, RefreshCw, Plus, Save } from 'lucide-react';
import {
  getAgencies,
  createAgency,
  updateAgency,
} from '../../services/agencyService';
import { LoadingSkeleton, EmptyState } from './StatCard';

const emptyForm = {
  name: '',
  phone: '',
  email: '',
  zones: '',
  commissionPct: 10,
  maxConcurrentDeliveries: 0,
  isActive: true,
  userId: '',
};

/**
 * Onglet Agences partenaires (ADMIN/SUPER_ADMIN en gestion, SUPPORT en lecture).
 */
const AgenciesTab = ({ canManage = false }) => {
  const [agencies, setAgencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getAgencies();
      setAgencies(Array.isArray(data) ? data : []);
    } catch (err) {
      setAgencies([]);
      const status = err?.response?.status;
      setError(
        status === 403
          ? 'Accès en lecture seule : tu ne peux pas gérer les agences.'
          : 'Impossible de charger les agences.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onEdit = (agency) => {
    setEditingId(agency.id);
    setForm({
      name: agency.name || '',
      phone: agency.phone || '',
      email: agency.email || '',
      zones: Array.isArray(agency.zones) ? agency.zones.join(', ') : '',
      commissionPct: Number(agency.commissionPct ?? 10),
      maxConcurrentDeliveries: Number(agency.maxConcurrentDeliveries ?? 0),
      isActive: agency.isActive !== false,
      userId: agency.userId || '',
    });
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!canManage) return;
    if (!form.name.trim()) {
      setError("Le nom de l'agence est obligatoire.");
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');
    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        zones: form.zones
          .split(',')
          .map((z) => z.trim())
          .filter(Boolean),
        commissionPct: Number(form.commissionPct),
        maxConcurrentDeliveries: Number(form.maxConcurrentDeliveries),
        isActive: form.isActive,
        userId: form.userId.trim() || undefined,
      };

      if (editingId) {
        await updateAgency(editingId, payload);
        setNotice('Agence mise à jour.');
      } else {
        await createAgency(payload);
        setNotice('Agence créée.');
      }
      resetForm();
      await load();
    } catch (err) {
      const status = err?.response?.status;
      setError(
        status === 403
          ? 'Action refusée : droits de gestion insuffisants.'
          : err?.response?.data?.message || "Impossible d'enregistrer l'agence.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-text-primary">Agences de livraison</h2>
          <p className="text-sm text-text-secondary">
            {agencies.length} agence(s) partenaire(s)
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-background-card border border-border-light rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-background-secondary text-text-secondary text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3">Nom</th>
                <th className="text-left px-4 py-3">Zones</th>
                <th className="text-left px-4 py-3">Commission</th>
                <th className="text-left px-4 py-3">Max</th>
                <th className="text-left px-4 py-3">Actif</th>
                {canManage && <th className="text-right px-4 py-3">Action</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={canManage ? 6 : 5} className="p-4">
                    <LoadingSkeleton height="h-10" />
                  </td>
                </tr>
              ) : agencies.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 6 : 5} className="p-8">
                    <EmptyState
                      icon={Building2}
                      title="Aucune agence"
                      description="Les agences validées apparaîtront ici."
                    />
                  </td>
                </tr>
              ) : (
                agencies.map((a) => (
                  <tr key={a.id} className="border-t border-border-light">
                    <td className="px-4 py-3 text-text-primary font-medium">
                      {a.name}
                      {a.email && (
                        <div className="text-xs text-text-secondary">{a.email}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {Array.isArray(a.zones) && a.zones.length
                        ? a.zones.join(', ')
                        : 'National'}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {Number(a.commissionPct ?? 0)}%
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {a.maxConcurrentDeliveries && a.maxConcurrentDeliveries > 0
                        ? a.maxConcurrentDeliveries
                        : 'Illimité'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          a.isActive === false
                            ? 'text-status-error font-semibold'
                            : 'text-status-success font-semibold'
                        }
                      >
                        {a.isActive === false ? 'Non' : 'Oui'}
                      </span>
                    </td>
                    {canManage && (
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => onEdit(a)}
                          className="px-3 py-1 rounded-lg border border-border-light text-xs"
                        >
                          Modifier
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {canManage && (
          <form
            onSubmit={onSubmit}
            className="bg-background-card border border-border-light rounded-xl p-4 space-y-3"
          >
            <div className="flex items-center gap-2">
              <Plus size={16} className="text-text-secondary" />
              <h3 className="font-semibold text-text-primary">
                {editingId ? 'Modifier une agence' : 'Nouvelle agence'}
              </h3>
            </div>

            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Nom de l'agence"
              className="w-full px-3 py-2 rounded-lg bg-background-secondary border border-border-light text-sm"
            />
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="Téléphone"
              className="w-full px-3 py-2 rounded-lg bg-background-secondary border border-border-light text-sm"
            />
            <input
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="Email"
              className="w-full px-3 py-2 rounded-lg bg-background-secondary border border-border-light text-sm"
            />
            <input
              value={form.zones}
              onChange={(e) => setForm({ ...form, zones: e.target.value })}
              placeholder="Zones : Ouagadougou, Bobo"
              className="w-full px-3 py-2 rounded-lg bg-background-secondary border border-border-light text-sm"
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-text-secondary mb-1">
                  Commission %
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={form.commissionPct}
                  onChange={(e) =>
                    setForm({ ...form, commissionPct: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-background-secondary border border-border-light text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1">
                  Max simultanées
                </label>
                <input
                  type="number"
                  min="0"
                  value={form.maxConcurrentDeliveries}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      maxConcurrentDeliveries: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-background-secondary border border-border-light text-sm"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              />
              Active
            </label>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-accent-primary text-white text-sm disabled:opacity-50"
              >
                <Save size={16} />
                {saving ? 'Enregistrement…' : editingId ? 'Mettre à jour' : 'Créer'}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 rounded-lg border border-border-light text-sm"
                >
                  Annuler
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default AgenciesTab;
