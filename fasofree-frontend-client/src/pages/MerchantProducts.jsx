import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Package,
  ToggleLeft,
  ToggleRight,
  X,
  Loader2,
  Image,
  DollarSign,
  Hash,
  Tag,
} from 'lucide-react';
import { api } from '../services/api';
import { getAbsoluteImageUrl, onImgError } from '../utils/images';

const CATEGORIES = [
  'Burgers',
  'Sandwiches',
  'Plats',
  'Salades',
  'Poulet Frit',
  'Boissons',
  'Desserts',
  'Grillades',
  'Plats Chauds',
  'Menus',
  'GENERAL',
];

const formatPrice = (price) => {
  return new Intl.NumberFormat('fr-BF', {
    style: 'currency',
    currency: 'XOF',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price || 0);
};

const EMPTY_FORM = {
  name: '',
  description: '',
  price: '',
  category: 'GENERAL',
  imageUrl: '',
  stockQuantity: '',
  isAvailable: true,
};

export default function MerchantProducts() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [businessId, setBusinessId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState('');

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      const business = await api.getMyBusiness();
      const bid = business?.id || business?.businessId;
      setBusinessId(bid);
      if (bid) {
        const data = await api.getBusinessProducts(bid);
        setProducts(Array.isArray(data) ? data : data?.products || []);
      }
    } catch (err) {
      console.error('Failed to load products', err);
      setError('Impossible de charger les produits.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const openAddModal = () => {
    setEditingProduct(null);
    setForm(EMPTY_FORM);
    setError('');
    setModalOpen(true);
  };

  const openEditModal = (product) => {
    setEditingProduct(product);
    setForm({
      name: product.name || '',
      description: product.description || '',
      price: product.price || '',
      category: product.category || 'GENERAL',
      imageUrl: product.imageUrl || '',
      stockQuantity: product.stockQuantity ?? '',
      isAvailable: product.isAvailable ?? true,
    });
    setError('');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingProduct(null);
    setForm(EMPTY_FORM);
    setError('');
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.price) {
      setError('Le nom et le prix sont obligatoires.');
      return;
    }

    setSubmitting(true);
    setError('');

    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      price: Number(form.price),
      category: form.category,
      imageUrl: form.imageUrl.trim(),
      stockQuantity: Number(form.stockQuantity) || 0,
      isAvailable: form.isAvailable,
    };

    try {
      if (editingProduct) {
        await api.updateProduct(editingProduct.id, payload);
      } else {
        await api.createProduct({ ...payload, businessId });
      }
      await loadProducts();
      closeModal();
    } catch (err) {
      setError(err.message || "Une erreur est survenue lors de l'enregistrement.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (product) => {
    try {
      await api.toggleProductAvailability(product.id);
      setProducts((prev) =>
        prev.map((p) =>
          p.id === product.id ? { ...p, isAvailable: !p.isAvailable } : p
        )
      );
    } catch (err) {
      console.error('Toggle failed', err);
    }
  };

  const handleDelete = async (product) => {
    if (!window.confirm(`Supprimer « ${product.name} » ? Cette action est irréversible.`)) {
      return;
    }
    setDeletingId(product.id);
    try {
      await api.deleteProduct(product.id);
      setProducts((prev) => prev.filter((p) => p.id !== product.id));
    } catch (err) {
      console.error('Delete failed', err);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background-primary">
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 bg-background-primary border-b border-border-light">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(-1)}
                className="p-2 hover:bg-background-secondary transition-colors rounded-lg"
              >
                <ArrowLeft size={18} className="text-text-primary" strokeWidth={1.5} />
              </button>
              <div className="flex items-center gap-2">
                <Package size={20} className="text-accent-primary" strokeWidth={1.5} />
                <h1 className="text-lg font-display font-bold text-text-primary">Mes Produits</h1>
              </div>
            </div>
            <button
              onClick={openAddModal}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-accent-primary text-white hover:opacity-90 transition-opacity shadow-subtle"
            >
              <Plus size={16} strokeWidth={2} />
              <span className="hidden sm:inline">Ajouter un produit</span>
              <span className="sm:hidden">Ajouter</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-text-secondary">
            <Loader2 size={32} className="animate-spin mb-3" strokeWidth={1.5} />
            <p className="text-sm">Chargement des produits…</p>
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-background-secondary flex items-center justify-center mb-4">
              <Package size={28} className="text-text-secondary" strokeWidth={1.5} />
            </div>
            <h2 className="text-lg font-display font-semibold text-text-primary mb-1">
              Aucun produit
            </h2>
            <p className="text-sm text-text-secondary mb-6 max-w-xs">
              Vous n'avez pas encore ajouté de produit à votre catalogue.
            </p>
            <button
              onClick={openAddModal}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg bg-accent-primary text-white hover:opacity-90 transition-opacity"
            >
              <Plus size={16} strokeWidth={2} />
              Ajouter un produit
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {products.map((product) => (
              <div
                key={product.id}
                className={`rounded-xl border bg-background-card overflow-hidden shadow-subtle transition-all hover:shadow-md ${
                  product.isAvailable ? 'border-border-light' : 'border-border-medium opacity-75'
                }`}
              >
                {/* Image */}
                <div className="relative h-44 bg-background-secondary overflow-hidden">
                  {product.imageUrl ? (
                    <img
                      src={getAbsoluteImageUrl(product.imageUrl)}
                      alt={product.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={onImgError}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-text-secondary">
                      <Image size={32} strokeWidth={1} />
                      <span className="text-xs mt-1">Pas d'image</span>
                    </div>
                  )}
                  {!product.isAvailable && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <span className="text-white text-xs font-semibold bg-black/50 px-3 py-1 rounded-full">
                        Indisponible
                      </span>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-display font-semibold text-text-primary text-sm leading-tight line-clamp-2">
                      {product.name}
                    </h3>
                  </div>

                  <p className="text-accent-primary font-bold text-base mb-2">
                    {formatPrice(product.price)}
                  </p>

                  {product.description && (
                    <p className="text-xs text-text-secondary line-clamp-2 mb-3">
                      {product.description}
                    </p>
                  )}

                  <div className="flex items-center gap-2 flex-wrap mb-3">
                    {product.category && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-background-secondary text-text-secondary">
                        <Tag size={10} strokeWidth={1.5} />
                        {product.category}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-background-secondary text-text-secondary">
                      <Hash size={10} strokeWidth={1.5} />
                      {product.stockQuantity ?? 0} en stock
                    </span>
                  </div>

                  {/* Actions row */}
                  <div className="flex items-center justify-between pt-3 border-t border-border-light">
                    <button
                      onClick={() => handleToggle(product)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium transition-colors"
                      title={
                        product.isAvailable ? 'Désactiver la disponibilité' : 'Activer la disponibilité'
                      }
                    >
                      {product.isAvailable ? (
                        <>
                          <ToggleRight size={20} className="text-green-500" strokeWidth={1.5} />
                          <span className="text-green-600">Disponible</span>
                        </>
                      ) : (
                        <>
                          <ToggleLeft size={20} className="text-text-secondary" strokeWidth={1.5} />
                          <span className="text-text-secondary">Éteint</span>
                        </>
                      )}
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(product)}
                        className="p-2 rounded-lg hover:bg-background-secondary text-text-secondary hover:text-text-primary transition-colors"
                        title="Modifier"
                      >
                        <Pencil size={15} strokeWidth={1.5} />
                      </button>
                      <button
                        onClick={() => handleDelete(product)}
                        disabled={deletingId === product.id}
                        className="p-2 rounded-lg hover:bg-red-50 text-text-secondary hover:text-red-500 transition-colors disabled:opacity-50"
                        title="Supprimer"
                      >
                        {deletingId === product.id ? (
                          <Loader2 size={15} className="animate-spin" strokeWidth={1.5} />
                        ) : (
                          <Trash2 size={15} strokeWidth={1.5} />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/50" onClick={closeModal} />

          {/* Modal */}
          <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-background-card rounded-2xl border border-border-light shadow-lg">
            {/* Modal Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-background-card border-b border-border-light">
              <h2 className="text-base font-display font-bold text-text-primary">
                {editingProduct ? 'Modifier le produit' : 'Ajouter un produit'}
              </h2>
              <button
                onClick={closeModal}
                className="p-1.5 rounded-lg hover:bg-background-secondary text-text-secondary transition-colors"
              >
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              {error && (
                <div className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
                  {error}
                </div>
              )}

              {/* Name */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">
                  <Package size={12} strokeWidth={1.5} />
                  Nom du produit *
                </label>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Ex: Burger Classic"
                  required
                  className="w-full px-3 py-2.5 text-sm rounded-lg border border-border-light bg-background-primary text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent-primary transition-colors"
                />
              </div>

              {/* Description */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">
                  Description
                </label>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Décrivez votre produit…"
                  className="w-full px-3 py-2.5 text-sm rounded-lg border border-border-light bg-background-primary text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent-primary transition-colors resize-none"
                />
              </div>

              {/* Price + Category row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">
                    <DollarSign size={12} strokeWidth={1.5} />
                    Prix (FCFA) *
                  </label>
                  <input
                    type="number"
                    name="price"
                    value={form.price}
                    onChange={handleChange}
                    placeholder="0"
                    min="0"
                    required
                    className="w-full px-3 py-2.5 text-sm rounded-lg border border-border-light bg-background-primary text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent-primary transition-colors"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">
                    <Tag size={12} strokeWidth={1.5} />
                    Catégorie
                  </label>
                  <select
                    name="category"
                    value={form.category}
                    onChange={handleChange}
                    className="w-full px-3 py-2.5 text-sm rounded-lg border border-border-light bg-background-primary text-text-primary focus:outline-none focus:border-accent-primary transition-colors appearance-none"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Image URL */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">
                  <Image size={12} strokeWidth={1.5} />
                  URL de l'image
                </label>
                <input
                  type="url"
                  name="imageUrl"
                  value={form.imageUrl}
                  onChange={handleChange}
                  placeholder="https://exemple.com/image.jpg"
                  className="w-full px-3 py-2.5 text-sm rounded-lg border border-border-light bg-background-primary text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent-primary transition-colors"
                />
                {form.imageUrl && (
                  <div className="mt-2 w-full h-32 rounded-lg overflow-hidden border border-border-light bg-background-secondary">
                    <img
                      src={getAbsoluteImageUrl(form.imageUrl)}
                      alt="Aperçu"
                      className="w-full h-full object-cover"
                      onError={(e) => (e.target.style.display = 'none')}
                    />
                  </div>
                )}
              </div>

              {/* Stock + Availability row */}
              <div className="grid grid-cols-2 gap-3 items-end">
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">
                    <Hash size={12} strokeWidth={1.5} />
                    Stock
                  </label>
                  <input
                    type="number"
                    name="stockQuantity"
                    value={form.stockQuantity}
                    onChange={handleChange}
                    placeholder="0"
                    min="0"
                    className="w-full px-3 py-2.5 text-sm rounded-lg border border-border-light bg-background-primary text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent-primary transition-colors"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">
                    Disponibilité
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({ ...prev, isAvailable: !prev.isAvailable }))
                    }
                    className="inline-flex items-center gap-2 px-3 py-2.5 text-sm font-medium rounded-lg border border-border-light bg-background-primary hover:bg-background-secondary transition-colors w-full"
                  >
                    {form.isAvailable ? (
                      <>
                        <ToggleRight size={20} className="text-green-500" strokeWidth={1.5} />
                        <span className="text-text-primary">Disponible</span>
                      </>
                    ) : (
                      <>
                        <ToggleLeft size={20} className="text-text-secondary" strokeWidth={1.5} />
                        <span className="text-text-secondary">Indisponible</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <div className="flex items-center gap-3 pt-2 pb-1">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold rounded-lg border border-border-light text-text-secondary hover:bg-background-secondary transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg bg-accent-primary text-white hover:opacity-90 transition-opacity disabled:opacity-50 shadow-subtle"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={15} className="animate-spin" strokeWidth={2} />
                      Enregistrement…
                    </>
                  ) : editingProduct ? (
                    'Mettre à jour'
                  ) : (
                    'Ajouter'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
