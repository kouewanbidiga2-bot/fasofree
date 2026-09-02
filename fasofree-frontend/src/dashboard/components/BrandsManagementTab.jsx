import React, { useState, useEffect, useCallback } from 'react';
import {
  Store, Plus, Trash2, ChevronDown, ChevronRight, MapPin,
  Phone, CheckCircle, XCircle, Loader2, Edit2, Navigation
} from 'lucide-react';
import { StatusBadge } from './StatCard';
import {
  getBrands,
  createBrand,
  updateBrand,
  deleteBrand,
  getBrandBranches,
  createBranch,
  updateBranch,
  deleteBranch,
  seedChitirChicken,
} from '../../services/subscriptionService';

const BrandsManagementTab = () => {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [expandedBrand, setExpandedBrand] = useState(null);
  const [branches, setBranches] = useState({});

  // Brand form
  const [showBrandForm, setShowBrandForm] = useState(false);
  const [brandForm, setBrandForm] = useState({ name: '', description: '', logoUrl: '' });
  const [editingBrand, setEditingBrand] = useState(null);

  // Branch form
  const [showBranchForm, setShowBranchForm] = useState(false);
  const [branchForm, setBranchForm] = useState({
    name: '',
    address: '',
    phone: '',
    latitude: '',
    longitude: '',
  });
  const [editingBranch, setEditingBranch] = useState(null);
  const [activeBrandId, setActiveBrandId] = useState(null);

  const [busy, setBusy] = useState(null);

  const loadBrands = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getBrands();
      setBrands(Array.isArray(data) ? data : []);
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }, []);

  const loadBranches = useCallback(async (brandId) => {
    try {
      const data = await getBrandBranches(brandId);
      setBranches((prev) => ({ ...prev, [brandId]: Array.isArray(data) ? data : [] }));
    } catch (err) {
      setMsg({ type: 'error', text: `Erreur chargement agences: ${err.message}` });
    }
  }, []);

  useEffect(() => {
    loadBrands();
  }, [loadBrands]);

  const handleToggleBrand = (brandId) => {
    if (expandedBrand === brandId) {
      setExpandedBrand(null);
    } else {
      setExpandedBrand(brandId);
      if (!branches[brandId]) {
        loadBranches(brandId);
      }
    }
  };

  // Brand CRUD
  const handleCreateBrand = async (e) => {
    e.preventDefault();
    setBusy('brand');
    setMsg(null);
    try {
      await createBrand(brandForm);
      setMsg({ type: 'success', text: 'Marque créée.' });
      setShowBrandForm(false);
      setBrandForm({ name: '', description: '', logoUrl: '' });
      await loadBrands();
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setBusy(null);
    }
  };

  const handleUpdateBrand = async (e) => {
    e.preventDefault();
    setBusy('brand');
    setMsg(null);
    try {
      await updateBrand(editingBrand.id, brandForm);
      setMsg({ type: 'success', text: 'Marque mise à jour.' });
      setShowBrandForm(false);
      setEditingBrand(null);
      setBrandForm({ name: '', description: '', logoUrl: '' });
      await loadBrands();
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setBusy(null);
    }
  };

  const handleDeleteBrand = async (id, name) => {
    if (!window.confirm(`Supprimer la marque "${name}" et toutes ses agences ?`)) return;
    setBusy(id);
    setMsg(null);
    try {
      await deleteBrand(id);
      setMsg({ type: 'success', text: `Marque "${name}" supprimée.` });
      await loadBrands();
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setBusy(null);
    }
  };

  // Branch CRUD
  const handleOpenBranchForm = (brandId) => {
    setActiveBrandId(brandId);
    setEditingBranch(null);
    setBranchForm({ name: '', address: '', phone: '', latitude: '', longitude: '' });
    setShowBranchForm(true);
  };

  const handleEditBranch = (branch) => {
    setEditingBranch(branch);
    setActiveBrandId(branch.brandId);
    setBranchForm({
      name: branch.name || '',
      address: branch.address || '',
      phone: branch.phone || '',
      latitude: branch.latitude?.toString() || '',
      longitude: branch.longitude?.toString() || '',
    });
    setShowBranchForm(true);
  };

  const handleCreateBranch = async (e) => {
    e.preventDefault();
    setBusy('branch');
    setMsg(null);
    try {
      await createBranch(activeBrandId, {
        ...branchForm,
        latitude: parseFloat(branchForm.latitude) || undefined,
        longitude: parseFloat(branchForm.longitude) || undefined,
      });
      setMsg({ type: 'success', text: 'Agence créée.' });
      setShowBranchForm(false);
      await loadBranches(activeBrandId);
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setBusy(null);
    }
  };

  const handleUpdateBranch = async (e) => {
    e.preventDefault();
    setBusy('branch');
    setMsg(null);
    try {
      await updateBranch(editingBranch.id, {
        ...branchForm,
        latitude: parseFloat(branchForm.latitude) || undefined,
        longitude: parseFloat(branchForm.longitude) || undefined,
      });
      setMsg({ type: 'success', text: 'Agence mise à jour.' });
      setShowBranchForm(false);
      setEditingBranch(null);
      await loadBranches(activeBrandId);
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setBusy(null);
    }
  };

  const handleDeleteBranch = async (brandId, branchId, name) => {
    if (!window.confirm(`Supprimer l'agence "${name}" ?`)) return;
    setBusy(branchId);
    setMsg(null);
    try {
      await deleteBranch(branchId);
      setMsg({ type: 'success', text: `Agence "${name}" supprimée.` });
      await loadBranches(brandId);
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setBusy(null);
    }
  };

  const handleSeedChitirChicken = async () => {
    if (!window.confirm('Seed Chitir Chicken ? Cela crée la marque, 3 agences et le menu.'));
    setBusy('seed');
    setMsg(null);
    try {
      await seedChitirChicken();
      setMsg({ type: 'success', text: 'Chitir Chicken seedé avec succès (3 agences + 10 plats).' });
      await loadBrands();
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-text-primary">Marques & Agences</h2>
          <p className="text-text-secondary text-sm">
            Gérer les marques (enseignes) et leurs agences (branches).
            Chaque agence est un point de livraison avec sa propre géolocalisation.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSeedChitirChicken}
            disabled={busy === 'seed'}
            className="btn-secondary text-xs flex items-center gap-1"
          >
            {busy === 'seed' ? <Loader2 size={12} className="animate-spin" /> : <Store size={12} />}
            Seed Chitir Chicken
          </button>
          <button
            onClick={() => {
              setShowBrandForm(true);
              setEditingBrand(null);
              setBrandForm({ name: '', description: '', logoUrl: '' });
            }}
            className="btn-primary text-xs flex items-center gap-1"
          >
            <Plus size={14} /> Nouvelle Marque
          </button>
        </div>
      </div>

      {msg && (
        <div className={`p-3 rounded-lg border text-sm ${
          msg.type === 'success'
            ? 'bg-status-successBg border-status-success/30 text-status-success'
            : 'bg-status-errorBg border-status-error/30 text-status-error'
        }`}>
          {msg.text}
        </div>
      )}

      {/* Brand Form Modal */}
      {showBrandForm && (
        <div className="card p-4 border border-accent-primary/30">
          <h3 className="text-sm font-bold text-text-primary mb-3">
            {editingBrand ? 'Modifier la marque' : 'Créer une marque'}
          </h3>
          <form onSubmit={editingBrand ? handleUpdateBrand : handleCreateBrand} className="space-y-3">
            <input
              type="text"
              placeholder="Nom de la marque"
              value={brandForm.name}
              onChange={(e) => setBrandForm((p) => ({ ...p, name: e.target.value }))}
              className="input-field w-full"
              required
            />
            <input
              type="text"
              placeholder="Description (optionnel)"
              value={brandForm.description}
              onChange={(e) => setBrandForm((p) => ({ ...p, description: e.target.value }))}
              className="input-field w-full"
            />
            <input
              type="text"
              placeholder="URL du logo (optionnel)"
              value={brandForm.logoUrl}
              onChange={(e) => setBrandForm((p) => ({ ...p, logoUrl: e.target.value }))}
              className="input-field w-full"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy === 'brand'}
                className="btn-primary text-xs flex items-center gap-1"
              >
                {busy === 'brand' ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                {editingBrand ? 'Mettre à jour' : 'Créer'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowBrandForm(false);
                  setEditingBrand(null);
                }}
                className="btn-secondary text-xs"
              >
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Branch Form Modal */}
      {showBranchForm && (
        <div className="card p-4 border border-accent-primary/30">
          <h3 className="text-sm font-bold text-text-primary mb-3">
            {editingBranch ? 'Modifier l\'agence' : 'Ajouter une agence'}
          </h3>
          <form onSubmit={editingBranch ? handleUpdateBranch : handleCreateBranch} className="space-y-3">
            <input
              type="text"
              placeholder="Nom de l'agence (ex: Chitir Chicken - Kamboinsin)"
              value={branchForm.name}
              onChange={(e) => setBranchForm((p) => ({ ...p, name: e.target.value }))}
              className="input-field w-full"
              required
            />
            <input
              type="text"
              placeholder="Adresse"
              value={branchForm.address}
              onChange={(e) => setBranchForm((p) => ({ ...p, address: e.target.value }))}
              className="input-field w-full"
              required
            />
            <input
              type="text"
              placeholder="Téléphone"
              value={branchForm.phone}
              onChange={(e) => setBranchForm((p) => ({ ...p, phone: e.target.value }))}
              className="input-field w-full"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                step="any"
                placeholder="Latitude"
                value={branchForm.latitude}
                onChange={(e) => setBranchForm((p) => ({ ...p, latitude: e.target.value }))}
                className="input-field w-full"
              />
              <input
                type="number"
                step="any"
                placeholder="Longitude"
                value={branchForm.longitude}
                onChange={(e) => setBranchForm((p) => ({ ...p, longitude: e.target.value }))}
                className="input-field w-full"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy === 'branch'}
                className="btn-primary text-xs flex items-center gap-1"
              >
                {busy === 'branch' ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                {editingBranch ? 'Mettre à jour' : 'Créer'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowBranchForm(false);
                  setEditingBranch(null);
                }}
                className="btn-secondary text-xs"
              >
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Brands List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-accent-primary" />
        </div>
      ) : brands.length === 0 ? (
        <div className="card p-8 text-center">
          <Store size={40} className="mx-auto text-text-tertiary mb-3" />
          <p className="text-text-secondary text-sm">Aucune marque enregistrée.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {brands.map((brand) => {
            const isExpanded = expandedBrand === brand.id;
            const brandBranches = branches[brand.id] || [];
            return (
              <div key={brand.id} className="card overflow-hidden">
                {/* Brand Header */}
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-background-secondary/50 transition-colors"
                  onClick={() => handleToggleBrand(brand.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-background-secondary flex items-center justify-center">
                      {brand.logoUrl ? (
                        <img src={brand.logoUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Store size={20} className="text-text-tertiary" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-text-primary text-sm">{brand.name}</p>
                      <p className="text-text-secondary text-xs">{brand.description || 'Pas de description'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-text-secondary">
                      {brandBranches.length || brand.businesses?.length || 0} agence(s)
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingBrand(brand);
                        setBrandForm({
                          name: brand.name,
                          description: brand.description || '',
                          logoUrl: brand.logoUrl || '',
                        });
                        setShowBrandForm(true);
                      }}
                      className="btn-icon text-text-secondary hover:text-accent-primary"
                      title="Modifier"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteBrand(brand.id, brand.name);
                      }}
                      disabled={busy === brand.id}
                      className="btn-icon text-status-error hover:bg-status-errorBg"
                      title="Supprimer"
                    >
                      <Trash2 size={14} />
                    </button>
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </div>
                </div>

                {/* Branches (expanded) */}
                {isExpanded && (
                  <div className="border-t border-border-light p-4 bg-background-secondary/30">
                    <div className="flex justify-between items-center mb-3">
                      <p className="text-xs font-bold text-text-secondary uppercase">Agences</p>
                      <button
                        onClick={() => handleOpenBranchForm(brand.id)}
                        className="btn-secondary text-xs flex items-center gap-1"
                      >
                        <Plus size={12} /> Ajouter une agence
                      </button>
                    </div>
                    {brandBranches.length === 0 ? (
                      <p className="text-text-tertiary text-xs text-center py-4">
                        Aucune agence. Ajoutez la première agence de cette marque.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {brandBranches.map((branch) => (
                          <div
                            key={branch.id}
                            className="bg-background-card rounded-lg p-3 border border-border-light"
                          >
                            <div className="flex justify-between items-start mb-2">
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-text-primary text-sm truncate">{branch.name}</p>
                                <div className="flex items-center gap-1 text-text-secondary text-xs mt-1">
                                  <MapPin size={10} />
                                  <span className="truncate">{branch.address}</span>
                                </div>
                                {branch.phone && (
                                  <div className="flex items-center gap-1 text-text-secondary text-xs mt-0.5">
                                    <Phone size={10} />
                                    <span>{branch.phone}</span>
                                  </div>
                                )}
                              </div>
                              <div className="flex gap-1 ml-2">
                                <button
                                  onClick={() => handleEditBranch(branch)}
                                  className="btn-icon text-text-secondary hover:text-accent-primary"
                                  title="Modifier"
                                >
                                  <Edit2 size={12} />
                                </button>
                                <button
                                  onClick={() => handleDeleteBranch(brand.id, branch.id, branch.name)}
                                  disabled={busy === branch.id}
                                  className="btn-icon text-status-error hover:bg-status-errorBg"
                                  title="Supprimer"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                            <div className="flex items-center justify-between mt-2 pt-2 border-t border-border-light">
                              <div className="flex items-center gap-1 text-xs text-text-secondary">
                                <Navigation size={10} />
                                <span className="font-mono">
                                  {branch.latitude?.toFixed(4)}, {branch.longitude?.toFixed(4)}
                                </span>
                              </div>
                              <StatusBadge status={branch.isOpen ? 'active' : 'inactive'} statusConfig={{
                                active: { label: 'Ouvert', color: 'success', dot: '#22C55E' },
                                inactive: { label: 'Fermé', color: 'gray', dot: '#A09890' },
                              }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default BrandsManagementTab;
