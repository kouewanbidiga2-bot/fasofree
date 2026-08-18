import { useState, useEffect } from 'react';
import { ArrowLeft, Save, Store, MapPin, Phone, Tag, Truck, Package, UtensilsCrossed, Power, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const CATEGORIES = [
  { value: 'RESTAURANT', label: 'Restaurant' },
  { value: 'SUPERMARKET', label: 'Supermarché' },
  { value: 'PHARMACY', label: 'Pharmacie' },
  { value: 'RETAIL', label: 'Commerce général' },
  { value: 'BAKERY', label: 'Boulangerie' },
  { value: 'SERVICES', label: 'Services' },
];

function Switch({ checked, onChange, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? 'bg-accent-primary' : 'bg-background-secondary'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-subtle transition-transform duration-200 ease-in-out ${
          checked ? 'translate-x-5.5' : 'translate-x-0.5'
        }`}
        style={{ transform: checked ? 'translateX(22px)' : 'translateX(2px)' }}
      />
    </button>
  );
}

function FormSection({ title, children }) {
  return (
    <div className="bg-background-card rounded-xl shadow-subtle p-5 space-y-4">
      <h2 className="font-display text-lg font-semibold text-text-primary">{title}</h2>
      {children}
    </div>
  );
}

function FieldRow({ icon: Icon, label, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="flex items-center gap-2 text-sm font-medium text-text-secondary">
        <Icon size={16} />
        {label}
      </label>
      {children}
    </div>
  );
}

export default function MerchantSettings() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [businessId, setBusinessId] = useState(null);

  const [form, setForm] = useState({
    name: '',
    address: '',
    phone: '',
    category: 'RESTAURANT',
    enableDelivery: false,
    enablePickup: false,
    enableDineIn: false,
    isOpen: false,
  });

  useEffect(() => {
    async function load() {
      try {
        const business = await api.getMyBusiness();
        setBusinessId(business.id);
        setForm({
          name: business.name || '',
          address: business.address || '',
          phone: business.phone || '',
          category: business.category || 'RESTAURANT',
          enableDelivery: business.enableDelivery || false,
          enablePickup: business.enablePickup || false,
          enableDineIn: business.enableDineIn || false,
          isOpen: business.isOpen || false,
        });
      } catch {
        setFeedback({ type: 'error', message: 'Impossible de charger les paramètres.' });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (feedback) setFeedback(null);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!businessId) return;
    setSaving(true);
    setFeedback(null);
    try {
      await api.updateBusiness(businessId, form);
      setFeedback({ type: 'success', message: 'Paramètres enregistrés avec succès.' });
    } catch {
      setFeedback({ type: 'error', message: 'Une erreur est survenue lors de la sauvegarde.' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background-primary">
        <Loader2 className="animate-spin text-accent-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-primary pb-24">
      <div className="sticky top-0 z-30 bg-background-card border-b border-border-light shadow-subtle">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-background-secondary transition-colors"
          >
            <ArrowLeft size={20} className="text-text-primary" />
          </button>
          <h1 className="font-display text-xl font-bold text-text-primary">
            Paramètres du commerce
          </h1>
        </div>
      </div>

      <form onSubmit={handleSave} className="max-w-lg mx-auto px-4 pt-6 space-y-6">
        <FormSection title="Informations">
          <FieldRow icon={Store} label="Nom du commerce">
            <input
              type="text"
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              placeholder="Mon Commerce"
              required
              className="w-full rounded-lg border border-border-light bg-background-primary px-3 py-2.5 text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent-primary transition-shadow"
            />
          </FieldRow>

          <FieldRow icon={MapPin} label="Adresse">
            <input
              type="text"
              value={form.address}
              onChange={(e) => setField('address', e.target.value)}
              placeholder="123 rue de la Paix, 75001 Paris"
              required
              className="w-full rounded-lg border border-border-light bg-background-primary px-3 py-2.5 text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent-primary transition-shadow"
            />
          </FieldRow>

          <FieldRow icon={Phone} label="Téléphone">
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setField('phone', e.target.value)}
              placeholder="01 23 45 67 89"
              required
              className="w-full rounded-lg border border-border-light bg-background-primary px-3 py-2.5 text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent-primary transition-shadow"
            />
          </FieldRow>

          <FieldRow icon={Tag} label="Catégorie">
            <select
              value={form.category}
              onChange={(e) => setField('category', e.target.value)}
              className="w-full rounded-lg border border-border-light bg-background-primary px-3 py-2.5 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary transition-shadow appearance-none"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </FieldRow>
        </FormSection>

        <FormSection title="Modes de service">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-text-primary">
                <Truck size={18} className="text-text-secondary" />
                Livraison
              </span>
              <Switch
                checked={form.enableDelivery}
                onChange={(v) => setField('enableDelivery', v)}
              />
            </div>

            <div className="h-px bg-border-light" />

            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-text-primary">
                <Package size={18} className="text-text-secondary" />
                À emporter
              </span>
              <Switch
                checked={form.enablePickup}
                onChange={(v) => setField('enablePickup', v)}
              />
            </div>

            <div className="h-px bg-border-light" />

            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-text-primary">
                <UtensilsCrossed size={18} className="text-text-secondary" />
                Sur place
              </span>
              <Switch
                checked={form.enableDineIn}
                onChange={(v) => setField('enableDineIn', v)}
              />
            </div>
          </div>
        </FormSection>

        <FormSection title="Statut">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-text-primary">
              <Power size={18} className="text-text-secondary" />
              {form.isOpen ? 'Commerce ouvert' : 'Commerce fermé'}
            </span>
            <Switch
              checked={form.isOpen}
              onChange={(v) => setField('isOpen', v)}
            />
          </div>
        </FormSection>

        {feedback && (
          <div
            className={`rounded-lg px-4 py-3 text-sm font-medium ${
              feedback.type === 'success'
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
            }`}
          >
            {feedback.message}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 bg-accent-primary text-white font-semibold py-3 rounded-xl shadow-subtle hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <Loader2 size={20} className="animate-spin" />
          ) : (
            <Save size={20} />
          )}
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </form>
    </div>
  );
}
