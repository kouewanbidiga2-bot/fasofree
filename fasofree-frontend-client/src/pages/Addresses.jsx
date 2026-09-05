import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, MapPin, Plus, Trash2, Edit3, Check, Navigation, Loader2, X
} from 'lucide-react';
import { api } from '../services/api';

export default function Addresses() {
  const navigate = useNavigate();
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [form, setForm] = useState({ label: '', address: '', latitude: null, longitude: null, isDefault: false });

  useEffect(() => { loadAddresses(); }, []);

  const loadAddresses = async () => {
    try {
      setLoading(true);
      const data = await api.getAddresses();
      setAddresses(Array.isArray(data) ? data : []);
    } catch { setAddresses([]); }
    finally { setLoading(false); }
  };

  const resetForm = () => {
    setForm({ label: '', address: '', latitude: null, longitude: null, isDefault: false });
    setEditing(null);
    setShowForm(false);
  };

  const handleSave = async () => {
    if (!form.label.trim() || !form.address.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await api.updateAddress(editing.id, form);
      } else {
        await api.createAddress(form);
      }
      resetForm();
      loadAddresses();
    } catch (err) {
      alert(err.message || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer cette adresse ?')) return;
    try {
      await api.deleteAddress(id);
      loadAddresses();
    } catch (err) {
      alert(err.message || 'Erreur');
    }
  };

  const handleEdit = (addr) => {
    setForm({ label: addr.label, address: addr.address, latitude: addr.latitude, longitude: addr.longitude, isDefault: addr.isDefault });
    setEditing(addr);
    setShowForm(true);
  };

  const handleGPS = () => {
    if (!navigator.geolocation) return alert('Geolocalisation non supportee');
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm(f => ({ ...f, latitude: pos.coords.latitude, longitude: pos.coords.longitude }));
        setGpsLoading(false);
      },
      () => { alert('Impossible d\'obtenir la position'); setGpsLoading(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="min-h-screen bg-background-primary">
      <header className="sticky top-0 z-40 bg-background-primary border-b border-border-light">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-background-secondary transition-colors">
              <ArrowLeft size={18} className="text-text-primary" strokeWidth={1.5} />
            </button>
            <h1 className="text-lg font-display font-bold text-text-primary">Adresses de livraison</h1>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-3xl mx-auto">

          {/* Liste des adresses */}
          {!showForm && (
            <>
              {loading ? (
                <div className="text-center py-12">
                  <Loader2 size={24} className="animate-spin mx-auto text-accent-primary" />
                </div>
              ) : addresses.length === 0 ? (
                <div className="border border-border-light p-8 text-center">
                  <MapPin size={32} className="mx-auto mb-3 text-text-secondary" />
                  <p className="text-text-secondary text-sm mb-4">Aucune adresse enregistree</p>
                  <button
                    onClick={() => setShowForm(true)}
                    className="inline-flex items-center gap-2 bg-accent-primary text-white px-4 py-2.5 text-sm font-semibold"
                  >
                    <Plus size={14} />
                    Ajouter une adresse
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {addresses.map((addr) => (
                    <div key={addr.id} className={`border p-4 ${addr.isDefault ? 'border-accent-primary' : 'border-border-light'}`}>
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 flex items-center justify-center flex-shrink-0 ${addr.isDefault ? 'bg-accent-primary/10' : 'bg-background-secondary'}`}>
                          <MapPin size={14} className={addr.isDefault ? 'text-accent-primary' : 'text-text-secondary'} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-text-primary">{addr.label}</p>
                            {addr.isDefault && (
                              <span className="px-1.5 py-0.5 bg-accent-primary/10 text-accent-primary text-[10px] font-bold">Par defaut</span>
                            )}
                          </div>
                          <p className="text-xs text-text-secondary mt-0.5 truncate">{addr.address}</p>
                          {addr.latitude && addr.longitude && (
                            <p className="text-[10px] text-text-secondary mt-1">
                              GPS: {addr.latitude.toFixed(4)}, {addr.longitude.toFixed(4)}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleEdit(addr)} className="p-2 hover:bg-background-secondary transition-colors">
                            <Edit3 size={14} className="text-text-secondary" />
                          </button>
                          <button onClick={() => handleDelete(addr.id)} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                            <Trash2 size={14} className="text-red-500" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  <button
                    onClick={() => setShowForm(true)}
                    className="w-full border border-dashed border-border-medium p-4 text-center text-text-secondary text-sm hover:border-accent-primary hover:text-accent-primary transition-colors"
                  >
                    <Plus size={16} className="inline mr-2" />
                    Ajouter une adresse
                  </button>
                </div>
              )}
            </>
          )}

          {/* Formulaire */}
          {showForm && (
            <div className="border border-border-light p-4 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-text-primary">
                  {editing ? 'Modifier l\'adresse' : 'Nouvelle adresse'}
                </h2>
                <button onClick={resetForm} className="p-1 hover:bg-background-secondary transition-colors">
                  <X size={16} className="text-text-secondary" />
                </button>
              </div>

              <div>
                <label className="block text-xs text-text-secondary mb-1.5">Label</label>
                <div className="flex gap-2">
                  {['Domicile', 'Bureau', 'Chez mes parents', 'Autre'].map((l) => (
                    <button
                      key={l}
                      onClick={() => setForm(f => ({ ...f, label: l }))}
                      className={`px-3 py-1.5 text-xs font-medium border transition-colors ${
                        form.label === l
                          ? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
                          : 'border-border-light text-text-secondary hover:border-border-medium'
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                {form.label === 'Autre' && (
                  <input
                    type="text"
                    placeholder="Ex: Chez Amadou"
                    value={form.label === 'Autre' ? '' : form.label}
                    onChange={(e) => setForm(f => ({ ...f, label: e.target.value }))}
                    className="w-full mt-2 px-3 py-2.5 bg-background-secondary border border-border-light text-sm text-text-primary"
                    autoFocus
                  />
                )}
              </div>

              <div>
                <label className="block text-xs text-text-secondary mb-1.5">Adresse complete</label>
                <textarea
                  placeholder="Ex: Ouaga 2000, Zone 4, Lot 12, a cote de la pharmacie"
                  value={form.address}
                  onChange={(e) => setForm(f => ({ ...f, address: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2.5 bg-background-secondary border border-border-light text-sm text-text-primary resize-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleGPS}
                  disabled={gpsLoading}
                  className="inline-flex items-center gap-2 px-3 py-2 border border-border-light text-xs text-text-secondary hover:border-accent-primary hover:text-accent-primary transition-colors disabled:opacity-50"
                >
                  {gpsLoading ? <Loader2 size={12} className="animate-spin" /> : <Navigation size={12} />}
                  Utiliser ma position GPS
                </button>
                {form.latitude && form.longitude && (
                  <span className="text-[10px] text-green-600 flex items-center gap-1">
                    <Check size={10} />
                    Position enregistree
                  </span>
                )}
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={(e) => setForm(f => ({ ...f, isDefault: e.target.checked }))}
                  className="w-4 h-4 accent-accent-primary"
                />
                <span className="text-xs text-text-secondary">Definir comme adresse par defaut</span>
              </label>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={resetForm}
                  className="flex-1 border border-border-light py-2.5 text-sm font-medium text-text-secondary hover:bg-background-secondary transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !form.label.trim() || !form.address.trim()}
                  className="flex-1 bg-accent-primary text-white py-2.5 text-sm font-semibold disabled:opacity-50"
                >
                  {saving ? <Loader2 size={16} className="animate-spin mx-auto" /> : (editing ? 'Enregistrer' : 'Ajouter')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
