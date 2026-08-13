/**
 * FasoFree — Dashboard Commerçant (business_admin)
 * Données 100% réelles depuis l'API backend
 * Onglets: Vue d'ensemble | Produits | Commandes | Paramètres
 */
import React, { useState, useEffect, useCallback } from 'react';
// ✅ CORRECT
import { useNavigate, useLocation, useParams, Link } from 'react-router-dom';
import {
  LayoutDashboard, Package, ShoppingCart, Settings, LogOut,
  TrendingUp, Users, Wallet, Plus, Pencil, Trash2, ToggleLeft,
  ToggleRight, RefreshCw, AlertCircle, ChevronDown, X, Check,
  ArrowUpRight, Clock, Star,
} from 'lucide-react';
import useAuthStore from '../store/authStore';
import { getBusinessAnalytics } from '../services/analyticsService';
import { getMyOrders, updateOrderStatus, getStatusInfo, ORDER_STATUS } from '../services/orderService';
import {
  getProductsByBusiness, createProduct, updateProduct,
  deleteProduct, toggleProductAvailability,
} from '../services/productService';
import { getWallet } from '../services/walletService';

// ─── Composant Badge Statut ─────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const info = getStatusInfo(status);
  const cls = {
    success: 'badge-completed',
    warning: 'badge-pending',
    info: 'badge-paid',
    processing: 'badge-preparation',
    error: 'badge-cancelled',
  };
  return <span className={cls[info.color] || 'badge'}>{info.label}</span>;
};

// ─── Skeleton loader ────────────────────────────────────────────────────
const Skeleton = ({ className = '' }) => (
  <div className={`skeleton rounded-md ${className}`} />
);

// ─── Stat Card ──────────────────────────────────────────────────────────
const StatCard = ({ label, value, icon: Icon, trend, color, loading }) => (
  <div className="stat-card animate-slide-up">
    <div className="flex items-start justify-between mb-4">
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center"
        style={{ background: `${color}20`, border: `1px solid ${color}30` }}
      >
        <Icon size={18} style={{ color }} strokeWidth={1.5} />
      </div>
      {trend !== undefined && (
        <span className="text-xs font-semibold text-status-success flex items-center gap-0.5">
          <ArrowUpRight size={12} /> {trend}%
        </span>
      )}
    </div>
    <p className="text-text-secondary text-xs font-semibold uppercase tracking-wider mb-1">{label}</p>
    {loading ? (
      <Skeleton className="h-7 w-24 mt-1" />
    ) : (
      <p className="text-xl font-bold text-text-primary">{value ?? '—'}</p>
    )}
  </div>
);

// ─── Modal Produit ──────────────────────────────────────────────────────
const ProductModal = ({ product, businessId, onSave, onClose }) => {
  const [form, setForm] = useState({
    name: product?.name || '',
    description: product?.description || '',
    price: product?.price || '',
    imageUrl: product?.imageUrl || '',
    category: product?.category || '',
    isAvailable: product?.isAvailable ?? true,
    businessId,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.price) { setError('Nom et prix requis'); return; }
    setLoading(true);
    setError('');
    try {
      let result;
      if (product?.id) {
        const { businessId: _, ...updateData } = form;
        result = await updateProduct(product.id, updateData);
      } else {
        result = await createProduct({ ...form, price: Number(form.price) });
      }
      onSave(result);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg card p-6 animate-scale-in">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-base font-bold text-text-primary">
            {product?.id ? 'Modifier le produit' : 'Nouveau produit'}
          </h2>
          <button onClick={onClose} className="btn-icon"><X size={16} /></button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-status-errorBg border border-status-error/30 rounded-md text-status-error text-sm flex items-center gap-2">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Nom *</label>
            <input className="input-field" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Poulet bicyclette" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Description</label>
            <textarea className="input-field resize-none" rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Description du produit..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Prix (FCFA) *</label>
              <input className="input-field" type="number" min="0" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="2500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Catégorie</label>
              <input className="input-field" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="Plats" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">URL Image</label>
            <input className="input-field" value={form.imageUrl} onChange={e => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://..." />
          </div>
          <div className="flex items-center gap-3 p-3 bg-background-secondary rounded-md">
            <span className="text-sm text-text-secondary flex-1">Disponible à la vente</span>
            <button
              type="button"
              onClick={() => setForm({ ...form, isAvailable: !form.isAvailable })}
              className={`transition-colors ${form.isAvailable ? 'text-status-success' : 'text-text-tertiary'}`}
            >
              {form.isAvailable ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
            </button>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Annuler</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check size={16} />}
              {product?.id ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Dashboard principal ────────────────────────────────────────────────
const Dashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [activeTab, setActiveTab] = useState('overview');

  // Données
  const [analytics, setAnalytics] = useState(null);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [wallet, setWallet] = useState(null);

  // États UI
  const [loading, setLoading] = useState({ analytics: true, orders: true, products: true, wallet: true });
  const [errors, setErrors] = useState({});
  const [productModal, setProductModal] = useState(null); // null | 'new' | product object
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [updating, setUpdating] = useState({}); // { [orderId]: true }

  // ID du commerce depuis le profil utilisateur
  const businessId = user?.businessId || user?.business?.id;

  const setError = (key, msg) => setErrors(prev => ({ ...prev, [key]: msg }));
  const setLoad = (key, val) => setLoading(prev => ({ ...prev, [key]: val }));

  // ─── Chargement des données ────────────────────────────────────────
  const loadAnalytics = useCallback(async () => {
    if (!businessId) return;
    setLoad('analytics', true);
    try {
      const data = await getBusinessAnalytics(businessId);
      setAnalytics(data);
    } catch (err) {
      setError('analytics', err.message);
    } finally {
      setLoad('analytics', false);
    }
  }, [businessId]);

  const loadOrders = useCallback(async () => {
    setLoad('orders', true);
    try {
      const data = await getMyOrders();
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      setError('orders', err.message);
    } finally {
      setLoad('orders', false);
    }
  }, []);

  const loadProducts = useCallback(async () => {
    if (!businessId) return;
    setLoad('products', true);
    try {
      const data = await getProductsByBusiness(businessId);
      setProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      setError('products', err.message);
    } finally {
      setLoad('products', false);
    }
  }, [businessId]);

  const loadWallet = useCallback(async () => {
    if (!user?.id) return;
    setLoad('wallet', true);
    try {
      const data = await getWallet('business_admin', user.id);
      setWallet(data);
    } catch {
      setLoad('wallet', false);
    } finally {
      setLoad('wallet', false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadAnalytics();
    loadOrders();
    loadProducts();
    loadWallet();
  }, [loadAnalytics, loadOrders, loadProducts, loadWallet]);

  // ─── Actions produits ──────────────────────────────────────────────
  const handleToggleAvailability = async (productId) => {
    try {
      const updated = await toggleProductAvailability(productId);
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, ...updated } : p));
    } catch (err) {
      setError('products', err.message);
    }
  };

  const handleDeleteProduct = async (productId) => {
    if (!window.confirm('Supprimer ce produit ?')) return;
    try {
      await deleteProduct(productId);
      setProducts(prev => prev.filter(p => p.id !== productId));
    } catch (err) {
      setError('products', err.message);
    }
  };

 
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.price) {
      setError('Nom et prix requis');
      return;
    }
    setLoading(true);
    setError('');

    try {
      let result;
      if (product?.id) {
        // CORRECTION DU BUG DE SYNTAXE ICI
        const { businessId: _, ...updateData } = form;
        result = await updateProduct(product.id, updateData);
      } else {
        result = await createProduct({ ...form, price: Number(form.price) });
      }
      onSave(result);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ─── Actions commandes ─────────────────────────────────────────────
  const handleUpdateStatus = async (orderId, status) => {
    setUpdating(prev => ({ ...prev, [orderId]: true }));
    try {
      const updated = await updateOrderStatus(orderId, status);
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updated } : o));
    } catch (err) {
      setError('orders', err.message);
    } finally {
      setUpdating(prev => ({ ...prev, [orderId]: false }));
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  // Filtrage commandes
  const filteredOrders = statusFilter === 'ALL'
    ? orders
    : orders.filter(o => o.status === statusFilter);

  const tabs = [
    { id: 'overview', label: 'Vue d\'ensemble', icon: LayoutDashboard },
    { id: 'products', label: 'Produits', icon: Package },
    { id: 'orders', label: 'Commandes', icon: ShoppingCart, badge: orders.filter(o => o.status === 'PENDING').length },
    { id: 'settings', label: 'Paramètres', icon: Settings },
  ];

  const NEXT_STATUSES = {
    PENDING: ['PAID', 'CANCELLED'],
    PAID: ['IN_PREPARATION', 'CANCELLED'],
    IN_PREPARATION: ['PROCESSING'],
    PROCESSING: ['DELIVERED'],
    DELIVERED: ['COMPLETED'],
  };

  return (
    <div className="min-h-screen bg-background-primary flex">
      {/* ─── SIDEBAR ─────────────────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-60 bg-background-card border-r border-border-light fixed h-full z-20">
        {/* Logo */}
        <div className="p-5 border-b border-border-light">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(193,101,46,0.15)' }}>
              <span className="text-accent-primary text-sm font-bold">FF</span>
            </div>
            <div>
              <p className="text-text-primary font-bold text-sm">FasoFree</p>
              <p className="text-text-tertiary text-xs">Dashboard</p>
            </div>
          </div>
        </div>

        {/* Profil utilisateur */}
        <div className="p-4 border-b border-border-light">
          <div className="flex items-center gap-3">
            <div className="avatar w-9 h-9 text-sm flex-shrink-0">
              {(user?.fullName || user?.name || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-text-primary text-xs font-semibold truncate">{user?.fullName || user?.name || 'Commerçant'}</p>
              <p className="text-text-tertiary text-xs truncate">{user?.email || ''}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`nav-item w-full ${activeTab === tab.id ? 'active' : ''}`}
              >
                <Icon size={16} strokeWidth={1.5} />
                <span className="flex-1 text-left">{tab.label}</span>
                {tab.badge > 0 && (
                  <span className="w-5 h-5 bg-accent-primary text-white text-xs rounded-full flex items-center justify-center font-bold">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Wallet */}
        {wallet && (
          <div className="p-4 mx-3 mb-3 rounded-lg" style={{ background: 'rgba(193,101,46,0.08)', border: '1px solid rgba(193,101,46,0.15)' }}>
            <div className="flex items-center gap-2 mb-1">
              <Wallet size={13} className="text-accent-primary" />
              <span className="text-text-tertiary text-xs">Portefeuille</span>
            </div>
            <p className="text-text-primary text-sm font-bold">
              {(wallet.balance || 0).toLocaleString()} FCFA
            </p>
          </div>
        )}

        {/* Logout */}
        <div className="p-3 border-t border-border-light">
          <button onClick={handleLogout} className="nav-item w-full text-status-error hover:bg-status-errorBg">
            <LogOut size={16} strokeWidth={1.5} />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* ─── MAIN CONTENT ────────────────────────────────────────── */}
      <main className="flex-1 lg:ml-60 min-h-screen">
        {/* Header mobile */}
        <header className="lg:hidden flex items-center justify-between px-4 py-4 border-b border-border-light bg-background-card sticky top-0 z-10">
          <p className="text-text-primary font-bold">FasoFree Dashboard</p>
          <button onClick={handleLogout} className="btn-icon">
            <LogOut size={16} />
          </button>
        </header>

        {/* Tabs mobile */}
        <div className="lg:hidden flex overflow-x-auto scrollbar-hide gap-1 px-4 pt-4 pb-1 border-b border-border-light">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`tab-btn flex items-center gap-1.5 ${activeTab === tab.id ? 'active' : ''}`}
              >
                <Icon size={14} strokeWidth={1.5} />
                {tab.label}
                {tab.badge > 0 && <span className="w-4 h-4 bg-accent-primary text-white text-xs rounded-full flex items-center justify-center">{tab.badge}</span>}
              </button>
            );
          })}
        </div>

        <div className="p-4 sm:p-6 lg:p-8">

          {/* ──────────────────────────────────────────────────────── */}
          {/* ONGLET VUE D'ENSEMBLE                                    */}
          {/* ──────────────────────────────────────────────────────── */}
          {activeTab === 'overview' && (
            <div className="animate-slide-up">
              {/* Entête */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-xl font-bold text-text-primary">Vue d'ensemble</h1>
                  <p className="text-text-secondary text-sm mt-0.5">
                    {new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                </div>
                <button onClick={() => { loadAnalytics(); loadOrders(); }} className="btn-secondary gap-2">
                  <RefreshCw size={14} /> Actualiser
                </button>
              </div>

              {/* KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <StatCard
                  label="Commandes"
                  value={analytics?.totalOrders ?? orders.length}
                  icon={ShoppingCart}
                  color="#3B82F6"
                  loading={loading.analytics}
                />
                <StatCard
                  label="Chiffre d'affaires"
                  value={analytics?.totalRevenue != null ? `${analytics.totalRevenue.toLocaleString()} FCFA` : `${orders.reduce((s, o) => s + (o.totalAmount || 0), 0).toLocaleString()} FCFA`}
                  icon={TrendingUp}
                  color="#C1652E"
                  loading={loading.analytics}
                />
                <StatCard
                  label="Produits"
                  value={analytics?.totalProducts ?? products.length}
                  icon={Package}
                  color="#22C55E"
                  loading={loading.analytics || loading.products}
                />
                <StatCard
                  label="Clients"
                  value={analytics?.totalClients ?? '—'}
                  icon={Users}
                  color="#F59E0B"
                  loading={loading.analytics}
                />
              </div>

              {errors.analytics && (
                <div className="mb-6 p-3 bg-status-warningBg border border-status-warning/30 rounded-md text-status-warning text-sm flex items-center gap-2">
                  <AlertCircle size={14} /> Analytics indisponibles (backend requis). Données partielles affichées.
                </div>
              )}

              {/* Commandes récentes */}
              <div className="card p-5 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-bold text-text-primary">Commandes récentes</h2>
                  <button onClick={() => setActiveTab('orders')} className="text-accent-primary text-xs font-semibold hover:text-accent-secondary transition-colors">
                    Tout voir →
                  </button>
                </div>

                {loading.orders ? (
                  <div className="space-y-3">
                    {[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full" />)}
                  </div>
                ) : orders.length === 0 ? (
                  <div className="text-center py-8">
                    <ShoppingCart size={32} className="text-text-tertiary mx-auto mb-2" strokeWidth={1} />
                    <p className="text-text-secondary text-sm">Aucune commande pour l'instant</p>
                  </div>
                ) : (
                  <div className="table-container">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Commande</th>
                          <th>Montant</th>
                          <th>Type</th>
                          <th>Statut</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orders.slice(0, 5).map(order => (
                          <tr key={order.id}>
                            <td>
                              <p className="font-semibold text-text-primary">#{order.id?.slice(-8)}</p>
                              <p className="text-text-tertiary text-xs">{order.createdAt ? new Date(order.createdAt).toLocaleDateString('fr-FR') : ''}</p>
                            </td>
                            <td>
                              <span className="font-mono text-sm text-accent-primary font-semibold">
                                {(order.totalAmount || 0).toLocaleString()} FCFA
                              </span>
                            </td>
                            <td><span className="text-text-secondary text-xs">{order.orderType || '—'}</span></td>
                            <td><StatusBadge status={order.status} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Actions rapides */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label: 'Ajouter un produit', desc: 'Enrichir votre catalogue', icon: Plus, tab: 'products', action: () => { setActiveTab('products'); setProductModal('new'); } },
                  { label: 'Gérer les commandes', desc: 'Mettre à jour les statuts', icon: ShoppingCart, tab: 'orders', action: () => setActiveTab('orders') },
                  { label: 'Paramètres', desc: 'Infos de votre commerce', icon: Settings, tab: 'settings', action: () => setActiveTab('settings') },
                ].map(item => (
                  <button
                    key={item.label}
                    onClick={item.action}
                    className="card-hover p-5 text-left"
                  >
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3" style={{ background: 'rgba(193,101,46,0.1)' }}>
                      <item.icon size={18} className="text-accent-primary" strokeWidth={1.5} />
                    </div>
                    <p className="text-text-primary text-sm font-semibold">{item.label}</p>
                    <p className="text-text-tertiary text-xs mt-0.5">{item.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ──────────────────────────────────────────────────────── */}
          {/* ONGLET PRODUITS                                          */}
          {/* ──────────────────────────────────────────────────────── */}
          {activeTab === 'products' && (
            <div className="animate-slide-up">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-xl font-bold text-text-primary">Catalogue produits</h1>
                  <p className="text-text-secondary text-sm mt-0.5">{products.length} produit{products.length !== 1 ? 's' : ''}</p>
                </div>
                <button onClick={() => setProductModal('new')} className="btn-primary">
                  <Plus size={16} /> Nouveau produit
                </button>
              </div>

              {errors.products && (
                <div className="mb-4 p-3 bg-status-errorBg border border-status-error/30 rounded-md text-status-error text-sm flex items-center gap-2">
                  <AlertCircle size={14} /> {errors.products}
                </div>
              )}

              {loading.products ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-40 w-full" />)}
                </div>
              ) : products.length === 0 ? (
                <div className="card flex flex-col items-center justify-center py-16 text-center">
                  <Package size={48} className="text-text-tertiary mb-4" strokeWidth={1} />
                  <p className="text-text-secondary font-semibold mb-1">Catalogue vide</p>
                  <p className="text-text-tertiary text-sm mb-4">Ajoutez votre premier produit pour commencer.</p>
                  <button onClick={() => setProductModal('new')} className="btn-primary">
                    <Plus size={16} /> Ajouter un produit
                  </button>
                </div>
              ) : (
                <div className="table-container card">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Produit</th>
                        <th>Catégorie</th>
                        <th>Prix</th>
                        <th>Disponible</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map(product => (
                        <tr key={product.id}>
                          <td>
                            <div className="flex items-center gap-3">
                              {product.imageUrl ? (
                                <img src={product.imageUrl} alt={product.name} className="w-10 h-10 rounded-md object-cover flex-shrink-0" />
                              ) : (
                                <div className="w-10 h-10 rounded-md bg-background-secondary flex items-center justify-center flex-shrink-0">
                                  <Package size={16} className="text-text-tertiary" />
                                </div>
                              )}
                              <div>
                                <p className="font-semibold text-text-primary text-sm">{product.name}</p>
                                {product.description && (
                                  <p className="text-text-tertiary text-xs line-clamp-1 mt-0.5">{product.description}</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td><span className="text-text-secondary text-xs">{product.category || '—'}</span></td>
                          <td>
                            <span className="font-mono text-sm text-accent-primary font-semibold">
                              {(product.price || 0).toLocaleString()} FCFA
                            </span>
                          </td>
                          <td>
                            <button
                              onClick={() => handleToggleAvailability(product.id)}
                              className={`transition-colors ${product.isAvailable ? 'text-status-success' : 'text-text-tertiary'}`}
                              title={product.isAvailable ? 'Désactiver' : 'Activer'}
                            >
                              {product.isAvailable ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                            </button>
                          </td>
                          <td>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setProductModal(product)}
                                className="btn-icon"
                                title="Modifier"
                              >
                                <Pencil size={14} className="text-text-secondary" />
                              </button>
                              <button
                                onClick={() => handleDeleteProduct(product.id)}
                                className="btn-icon border-status-error/20 hover:border-status-error/50 hover:bg-status-errorBg"
                                title="Supprimer"
                              >
                                <Trash2 size={14} className="text-status-error" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ──────────────────────────────────────────────────────── */}
          {/* ONGLET COMMANDES                                         */}
          {/* ──────────────────────────────────────────────────────── */}
          {activeTab === 'orders' && (
            <div className="animate-slide-up">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-xl font-bold text-text-primary">Commandes</h1>
                  <p className="text-text-secondary text-sm mt-0.5">{filteredOrders.length} commande{filteredOrders.length !== 1 ? 's' : ''}</p>
                </div>
                <button onClick={loadOrders} className="btn-secondary gap-2">
                  <RefreshCw size={14} /> Actualiser
                </button>
              </div>

              {/* Filtres statut */}
              <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 mb-5">
                <button
                  onClick={() => setStatusFilter('ALL')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-full whitespace-nowrap transition-all ${statusFilter === 'ALL' ? 'bg-accent-primary text-white' : 'bg-background-secondary text-text-secondary hover:text-text-primary'}`}
                >
                  Toutes ({orders.length})
                </button>
                {Object.entries(ORDER_STATUS).map(([key, val]) => {
                  const count = orders.filter(o => o.status === key).length;
                  return (
                    <button
                      key={key}
                      onClick={() => setStatusFilter(key)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-full whitespace-nowrap transition-all ${statusFilter === key ? 'bg-accent-primary text-white' : 'bg-background-secondary text-text-secondary hover:text-text-primary'}`}
                    >
                      {val.label} ({count})
                    </button>
                  );
                })}
              </div>

              {errors.orders && (
                <div className="mb-4 p-3 bg-status-errorBg border border-status-error/30 rounded-md text-status-error text-sm flex items-center gap-2">
                  <AlertCircle size={14} /> {errors.orders}
                </div>
              )}

              {loading.orders ? (
                <div className="space-y-3">
                  {[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="card flex flex-col items-center justify-center py-16 text-center">
                  <ShoppingCart size={48} className="text-text-tertiary mb-4" strokeWidth={1} />
                  <p className="text-text-secondary font-semibold">Aucune commande</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredOrders.map(order => {
                    const nextStatuses = NEXT_STATUSES[order.status] || [];
                    const isUpdating = updating[order.id];
                    return (
                      <div key={order.id} className="card p-4">
                        <div className="flex flex-wrap items-start gap-3 justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-bold text-text-primary text-sm font-mono">#{order.id?.slice(-8)}</p>
                              <StatusBadge status={order.status} />
                            </div>
                            <div className="flex flex-wrap gap-3 text-xs text-text-tertiary">
                              <span className="flex items-center gap-1">
                                <Clock size={11} /> {order.createdAt ? new Date(order.createdAt).toLocaleString('fr-FR') : '—'}
                              </span>
                              <span>{order.orderType || ''}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-accent-primary font-bold font-mono text-base">
                              {(order.totalAmount || 0).toLocaleString()} FCFA
                            </p>
                            {order.deliveryFee > 0 && (
                              <p className="text-text-tertiary text-xs">Livraison: {order.deliveryFee.toLocaleString()} FCFA</p>
                            )}
                          </div>
                        </div>

                        {nextStatuses.length > 0 && (
                          <div className="flex gap-2 mt-3 pt-3 border-t border-border-light flex-wrap">
                            {nextStatuses.map(ns => (
                              <button
                                key={ns}
                                disabled={isUpdating}
                                onClick={() => handleUpdateStatus(order.id, ns)}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                                  ns === 'CANCELLED'
                                    ? 'border border-status-error/30 text-status-error hover:bg-status-errorBg'
                                    : 'btn-primary py-1.5 text-xs'
                                } disabled:opacity-50`}
                              >
                                {isUpdating ? (
                                  <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin inline-block mr-1" />
                                ) : null}
                                {ORDER_STATUS[ns]?.label || ns}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ──────────────────────────────────────────────────────── */}
          {/* ONGLET PARAMÈTRES                                        */}
          {/* ──────────────────────────────────────────────────────── */}
          {activeTab === 'settings' && (
            <div className="animate-slide-up max-w-2xl">
              <h1 className="text-xl font-bold text-text-primary mb-6">Paramètres du compte</h1>

              {/* Infos utilisateur */}
              <div className="card p-5 mb-5">
                <h3 className="text-sm font-bold text-text-primary mb-4 flex items-center gap-2">
                  <Users size={15} className="text-accent-primary" /> Profil utilisateur
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2 border-b border-border-light">
                    <span className="text-text-secondary text-sm">Nom</span>
                    <span className="text-text-primary text-sm font-semibold">{user?.fullName || user?.name || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-border-light">
                    <span className="text-text-secondary text-sm">Email</span>
                    <span className="text-text-primary text-sm">{user?.email || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-border-light">
                    <span className="text-text-secondary text-sm">Téléphone</span>
                    <span className="text-text-primary text-sm">{user?.phone || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-text-secondary text-sm">Rôle</span>
                    <span className="badge-paid">{user?.role || '—'}</span>
                  </div>
                </div>
              </div>

              {/* Portefeuille */}
              {wallet && (
                <div className="card p-5 mb-5">
                  <h3 className="text-sm font-bold text-text-primary mb-4 flex items-center gap-2">
                    <Wallet size={15} className="text-accent-primary" /> Portefeuille
                  </h3>
                  <div className="flex items-center justify-between">
                    <span className="text-text-secondary text-sm">Solde disponible</span>
                    <span className="text-xl font-bold text-accent-primary font-mono">
                      {(wallet.balance || 0).toLocaleString()} FCFA
                    </span>
                  </div>
                </div>
              )}

              {/* Infos commerce */}
              {businessId && (
                <div className="card p-5">
                  <h3 className="text-sm font-bold text-text-primary mb-4 flex items-center gap-2">
                    <Star size={15} className="text-accent-primary" /> Commerce
                  </h3>
                  <p className="text-text-secondary text-sm">ID Commerce: <span className="font-mono text-text-primary">{businessId}</span></p>
                  <p className="text-text-tertiary text-xs mt-2">Pour modifier les informations de votre commerce, contactez l'administration FasoFree.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* ─── MODAL PRODUIT ─────────────────────────────────────────── */}
      {productModal && (
        <ProductModal
          product={productModal === 'new' ? null : productModal}
          businessId={businessId}
          onSave={handleProductSaved}
          onClose={() => setProductModal(null)}
        />
      )}
    </div>
  );
};

export default Dashboard;
