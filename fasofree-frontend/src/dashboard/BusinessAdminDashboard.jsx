/**
 * FasoFree — Business Admin Dashboard with Advanced Inventory Management
 * 
 * Multi-entity inventory system with:
 * - SKU-based product identification
 * - Stock tracking with automatic decrements
 * - Product variants (size, color, etc.)
 * - Low stock alerts and reorder management
 * - Real-time order management with FSM
 * - Sales analytics and financial overview
 * - Business settings and wallet management
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Layout, Package, ShoppingBag, Settings, LogOut,
  TrendingUp, Users, Wallet, Plus, Pencil, Trash2, ToggleLeft,
  ToggleRight, RefreshCw, AlertCircle, ChevronDown, X, Check,
  ArrowUpRight, Clock, Star, Scan, AlertTriangle, Search, MessageSquare,
  BarChart3, XCircle, Camera, Eye, Shield, Share2, Copy, QrCode, ExternalLink, Calendar,
  BadgeCheck, Megaphone
} from 'lucide-react';
import useAuthStore from '../store/authStore';
import { StatCard, StatusBadge, LoadingSkeleton, EmptyState, OrderStatusStepper } from './components/StatCard';
import PageHero from './components/PageHero';
import MerchantDisputesTab from './components/MerchantDisputesTab';
import SelfServicePushCampaigns from './components/SelfServicePushCampaigns';
import WalletTopupButton from './components/WalletTopupButton';
import { getBusinessAnalytics, getBrandAnalytics } from '../services/analyticsService';
import { getMyOrders, getBusinessOrders, getBrandOrders, getAvailableDrivers, assignDriverToOrder, updateOrderStatus, getStatusInfo, getOrderSteps, getNextPossibleStatuses } from '../services/orderService';
import {
  getProductsByBusiness, createProduct, updateProduct,
  deleteProduct, toggleProductAvailability,
} from '../services/productService';
import { getWallet, getWalletByBranch, getBrandWallets } from '../services/walletService';
import { getBusinessProducts, getLowStockAlerts, updateStock, generateSKU } from '../services/inventoryService';
import api from '../services/api';
import { getActiveConversations, getChatHistory } from '../services/usersService';
import { getChatSocket, getDispatchSocket } from '../services/realtime';
import { affiliateService } from '../services/affiliateService';
import CallSupportButton from '../components/CallSupportButton';
import { ProductType, InventoryStatus } from '../types';
import ImageUpload from '../components/ImageUpload';
import BranchSelector from './components/BranchSelector';
import BrandChart from './components/BrandChart';
import BranchFinancialCard from './components/BranchFinancialCard';

// ─── Product Modal with Inventory Management ─────────────────────────────
const ProductModal = ({ product, businessId, onSave, onClose }) => {
  const [form, setForm] = useState({
    name: product?.name || '',
    description: product?.description || '',
    price: product?.price || '',
    imageUrl: product?.imageUrl || '',
    category: product?.category || '',
    type: product?.type || ProductType.RETAIL,
    sku: product?.sku || '',
    trackInventory: product?.trackInventory ?? true,
    stockQuantity: product?.stockQuantity ?? 0,
    minStockAlert: product?.minStockAlert ?? 5,
    isAvailable: product?.isAvailable ?? true,
    businessId,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generatingSKU, setGeneratingSKU] = useState(false);

  const handleGenerateSKU = async () => {
    if (!form.name || !form.category) {
      setError('Nom et catégorie requis pour générer le SKU');
      return;
    }
    setGeneratingSKU(true);
    try {
      const sku = await generateSKU(businessId, form.name, form.category);
      setForm(prev => ({ ...prev, sku }));
    } catch (err) {
      setError('Erreur lors de la génération du SKU');
    } finally {
      setGeneratingSKU(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.price) { setError('Nom et prix requis'); return; }
    if (form.trackInventory && form.stockQuantity < 0) {
      setError('Le stock doit être positif pour le suivi d\'inventaire');
      return;
    }
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
      <div className="w-full max-w-2xl card p-6 animate-scale-in max-h-[90vh] overflow-y-auto">
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
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-[12px] font-semibold text-text-secondary mb-1.5">Nom *</label>
              <input className="input-field" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Poulet bicyclette" />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-text-secondary mb-1.5">Prix (FCFA) *</label>
              <input className="input-field" type="number" min="0" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="2500" />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-text-secondary mb-1.5">Catégorie</label>
              <input className="input-field" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="Plats" />
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-text-secondary mb-1.5">Description</label>
            <textarea className="input-field resize-none" rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Description du produit..." />
          </div>

          {/* Product Type */}
          <div>
            <label className="block text-[12px] font-semibold text-text-secondary mb-1.5">Type de produit</label>
            <select className="input-field" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
              <option value={ProductType.RETAIL}>Retail / Boutique</option>
              <option value={ProductType.FOOD}>Restauration / Fast-Food</option>
              <option value={ProductType.PHARMACY}>Pharmacie</option>
              <option value={ProductType.SERVICE}>Service</option>
            </select>
          </div>

          {/* Inventory Management */}
          <div className="p-4 bg-background-secondary rounded-lg space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-text-primary">Suivi d'inventaire</label>
              <button
                type="button"
                onClick={() => setForm({ ...form, trackInventory: !form.trackInventory })}
                className={`transition-colors ${form.trackInventory ? 'text-status-success' : 'text-text-tertiary'}`}
              >
                {form.trackInventory ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
              </button>
            </div>

            {form.trackInventory && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-text-secondary mb-1.5">SKU / Code-barres (optionnel)</label>
                  <div className="flex gap-2">
                    <input className="input-field flex-1" value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} placeholder="Généré automatiquement" />
                    <button type="button" onClick={handleGenerateSKU} disabled={generatingSKU} className="btn-secondary">
                      <Scan size={14} className={generatingSKU ? 'animate-spin' : ''} />
                    </button>
                  </div>
                  <p className="text-[11px] text-text-tertiary mt-1">Laissez vide : la plateforme attribue le matricule automatiquement.</p>
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-text-secondary mb-1.5">Stock actuel</label>
                  <input className="input-field" type="number" min="0" value={form.stockQuantity} onChange={e => setForm({ ...form, stockQuantity: Number(e.target.value) })} placeholder="0" />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-text-secondary mb-1.5">Alerte stock bas</label>
                  <input className="input-field" type="number" min="0" value={form.minStockAlert} onChange={e => setForm({ ...form, minStockAlert: Number(e.target.value) })} placeholder="5" />
                </div>
              </div>
            )}
          </div>

          {/* Image */}
          <ImageUpload
            value={form.imageUrl}
            onChange={(url) => setForm({ ...form, imageUrl: url })}
            folder="products"
          />

          {/* Availability */}
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

// ─── Stock Adjustment Modal ─────────────────────────────────────────────
const StockAdjustmentModal = ({ product, onSave, onClose }) => {
  const [quantity, setQuantity] = useState(0);
  const [reason, setReason] = useState('MANUAL_ADJUSTMENT');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (quantity === 0) { setError('Quantité requise'); return; }
    setLoading(true);
    setError('');
    try {
      await updateStock(product.id, quantity, reason);
      onSave(quantity, reason);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md card p-6 animate-scale-in">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-base font-bold text-text-primary">Ajustement de Stock</h2>
          <button onClick={onClose} className="btn-icon"><X size={16} /></button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-status-errorBg border border-status-error/30 rounded-md text-status-error text-sm flex items-center gap-2">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        <div className="mb-4 p-3 bg-background-secondary rounded-lg">
          <p className="text-sm font-semibold text-text-primary">{product.name}</p>
          <p className="text-[13px] text-text-secondary">Stock actuel: {product.stockQuantity}</p>
          <p className="text-[13px] text-text-secondary">SKU: {product.sku}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[12px] font-semibold text-text-secondary mb-1.5">Ajustement (+/-)</label>
            <input 
              className="input-field" 
              type="number" 
              value={quantity} 
              onChange={e => setQuantity(Number(e.target.value))} 
              placeholder="Entrez un nombre positif ou négatif"
            />
            <p className="text-[13px] text-text-tertiary mt-1">Positif = ajout, Négatif = retrait</p>
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-text-secondary mb-1.5">Raison</label>
            <select className="input-field" value={reason} onChange={e => setReason(e.target.value)}>
              <option value="MANUAL_ADJUSTMENT">Ajustement manuel</option>
              <option value="STOCK_TAKE">Inventaire</option>
              <option value="DAMAGE">Dommage</option>
              <option value="LOSS">Perte</option>
              <option value="RETURN">Retour client</option>
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Annuler</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check size={16} />}
              Confirmer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Business Admin Dashboard ────────────────────────────────────────────
const ALLOWED_ROLES = ['business_admin', 'business', 'merchant', 'restaurant', 'super_admin'];

const BusinessAdminDashboard = () => {
  const navigate = useNavigate();
  const user = useAuthStore(state => state.user);
  const logout = useAuthStore(state => state.logout);
  const [activeTab, setActiveTab] = useState('overview');

  // 🛡️ Garde-fou : si le rôle n'est pas autorisé, rediriger immédiatement
  const normalizedRole = String(user?.role || '').toLowerCase().replace('-', '_');
  if (user && !ALLOWED_ROLES.includes(normalizedRole)) {
    navigate('/unauthorized', { replace: true });
    return null;
  }

  // Données
  const [analytics, setAnalytics] = useState(null);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [lowStockAlerts, setLowStockAlerts] = useState([]);
  const [wallet, setWallet] = useState(null);
  const [businessSettings, setBusinessSettings] = useState({
    enableDelivery: true,
    enablePickup: true,
    enableDineIn: false,
    hasOwnDrivers: false,
    category: 'RESTAURANT',
    subCategory: '',
    logo: '',
    coverImage: '',
    // 🕐 Bloc H — horaires récurrents (null = non renseigné, isOpen décide seul).
    openingHours: null,
    // 📅 Bloc H — commandes à l'avance (null = non configuré, refusée).
    advanceOrderConfig: null,
  });

  // 🏷️ Catalogue des catégories actives (source unique de vérité serveur).
  // Évite de recoder en dur une liste qui dériverait du backend.
  const [categoryCatalog, setCategoryCatalog] = useState([]);

  // États UI
  const [loading, setLoading] = useState({ analytics: true, orders: true, products: true, wallet: true, alerts: true, affiliate: true });
  const [errors, setErrors] = useState({});
  const [productModal, setProductModal] = useState(null);
  const [stockModal, setStockModal] = useState(null);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [productTypeFilter, setProductTypeFilter] = useState('ALL');
  const [updating, setUpdating] = useState({});
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState(null);

  // Affiliation
  const [affiliateData, setAffiliateData] = useState(null);
  const [affiliateLoading, setAffiliateLoading] = useState(false);
  const [affiliateError, setAffiliateError] = useState(null);

  // Chat inbox
  const [conversations, setConversations] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [selectedChatOrder, setSelectedChatOrder] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [chatHistoryLoading, setChatHistoryLoading] = useState(false);
  const [chatChannel, setChatChannel] = useState('merchant');
  const [chatInput, setChatInput] = useState('');
  const chatSocketRef = useRef(null);
  const loadedOnceRef = useRef(false);

  // Stories
  const [stories, setStories] = useState([]);
  const [storiesLoading, setStoriesLoading] = useState(false);
  const [storyModal, setStoryModal] = useState(false);
  const [storyFile, setStoryFile] = useState(null);
  const [storyPreview, setStoryPreview] = useState(null);
  const [storyCaption, setStoryCaption] = useState('');
  const [storyUploading, setStoryUploading] = useState(false);
  const storyFileRef = useRef(null);

  // Assignation livreur
  const [driverModal, setDriverModal] = useState(null);
  const [availableDrivers, setAvailableDrivers] = useState([]);
  const [loadingDrivers, setLoadingDrivers] = useState(false);
  const [assigningDriver, setAssigningDriver] = useState(null);

  // ID du commerce depuis le profil utilisateur
  const [resolvedBusinessId, setResolvedBusinessId] = useState(null);
  const [resolvedBrandId, setResolvedBrandId] = useState(null);
  const [resolvedBranches, setResolvedBranches] = useState([]);

  const businessId = resolvedBusinessId || user?.businessId || user?.business?.id;
  const brandId = resolvedBrandId || user?.brandId || null;
  const branches = React.useMemo(() => resolvedBranches.length > 0 ? resolvedBranches : (user?.branches || []), [resolvedBranches, user?.branches]);
  const branchesRef = useRef(branches);
  branchesRef.current = branches;

  // 🎚️ Qualité de livraison (bloc B) : le commerce lit la mesure posée par
  // FasoFree au moment de la remise. On se limite aux commandes terminées
  // du chargement courant (200 max) — c'est un indicateur, pas un audit.
  const sla = React.useMemo(() => {
    const done = orders.filter(
      (o) => o.deliveredAt || o.status === 'DELIVERED' || o.status === 'COMPLETED',
    );
    const late = done.filter((o) => o.deliveryLate).length;
    const avg = (key) =>
      done.length
        ? done.reduce((s, o) => s + (Number(o[key]) || 0), 0) / done.length
        : null;
    return {
      total: done.length,
      late,
      rate: done.length ? Math.round(((done.length - late) / done.length) * 100) : null,
      avgDuration: avg('deliveryDurationMinutes'),
    };
  }, [orders]);

  // Sélection d'agence (null = vue marque)
  const [selectedBranchId, setSelectedBranchId] = useState(null);
  const [brandAnalytics, setBrandAnalytics] = useState(null);
  const [branchWallets, setBranchWallets] = useState({});
  // Wallets agrégés de la marque (toutes agences) — GET /wallets/brand/:brandId
  const [brandWallets, setBrandWallets] = useState(null);

  const setError = (key, msg) => setErrors(prev => ({ ...prev, [key]: msg }));
  const setLoad = (key, val) => setLoading(prev => ({ ...prev, [key]: val }));

  const toggleSetting = (key) => {
    setBusinessSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    if (!user?.businessId && !user?.brandId) {
      api.get('/businesses/me').then((res) => {
        const data = res?.data ?? res;
        if (data?.id) setResolvedBusinessId(data.id);
        if (data?.brandId) setResolvedBrandId(data.brandId);
        if (data?.branches?.length) setResolvedBranches(data.branches);
      }).catch(() => {});
    } else if (user?.brandId && !resolvedBranches.length) {
      setResolvedBrandId(user.brandId);
      setResolvedBusinessId(user.businessId);
      if (user?.branches?.length) setResolvedBranches(user.branches);
    } else if (user?.businessId && !resolvedBusinessId) {
      setResolvedBusinessId(user.businessId);
    }
  }, [user]);

  // 🏷️ Charge le catalogue une seule fois : les options de catégorie et de
  // sous-catégorie viennent du serveur (une verticale désactivée côté Super
  // Admin disparaît donc automatiquement de ce formulaire).
  useEffect(() => {
    api
      .get('/businesses/categories')
      .then((res) => {
        const data = res?.data ?? res;
        setCategoryCatalog(data?.categories ?? []);
      })
      .catch(() => setCategoryCatalog([]));
  }, []);

  const loadSettings = useCallback(async () => {
    if (!businessId) return;
    try {
      const res = await api.get(`/businesses/${businessId}`);
      const b = res?.data ?? res;
      if (b) {
        setBusinessSettings({
          enableDelivery: b.enableDelivery ?? true,
          enablePickup: b.enablePickup ?? true,
          enableDineIn: b.enableDineIn ?? false,
          hasOwnDrivers: b.hasOwnDrivers ?? false,
          category: b.category ?? 'RESTAURANT',
          subCategory: b.subCategory ?? '',
          logo: b.logo ?? '',
          coverImage: b.coverImage ?? '',
          openingHours: b.openingHours ?? null,
          advanceOrderConfig: b.advanceOrderConfig ?? null,
        });
      }
    } catch {
      // Silently fail
    }
  }, [businessId]);

  const handleSaveSettings = async () => {
    if (!businessId) {
      setSettingsMsg({ type: 'error', text: 'Aucun commerce associé à votre compte. Contactez le support.' });
      return;
    }
    setSettingsSaving(true);
    setSettingsMsg(null);
    try {
      await api.patch(`/businesses/${businessId}`, businessSettings);
      const updatedBusiness = (await api.get(`/businesses/${businessId}`)).data;
      setBusinessSettings({
        enableDelivery: updatedBusiness.enableDelivery ?? true,
        enablePickup: updatedBusiness.enablePickup ?? true,
        enableDineIn: updatedBusiness.enableDineIn ?? false,
        hasOwnDrivers: updatedBusiness.hasOwnDrivers ?? false,
        category: updatedBusiness.category ?? 'RESTAURANT',
        subCategory: updatedBusiness.subCategory ?? '',
        logo: updatedBusiness.logo ?? '',
        coverImage: updatedBusiness.coverImage ?? '',
        openingHours: updatedBusiness.openingHours ?? null,
        advanceOrderConfig: updatedBusiness.advanceOrderConfig ?? null,
      });
      setSettingsMsg({ type: 'success', text: 'Paramètres enregistrés avec succès.' });
    } catch (err) {
      setSettingsMsg({ type: 'error', text: err.message || 'Échec de la sauvegarde.' });
    } finally {
      setSettingsSaving(false);
    }
  };

  // ─── 🕐 HORAIRES D'OUVERTURE (bloc H) ─────────────────────────────────
  // Un jour sans créneau = fermé. `null` sur le champ entier = horaires non
  // renseignés → c'est alors le seul `isOpen` qui décide (comme avant).
  const DAYS = [
    { key: 'monday', label: 'Lundi' },
    { key: 'tuesday', label: 'Mardi' },
    { key: 'wednesday', label: 'Mercredi' },
    { key: 'thursday', label: 'Jeudi' },
    { key: 'friday', label: 'Vendredi' },
    { key: 'saturday', label: 'Samedi' },
    { key: 'sunday', label: 'Dimanche' },
  ];

  const setDayHours = (day, field, value) => {
    setBusinessSettings((prev) => {
      const current = prev.openingHours || {};
      const slot = current[day] || { open: '08:00', close: '22:00' };
      return {
        ...prev,
        openingHours: { ...current, [day]: { ...slot, [field]: value } },
      };
    });
  };

  /** Retire le créneau d'un jour → ce jour devient « fermé ». */
  const clearDayHours = (day) => {
    setBusinessSettings((prev) => {
      const current = { ...(prev.openingHours || {}) };
      delete current[day];
      return { ...prev, openingHours: current };
    });
  };

  const setAdvanceConfig = (field, value) => {
    setBusinessSettings((prev) => {
      const current = prev.advanceOrderConfig || {
        enabled: false,
        minHoursAhead: 2,
        maxDaysAhead: 7,
      };
      return {
        ...prev,
        advanceOrderConfig: { ...current, [field]: value },
      };
    });
  };

  // ─── STORIES ─────────────────────────────────────────────────────
  const loadStories = useCallback(async () => {
    setStoriesLoading(true);
    try {
      const res = await api.get('/stories/mine');
      const groups = res?.data?.data ?? res?.data ?? [];
      setStories(Array.isArray(groups) ? groups : []);
    } catch {
      setStories([]);
    } finally {
      setStoriesLoading(false);
    }
  }, []);

  const handleStoryFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.match(/^image\/(jpeg|png|webp)$/)) {
      setError('stories', 'Formats acceptés : JPEG, PNG, WebP');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('stories', 'Image trop lourde (max 5 Mo)');
      return;
    }
    setError('stories', '');
    setStoryFile(file);
    setStoryPreview(URL.createObjectURL(file));
  };

  const handleCreateStory = async () => {
    if (!storyFile || !businessId) return;
    setStoryUploading(true);
    setError('stories', '');
    try {
      const token = localStorage.getItem('fasofree_token');
      const fd = new FormData();
      fd.append('file', storyFile);
      const upRes = await fetch(`${import.meta.env.VITE_API_URL || 'https://api.fasofree.site/api/v1'}/uploads/image?folder=stories`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const upData = await upRes.json();
      if (!upRes.ok) throw new Error(upData.message || 'Échec de l\'upload');

      await api.post('/stories', {
        businessId: selectedBranchId || businessId,
        mediaUrl: upData.url,
        mediaType: 'IMAGE',
        caption: storyCaption.trim() || undefined,
      });

      setStoryFile(null);
      setStoryPreview(null);
      setStoryCaption('');
      setStoryModal(false);
      loadStories();
    } catch (err) {
      setError('stories', err.message || 'Échec de la publication');
    } finally {
      setStoryUploading(false);
    }
  };

  const handleDeleteStory = async (storyId) => {
    try {
      await api.delete(`/stories/${storyId}`);
      loadStories();
    } catch (err) {
      setError('stories', err.message);
    }
  };

  // ─── ASSIGNATION LIVREUR ──────────────────────────────────────────
  const openDriverModal = async (order) => {
    setDriverModal(order);
    setLoadingDrivers(true);
    try {
      const drivers = await getAvailableDrivers();
      setAvailableDrivers(Array.isArray(drivers) ? drivers : []);
    } catch (err) {
      setError('drivers', err.message);
      setAvailableDrivers([]);
    } finally {
      setLoadingDrivers(false);
    }
  };

  const handleAssignDriver = async (driverId) => {
    if (!driverModal) return;
    setAssigningDriver(driverId);
    try {
      await assignDriverToOrder(driverModal.id, driverId);
      setDriverModal(null);
      setAvailableDrivers([]);
      loadOrders();
    } catch (err) {
      setError('drivers', err.message);
    } finally {
      setAssigningDriver(null);
    }
  };

  // ─── Chargement des données ────────────────────────────────────────
  const loadAnalytics = useCallback(async () => {
    const targetId = selectedBranchId || businessId;
    if (!targetId) return;
    setLoad('analytics', true);
    try {
      const data = await getBusinessAnalytics(targetId);
      setAnalytics(data);
    } catch (err) {
      setError('analytics', err.message);
    } finally {
      setLoad('analytics', false);
    }
  }, [selectedBranchId, businessId]);

  const loadBrandAnalytics = useCallback(async () => {
    if (!brandId) return;
    try {
      const data = await getBrandAnalytics(brandId);
      setBrandAnalytics(data);
    } catch {
      // Silently fail
    }
  }, [brandId]);

  const loadOrders = useCallback(async () => {
    if (!loadedOnceRef.current) setLoad('orders', true);
    try {
      let data;
      if (selectedBranchId) {
        data = await getBusinessOrders(selectedBranchId);
      } else if (branchesRef.current.length > 1) {
        data = await getBrandOrders(branchesRef.current.map(b => b.id));
      } else if (businessId) {
        data = await getBusinessOrders(businessId);
      } else {
        setLoad('orders', false);
        return;
      }
      setOrders(Array.isArray(data) ? data : []);
      loadedOnceRef.current = true;
    } catch (err) {
      setError('orders', err.message);
    } finally {
      setLoad('orders', false);
    }
  }, [selectedBranchId, businessId]);

  const loadProducts = useCallback(async () => {
    const targetId = selectedBranchId || businessId;
    if (!targetId) return;
    setLoad('products', true);
    try {
      const data = await getBusinessProducts(targetId);
      setProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      setError('products', err.message);
    } finally {
      setLoad('products', false);
    }
  }, [selectedBranchId, businessId]);

  const loadAffiliate = useCallback(async () => {
    if (!businessId) return;
    setAffiliateLoading(true);
    setAffiliateError(null);
    try {
      const [link, stats] = await Promise.all([
        affiliateService.getMyLink(businessId),
        affiliateService.getMyStats(businessId),
      ]);
      setAffiliateData({ link, stats });
    } catch (err) {
      setAffiliateError(err.message);
    } finally {
      setAffiliateLoading(false);
    }
  }, [businessId]);

  const loadLowStockAlerts = useCallback(async () => {
    const targetId = selectedBranchId || businessId;
    if (!targetId) return;
    setLoad('alerts', true);
    try {
      const data = await getLowStockAlerts(targetId);
      setLowStockAlerts(Array.isArray(data) ? data : []);
    } catch (err) {
      setError('alerts', err.message);
    } finally {
      setLoad('alerts', false);
    }
  }, [selectedBranchId, businessId]);

  const loadWallet = useCallback(async () => {
    if (!user?.id) return;
    setLoad('wallet', true);
    try {
      if (selectedBranchId && brandId) {
        const data = await getWalletByBranch('business_admin', user.id, selectedBranchId);
        setWallet(data);
      } else {
        const data = await getWallet('business_admin', user.id);
        setWallet(data);
      }
    } catch {
      setLoad('wallet', false);
    } finally {
      setLoad('wallet', false);
    }
  }, [user?.id, selectedBranchId, brandId]);

  const loadBranchWallets = useCallback(async () => {
    if (!brandId || branchesRef.current.length === 0) return;
    // Wallets agrégés de la marque (toutes les agences) en parallèle
    getBrandWallets(brandId)
      .then((data) => setBrandWallets(data))
      .catch(() => setBrandWallets(null));
    try {
      const wallets = {};
      for (const branch of branchesRef.current) {
        try {
          const data = await getWalletByBranch('business_admin', user.id, branch.id);
          wallets[branch.id] = data;
        } catch {
          wallets[branch.id] = { balance: 0 };
        }
      }
      setBranchWallets(wallets);
    } catch {
      // Silently fail
    }
  }, [brandId, user?.id]);

  // ✅ FIX STALE CLOSURE : refs pour callbacks
  const loadOrdersRef = useRef(loadOrders);
  loadOrdersRef.current = loadOrders;
  const loadAnalyticsRef = useRef(loadAnalytics);
  loadAnalyticsRef.current = loadAnalytics;

  useEffect(() => {
    if (!businessId && branches.length === 0) return;

    loadAnalytics();
    loadOrders();
    loadProducts();
    loadLowStockAlerts();
    loadWallet();
    loadSettings();
    loadStories();
    loadAffiliate();
    if (brandId) {
      loadBrandAnalytics();
      loadBranchWallets();
    }

    const ordersInterval = setInterval(() => {
      loadOrdersRef.current();
    }, 12000);

    return () => clearInterval(ordersInterval);
  }, [businessId, branches.length]);

  // 📡 Dispatch socket : mise à jour temps réel des statuts de commande
  useEffect(() => {
    const socket = getDispatchSocket();
    if (!socket.connected) socket.connect();

    const onStatusChanged = (payload) => {
      if (payload?.orderId) {
        loadOrdersRef.current();
        loadAnalyticsRef.current();
      }
    };
    
    const onNewOrderAlert = (payload) => {
      console.log('[Business] Nouvelle commande reçue:', payload);
      loadOrdersRef.current();
      loadAnalyticsRef.current();
    };
    
    socket.on('orderStatusChanged', onStatusChanged);
    socket.on('newOrderAlert', onNewOrderAlert);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (!socket.connected) socket.connect();
        loadOrdersRef.current();
        loadAnalyticsRef.current();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      socket.off('orderStatusChanged', onStatusChanged);
      socket.off('newOrderAlert', onNewOrderAlert);
    };
  }, []);

  const handleBranchChange = useCallback((branchId) => {
    setSelectedBranchId(branchId);
  }, []);

  const loadConversations = useCallback(async () => {
    setChatLoading(true);
    try {
      const data = await getActiveConversations();
      setConversations(Array.isArray(data) ? data : []);
    } catch {
      setConversations([]);
    } finally {
      setChatLoading(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (chatSocketRef.current) {
        chatSocketRef.current.off('newOrderMessage');
        if (selectedChatOrder) {
          chatSocketRef.current.emit('leaveOrderChat', { orderId: selectedChatOrder, channel: chatChannel });
        }
      }
    };
  }, [selectedChatOrder, chatChannel]);

  // ✅ FIX #25 : le canal est passé explicitement en paramètre.
  // setChatChannel(ch) est async : lire chatChannel du closure dans le même
  // handler donnerait l'ANCIENNE valeur → historique/room socket sur le mauvais canal.
  const handleViewChatHistory = async (orderId, channel) => {
    setSelectedChatOrder(orderId);
    setChatHistoryLoading(true);

    // Si aucun canal spécifié, utiliser celui de la conversation (dernier message)
    if (!channel) {
      const conv = conversations.find(c => c.orderId === orderId);
      channel = conv?.channel || 'merchant';
    }
    setChatChannel(channel);

    try {
      const data = await getChatHistory(orderId, channel);
      setChatHistory(data?.history || data || []);
    } catch {
      setChatHistory([]);
    } finally {
      setChatHistoryLoading(false);
    }

    if (chatSocketRef.current) {
      chatSocketRef.current.emit('leaveOrderChat', { orderId: selectedChatOrder, channel: chatChannel });
      chatSocketRef.current.off('newOrderMessage');
    }

    const socket = getChatSocket();
    chatSocketRef.current = socket;
    if (!socket.connected) socket.connect();

    socket.emit('joinOrderChat', { orderId, channel }, (res) => {
      if (res?.status === 'ok') {
        setChatHistory(res.history || []);
      }
    });

    socket.on('newOrderMessage', (msg) => {
      if (msg.orderId === orderId && msg.channel === channel) {
        setChatHistory((prev) => [...prev, msg]);
      }
    });
  };

  const handleSendChatMessage = () => {
    if (!chatInput.trim() || !selectedChatOrder || !chatSocketRef.current) return;
    chatSocketRef.current.emit('sendOrderMessage', {
      orderId: selectedChatOrder,
      channel: chatChannel,
      message: chatInput.trim(),
    });
    setChatInput('');
  };

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

  const handleStockAdjustment = (productId, adjustment, reason) => {
    setProducts(prev => prev.map(p => {
      if (p.id === productId) {
        const newQuantity = Math.max(0, p.stockQuantity + adjustment);
        return { 
          ...p, 
          stockQuantity: newQuantity,
          inventoryStatus: newQuantity <= p.minStockAlert ? InventoryStatus.LOW_STOCK : InventoryStatus.IN_STOCK
        };
      }
      return p;
    }));
    loadLowStockAlerts();
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
    navigate('/login');
  };

  // Filtrage
  const filteredOrders = statusFilter === 'ALL'
    ? orders
    : orders.filter(o => o.status === statusFilter);

  const filteredProducts = productTypeFilter === 'ALL'
    ? products
    : products.filter(p => p.type === productTypeFilter);

  // Statuts réellement actifs : PENDING (non payé) en est EXCLU — une commande
  // sans paiement n'est jamais une commande à traiter ; le filtre « En attente »
  // reste accessible dans l'onglet Commandes pour le suivi.
  const activeOrderStatuses = ['PAID', 'IN_PREPARATION', 'READY_FOR_PICKUP', 'DRIVER_ASSIGNED', 'IN_DELIVERY'];
  const tabs = [
    { id: 'overview', label: 'Vue d\'ensemble', icon: Layout },
    { id: 'orders', label: 'Commandes', icon: ShoppingBag, badge: orders.filter(o => activeOrderStatuses.includes(o.status)).length },
    { id: 'products', label: 'Stock & Catalogue', icon: Package, badge: lowStockAlerts.length },
    { id: 'affiliate', label: 'Affiliation', icon: Share2 },
    { id: 'stories', label: 'Stories', icon: Camera },
    { id: 'chat-inbox', label: 'Messagerie', icon: MessageSquare },
    { id: 'push-campaigns', label: 'Campagnes push', icon: Megaphone },
    { id: 'disputes', label: 'Litiges', icon: Shield },
    { id: 'settings', label: 'Paramètres', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-background-primary flex">
      {/* ─── SIDEBAR ─────────────────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-60 bg-background-card border-r border-border-light fixed h-full z-20 overflow-y-auto">
        <div className="p-5 border-b border-border-light">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-accent-primary">
              <span className="text-white text-sm font-bold">FF</span>
            </div>
            <div>
              <p className="text-text-primary font-bold text-sm">FasoFree</p>
              <p className="text-text-tertiary text-[13px]">Dashboard Commerçant</p>
            </div>
          </div>
        </div>

        <div className="p-4 border-b border-border-light">
          <div className="flex items-center gap-3">
            <div className="avatar w-9 h-9 text-sm flex-shrink-0">
              {(user?.fullName || user?.name || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-text-primary text-[13px] font-semibold truncate">{user?.fullName || user?.name || 'Commerçant'}</p>
              <p className="text-text-tertiary text-[13px] truncate">{user?.email || ''}</p>
            </div>
          </div>
        </div>

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
                  <span className="w-5 h-5 bg-accent-primary text-white text-[11px] rounded-full flex items-center justify-center font-bold">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 mx-3 mb-3 rounded-lg" style={{ background: 'rgba(193,101,46,0.08)', border: '1px solid rgba(193,101,46,0.15)' }}>
          <div className="flex items-center gap-2 mb-1">
            <Wallet size={13} className="text-accent-primary" />
            <span className="text-text-tertiary text-[13px]">Portefeuille</span>
          </div>
          <p className="text-text-primary text-sm font-bold">
            {(selectedBranchId
              ? (wallet?.balance || 0)
              : (brandWallets?.totalBalance ?? wallet?.balance ?? 0)
            ).toLocaleString()} FCFA
          </p>
          <p className="text-text-tertiary text-[11.5px]">
            {selectedBranchId ? 'Agence sélectionnée' : 'Total toutes agences'}
          </p>
          {/* 💳 Sans recharge possible, aucune campagne payante ne peut être
              financée. Le rôle du portefeuille est déduit du JWT côté serveur. */}
          <div className="mt-2">
            <WalletTopupButton
              label={selectedBranchId ? 'Recharger cette agence' : 'Recharger'}
              className="w-full justify-center"
              branchId={selectedBranchId || undefined}
            />
          </div>
        </div>

        <div className="p-3 border-t border-border-light">
          <button onClick={handleLogout} className="nav-item w-full text-status-error hover:bg-status-errorBg">
            <LogOut size={16} strokeWidth={1.5} />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* ─── MAIN CONTENT ────────────────────────────────────────── */}
      <main className="flex-1 lg:ml-60 min-h-screen">
        <header className="lg:hidden flex items-center justify-between px-4 py-4 border-b border-border-light bg-background-card sticky top-0 z-10">
          <p className="text-text-primary font-bold">FasoFree Business</p>
          <button onClick={handleLogout} className="btn-icon">
            <LogOut size={16} />
          </button>
        </header>

        <div className="lg:hidden flex overflow-x-auto scrollbar-hide gap-2 px-4 pt-4 pb-2 border-b border-border-light">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`tab-btn flex-shrink-0 flex min-h-[44px] items-center gap-1.5 px-4 py-3 rounded-xl text-[13.5px] font-medium whitespace-nowrap ${activeTab === tab.id ? 'active' : ''}`}
              >
                <Icon size={14} strokeWidth={1.5} />
                <span className="text-[13px]">{tab.label}</span>
                {tab.badge > 0 && <span className="w-4 h-4 bg-accent-primary text-white text-[11px] rounded-full flex items-center justify-center">{tab.badge}</span>}
              </button>
            );
          })}
        </div>

        <div className="p-4 sm:p-6 lg:p-8">

          {/* ──────────────────────────────────────────────────────── */}
          {/* ONGLET VUE D'ENSEMBLE */}
          {/* ──────────────────────────────────────────────────────── */}
          {activeTab === 'overview' && (
            <div className="animate-slide-up">
              <PageHero
                title={selectedBranchId ? branches.find(b => b.id === selectedBranchId)?.name || 'Agence' : 'Vue Marque'}
                right={
                  <div className="flex flex-wrap items-center gap-3">
                    {branches.length > 0 && (
                      <BranchSelector
                        branches={branches}
                        selectedBranchId={selectedBranchId}
                        onSelectBranch={handleBranchChange}
                      />
                    )}
                    <CallSupportButton label="Appeler le support" />
                  </div>
                }
                actions={[
                  {
                    label: 'Actualiser',
                    onClick: () => { loadAnalytics(); loadOrders(); loadProducts(); },
                    variant: 'secondary',
                  },
                ]}
              />

              {/* Graphique Revenus TradingView */}
              {brandAnalytics?.salesChart?.length > 0 && (
                <div className="mb-6">
                  <BrandChart
                    data={brandAnalytics.salesChart.map(d => ({ time: d.date, value: d.sales }))}
                    type="area"
                    title="Evolution des revenus"
                    height={280}
                    formatValue={(v) => `${v?.toLocaleString()} FCFA`}
                  />
                </div>
              )}

              {/* Cartes financières par agence (vue marque) */}
              {!selectedBranchId && brandAnalytics?.branches?.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3 ml-1">
                    <h3 className="text-[13.5px] font-bold text-text-primary">Agences</h3>
                    {brandWallets && (
                      <span className="text-[13px] text-text-secondary">
                        Total toutes agences : <strong>{(brandWallets.totalBalance || 0).toLocaleString()} FCFA</strong>
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {brandAnalytics.branches.map((branch) => (
                      <BranchFinancialCard
                        key={branch.businessId}
                        branch={branches.find(b => b.id === branch.businessId) || { name: branch.name, isOpen: true }}
                        analytics={branch}
                        wallet={branchWallets[branch.businessId]}
                        isSelected={selectedBranchId === branch.businessId}
                        onClick={() => setSelectedBranchId(branch.businessId)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Stock Alerts */}
              {lowStockAlerts.length > 0 && (
                <div className="mb-6 p-4 bg-status-warningBg border border-status-warning/30 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle size={16} className="text-status-warning" />
                    <h3 className="font-bold text-text-primary text-sm">Alertes de Stock Bas</h3>
                  </div>
                  <div className="space-y-2">
                    {lowStockAlerts.slice(0, 3).map(product => (
                      <div key={product.id} className="flex items-center justify-between text-sm">
                        <span className="text-text-primary">{product.name}</span>
                        <span className="text-status-warning font-semibold">{product.stockQuantity} {product.trackInventory ? 'unités' : ''}</span>
                      </div>
                    ))}
                    {lowStockAlerts.length > 3 && (
                      <button onClick={() => setActiveTab('products')} className="text-accent-primary text-[13px] font-semibold">
                        Voir les {lowStockAlerts.length - 3} autres alertes
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <StatCard
                  label="Commandes"
                  value={analytics?.totalOrders ?? orders.length}
                  icon={ShoppingBag}
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
                  label="Stock Bas"
                  value={lowStockAlerts.length}
                  icon={AlertTriangle}
                  color="#F59E0B"
                  loading={loading.alerts}
                />
              </div>

              {/* 🎚️ Qualité de livraison (bloc B) */}
              <div className="card p-5 mb-6">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-sm font-bold text-text-primary">Qualité de livraison</h2>
                  <span className="text-[11px] text-text-tertiary">
                    {sla.total} livraison(s) terminée(s)
                  </span>
                </div>
                <p className="text-[13px] text-text-secondary mb-4">
                  Retard constaté au-delà de +25 % de l&apos;ETA estimée. Une livraison
                  en retard déclenche un avertissement automatique pour le livreur.
                </p>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="rounded-lg bg-background-secondary p-3">
                    <p className="text-[11.5px] text-text-tertiary">À temps</p>
                    <p className="text-xl font-bold text-status-success">
                      {sla.rate == null ? '—' : `${sla.rate} %`}
                    </p>
                  </div>
                  <div className="rounded-lg bg-background-secondary p-3">
                    <p className="text-[11.5px] text-text-tertiary">En retard</p>
                    <p className="text-xl font-bold text-status-error">{sla.late}</p>
                  </div>
                  <div className="rounded-lg bg-background-secondary p-3">
                    <p className="text-[11.5px] text-text-tertiary">Durée moyenne</p>
                    <p className="text-xl font-bold text-text-primary">
                      {sla.avgDuration == null ? '—' : `${Math.round(sla.avgDuration)} min`}
                    </p>
                  </div>
                  <div className="rounded-lg bg-background-secondary p-3">
                    <p className="text-[11.5px] text-text-tertiary">Dont livrées</p>
                    <p className="text-xl font-bold text-text-primary">{sla.total}</p>
                  </div>
                </div>
              </div>

              {errors.analytics && !errors.analytics.includes('401') && !errors.analytics.includes('Non autorisé') && (
                <div className="mb-6 p-3 bg-status-warningBg border border-status-warning/30 rounded-md text-status-warning text-sm flex items-center gap-2">
                  <AlertCircle size={14} /> Analytics indisponibles (backend requis). Données partielles affichées.
                </div>
              )}

              {/* Commandes récentes */}
              <div className="card p-5 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-bold text-text-primary">Commandes récentes</h2>
                  <button onClick={() => setActiveTab('orders')} className="text-accent-primary text-[13px] font-semibold">
                    Voir tout
                  </button>
                </div>
                <div className="space-y-3">
                  {orders.slice(0, 5).map(order => (
                    <div key={order.id} className="flex items-center justify-between p-3 bg-background-secondary rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-accent-primary/10 flex items-center justify-center">
                          <ShoppingBag size={14} className="text-accent-primary" />
                        </div>
                        <div>
                          <p className="text-[13px] font-semibold text-text-primary">#{order.id?.slice(-6)}</p>
                          <p className="text-[11.5px] text-text-secondary">{order.createdAt ? new Date(order.createdAt).toLocaleDateString('fr-FR') : '—'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <StatusBadge status={order.status} />
                        <p className="text-[11.5px] text-text-tertiary mt-1">{order.totalAmount?.toLocaleString()} FCFA</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ──────────────────────────────────────────────────────── */}
          {/* ONGLET COMMANDES */}
          {/* ──────────────────────────────────────────────────────── */}
          {activeTab === 'orders' && (
            <div className="animate-slide-up">
              <div className="flex flex-wrap gap-4 items-center justify-between mb-6">
                <h1 className="text-xl font-bold text-text-primary">Gestion des Commandes</h1>
                <div className="flex gap-2">
                  <select 
                    className="input-field py-1.5 text-[13px]"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="ALL">Tous les statuts</option>
                    <option value="PENDING">En attente</option>
                    <option value="PAID">Payées</option>
                    <option value="IN_PREPARATION">En préparation</option>
                    <option value="READY_FOR_PICKUP">Prêtes</option>
                    <option value="DRIVER_ASSIGNED">Livreur assigné</option>
                    <option value="IN_DELIVERY">En livraison</option>
                    <option value="DELIVERED_PENDING_CONFIRMATION">Livrées (attente)</option>
                    <option value="DELIVERED">Livrées</option>
                    <option value="COMPLETED">Terminées</option>
                    <option value="CANCELLED">Annulées</option>
                  </select>
                  <button onClick={loadOrders} className="btn-secondary gap-2">
                    <RefreshCw size={12} className={loading.orders ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>

              {errors.orders && (
                <div className="mb-6 p-3 bg-status-errorBg border border-status-error/30 rounded-md text-status-error text-sm flex items-center gap-2">
                  <AlertCircle size={14} /> {errors.orders}
                </div>
              )}

              <div className="space-y-4">
                {loading.orders ? (
                  [1,2,3].map(i => (
                    <div key={i} className="card p-5">
                      <LoadingSkeleton height="h-4" className="mb-2" />
                      <LoadingSkeleton height="h-3" width="w-2/3" />
                    </div>
                  ))
                ) : filteredOrders.length === 0 ? (
                  <EmptyState
                    icon={ShoppingBag}
                    title="Aucune commande trouvée"
                    description="Aucune commande ne correspond aux filtres sélectionnés."
                  />
                ) : (
                  filteredOrders.map(order => {
                    const nextStatuses = getNextPossibleStatuses(order.status, 'business_admin');
                    return (
                      <div key={order.id} className="card p-5">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h3 className="font-bold text-text-primary">Commande #{order.id?.slice(-6)}</h3>
                            <p className="text-[13px] text-text-secondary">
                              {new Date(order.createdAt).toLocaleDateString('fr-FR')} à {new Date(order.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          <StatusBadge status={order.status} />
                        </div>

                        {/* Order Stepper */}
                        <OrderStatusStepper currentStatus={order.status} steps={getOrderSteps(order.status)} />

                        <div className="grid grid-cols-2 gap-4 mt-4 mb-4">
                          <div className="p-3 bg-background-secondary rounded-lg min-w-0">
                            <p className="text-[13px] text-text-secondary">Client</p>
                            <p className="text-sm font-semibold text-text-primary truncate">{order.customerName || 'N/A'}</p>
                          </div>
                          <div className="p-3 bg-background-secondary rounded-lg min-w-0">
                            <p className="text-[13px] text-text-secondary">Total</p>
                            <p className="text-sm font-semibold text-text-primary tabular-nums">{order.totalAmount?.toLocaleString()} FCFA</p>
                          </div>
                        </div>

                        {order.deliveryProvider && (
                          <div className="mb-4 p-3 bg-background-secondary rounded-lg">
                            <p className="text-[13px] text-text-secondary">
                              Livraison confiée à
                            </p>
                            {/* 🏢 Lot 1 : quand une société de livraison a pris
                                la course, on affiche SON nom (et son logo), pas
                                le générique « Agence partenaire ». Le marchand
                                sait ainsi à qui attribuer la livraison. */}
                            {order.agency ? (
                              <div className="mt-1 flex items-center gap-2">
                                {order.agency.logoUrl ? (
                                  <img
                                    src={order.agency.logoUrl}
                                    alt={order.agency.name}
                                    className="w-7 h-7 rounded-lg object-cover shrink-0"
                                  />
                                ) : (
                                  <div
                                    className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[13px] font-bold shrink-0"
                                    style={{
                                      backgroundColor:
                                        order.agency.brandColor || '#C1652E',
                                    }}
                                  >
                                    {String(order.agency.name || '?')
                                      .charAt(0)
                                      .toUpperCase()}
                                  </div>
                                )}
                                <p className="flex items-center gap-1 text-sm font-semibold text-text-primary">
                                  <span className="truncate">
                                    {order.agency.name}
                                  </span>
                                  {order.agency.isVerified && (
                                    <BadgeCheck
                                      size={13}
                                      className="text-status-success shrink-0"
                                      aria-label="Société vérifiée"
                                    />
                                  )}
                                </p>
                              </div>
                            ) : (
                              <p className="text-sm font-semibold text-text-primary">
                                {order.deliveryProvider === 'agency'
                                  ? 'Agence partenaire'
                                  : order.deliveryProvider === 'manual'
                                    ? 'File manuelle'
                                    : order.deliveryProvider === 'internal'
                                      ? 'Livreur FasoFree'
                                      : order.deliveryProvider}
                              </p>
                            )}
                            {order.deliveryProviderStatus === 'ESCALATED' && (
                              <span className="text-[13px] text-status-error">
                                · escaladée
                              </span>
                            )}
                          </div>
                        )}

                        {/* Status Actions */}
                        {nextStatuses.length > 0 && (
                          <div className="flex gap-2">
                            {order.status === 'READY_FOR_PICKUP' && (
                              <button
                                onClick={() => openDriverModal(order)}
                                className="text-[13px] py-2 px-3 rounded-lg border border-accent-primary/30 text-accent-primary hover:bg-accent-primary/10 transition-colors font-medium"
                              >
                                Assigner un livreur
                              </button>
                            )}
                            {nextStatuses.map(status => (
                              <button
                                key={status}
                                onClick={() => handleUpdateStatus(order.id, status)}
                                disabled={updating[order.id]}
                                className="btn-primary px-3"
                              >
                                {updating[order.id] ? '...' : getStatusInfo(status).label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ──────────────────────────────────────────────────────── */}
          {/* ONGLET STOCK & CATALOGUE */}
          {/* ──────────────────────────────────────────────────────── */}
          {activeTab === 'products' && (
            <div className="animate-slide-up">
              <div className="flex flex-wrap gap-4 items-center justify-between mb-6">
                <h1 className="text-xl font-bold text-text-primary">Stock & Catalogue</h1>
                <div className="flex flex-wrap gap-2">
                  <select 
                    className="input-field py-1.5 text-[13px]"
                    value={productTypeFilter}
                    onChange={(e) => setProductTypeFilter(e.target.value)}
                  >
                    <option value="ALL">Tous les types</option>
                    <option value={ProductType.RETAIL}>Retail</option>
                    <option value={ProductType.FOOD}>Restauration</option>
                    <option value={ProductType.PHARMACY}>Pharmacie</option>
                    <option value={ProductType.SERVICE}>Services</option>
                  </select>
                  <button onClick={() => setProductModal('new')} className="btn-primary gap-2">
                    <Plus size={12} /> Nouveau produit
                  </button>
                  <button onClick={loadProducts} className="btn-secondary gap-2">
                    <RefreshCw size={12} className={loading.products ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>

              {errors.products && (
                <div className="mb-6 p-3 bg-status-errorBg border border-status-error/30 rounded-md text-status-error text-sm flex items-center gap-2">
                  <AlertCircle size={14} /> {errors.products}
                </div>
              )}

              {/* Low Stock Alerts */}
              {lowStockAlerts.length > 0 && (
                <div className="mb-6 p-4 bg-status-warningBg border border-status-warning/30 rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle size={16} className="text-status-warning" />
                    <h3 className="font-bold text-text-primary text-sm">Produits en stock bas</h3>
                  </div>
                  <div className="space-y-2">
                    {lowStockAlerts.map(product => (
                      <div key={product.id} className="flex items-center justify-between p-2 bg-background-secondary rounded">
                        <div className="flex items-center gap-2">
                          <Search size={14} className="text-status-warning" />
                          <span className="text-sm text-text-primary">{product.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-status-warning font-semibold text-sm">{product.stockQuantity}</span>
                          <button 
                            onClick={() => setStockModal(product)}
                            className="btn-icon text-[13px]"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="card overflow-hidden">
                {/* Desktop : tableau 7 colonnes */}
                <div className="table-container hidden md:block">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Produit</th>
                        <th>SKU</th>
                        <th>Type</th>
                        <th>Prix</th>
                        <th>Stock</th>
                        <th>Statut</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading.products ? (
                        [1,2,3,4].map(i => (
                          <tr key={i}>
                            <td colSpan="7"><LoadingSkeleton height="h-8" /></td>
                          </tr>
                        ))
                      ) : filteredProducts.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="text-center py-8 text-text-secondary">Aucun produit trouvé</td>
                        </tr>
                      ) : (
                        filteredProducts.map(product => (
                          <tr key={product.id}>
                            <td>
                              <div className="flex items-center gap-3">
                                {product.imageUrl && (
                                  <img src={product.imageUrl.startsWith('/') ? (import.meta.env.VITE_API_URL || 'https://api.fasofree.site/api/v1').replace(/\/api\/v1$/, '') + product.imageUrl : product.imageUrl} alt={product.name} className="w-10 h-10 rounded object-cover" onError={(e) => { e.target.onerror = null; e.target.style.display = 'none'; }} />
                                )}
                                <div>
                                  <p className="font-bold text-text-primary text-sm">{product.name}</p>
                                  <p className="text-text-tertiary text-[13px]">{product.category}</p>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className="text-[13px] font-mono text-text-secondary">{product.sku || '—'}</span>
                            </td>
                            <td>
                              <span className="text-[13px] text-text-secondary">{product.type}</span>
                            </td>
                            <td>
                              <span className="text-sm font-semibold text-text-primary">{product.price?.toLocaleString()} FCFA</span>
                            </td>
                            <td>
                              {product.trackInventory ? (
                                <div className="flex items-center gap-2">
                                  <span className={`text-sm font-semibold ${
                                    product.stockQuantity <= product.minStockAlert ? 'text-status-warning' : 'text-text-primary'
                                  }`}>
                                    {product.stockQuantity}
                                  </span>
                                  <button 
                                    onClick={() => setStockModal(product)}
                                    className="btn-icon text-[13px]"
                                  >
                                    <Plus size={10} />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[13px] text-text-tertiary">N/A</span>
                              )}
                            </td>
                            <td>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleToggleAvailability(product.id)}
                                  className={`transition-colors ${product.isAvailable ? 'text-status-success' : 'text-text-tertiary'}`}
                                >
                                  {product.isAvailable ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                                </button>
                              </div>
                            </td>
                            <td>
                              <div className="flex gap-1">
                                <button onClick={() => setProductModal(product)} className="btn-icon">
                                  <Pencil size={14} />
                                </button>
                                <button onClick={() => handleDeleteProduct(product.id)} className="btn-icon text-status-error">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Mobile : mêmes données en cartes — pas de glissement horizontal */}
                <div className="md:hidden divide-y divide-border-light">
                  {loading.products ? (
                    [1,2,3,4].map(i => (
                      <div key={i} className="p-4"><LoadingSkeleton height="h-16" /></div>
                    ))
                  ) : filteredProducts.length === 0 ? (
                    <p className="text-center py-8 text-text-secondary text-sm">Aucun produit trouvé</p>
                  ) : (
                    filteredProducts.map(product => (
                      <div key={product.id} className="p-4 space-y-2">
                        <div className="flex items-center gap-3">
                          {product.imageUrl && (
                            <img src={product.imageUrl.startsWith('/') ? (import.meta.env.VITE_API_URL || 'https://api.fasofree.site/api/v1').replace(/\/api\/v1$/, '') + product.imageUrl : product.imageUrl} alt={product.name} className="w-11 h-11 shrink-0 rounded object-cover" onError={(e) => { e.target.onerror = null; e.target.style.display = 'none'; }} />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-text-primary text-sm truncate">{product.name}</p>
                            <p className="text-text-tertiary text-[13px] truncate">{product.category} · {product.type}</p>
                          </div>
                          <button
                            onClick={() => handleToggleAvailability(product.id)}
                            className={`shrink-0 transition-colors ${product.isAvailable ? 'text-status-success' : 'text-text-tertiary'}`}
                            title={product.isAvailable ? 'Disponible' : 'Indisponible'}
                          >
                            {product.isAvailable ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                          </button>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
                          <span className="font-semibold text-text-primary tabular-nums">{product.price?.toLocaleString()} FCFA</span>
                          <span className="font-mono text-text-secondary">{product.sku || '—'}</span>
                          {product.trackInventory ? (
                            <span className={product.stockQuantity <= product.minStockAlert ? 'text-status-warning font-semibold' : 'text-text-secondary'}>
                              Stock : {product.stockQuantity}
                            </span>
                          ) : (
                            <span className="text-text-tertiary">Stock : N/A</span>
                          )}
                          {product.trackInventory && (
                            <button
                              onClick={() => setStockModal(product)}
                              className="btn-icon text-[13px]"
                              title="Ajuster le stock"
                            >
                              <Plus size={12} />
                            </button>
                          )}
                        </div>
                        <div className="flex justify-end gap-1">
                          <button onClick={() => setProductModal(product)} className="btn-icon" title="Modifier">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => handleDeleteProduct(product.id)} className="btn-icon text-status-error" title="Supprimer">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ──────────────────────────────────────────────────────── */}
          {/* ONGLET AFFILIATION */}
          {/* ──────────────────────────────────────────────────────── */}
          {activeTab === 'affiliate' && (
            <div className="animate-slide-up space-y-6">
              <div className="flex items-center justify-between">
                <h1 className="text-xl font-bold text-text-primary">Affiliation Marchand</h1>
                <p className="text-text-secondary text-sm">
                  Partagez votre lien de suivi pour attirer de nouveaux clients et gagner des commissions.
                </p>
              </div>

              {affiliateError && (
                <div className="card p-4 border-border-error/20 bg-status-error/5">
                  <p className="text-status-error text-sm">{affiliateError}</p>
                </div>
              )}

              {affiliateLoading ? (
                <div className="card p-8 text-center">
                  <div className="w-8 h-8 border-4 border-accent-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-text-secondary text-sm">Chargement de vos stats d'affiliation…</p>
                </div>
              ) : affiliateData ? (
                <>
                  {/* Lien de suivi */}
                  <div className="card p-5 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-accent-primary/15 flex items-center justify-center">
                        <Share2 size={18} className="text-accent-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-text-primary">Votre lien de suivi</p>
                        <p className="text-text-tertiary text-[13px]">Partagez-le sur WhatsApp, TikTok, QR Code…</p>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <input
                        type="text"
                        readOnly
                        value={affiliateData.link?.restaurantUrl || affiliateData.link?.url || ''}
                        className="flex-1 min-w-0 px-3 py-2.5 text-sm border border-border-light rounded-lg bg-background-secondary text-text-primary"
                        placeholder="Lien en cours de chargement…"
                      />
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(affiliateData.link?.restaurantUrl || affiliateData.link?.url || '');
                        }}
                        className="btn-secondary flex items-center gap-2 px-4"
                      >
                        <Copy size={14} />
                        Copier
                      </button>
                      <button
                        onClick={() => {
                          const url = affiliateData.link?.restaurantUrl || affiliateData.link?.url || '';
                          window.open(`${import.meta.env.VITE_API_URL || 'https://api.fasofree.site'}/qr?data=${encodeURIComponent(url)}`, '_blank');
                        }}
                        className="btn-secondary flex items-center gap-2 px-4"
                        title="QR Code"
                      >
                        <QrCode size={14} />
                      </button>
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent('Découvrez ' + (user?.fullName || 'mon commerce') + ' sur FasoFree : ' + (affiliateData.link?.restaurantUrl || affiliateData.link?.url || ''))}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-secondary flex items-center gap-2 px-4"
                        title="Partager sur WhatsApp"
                      >
                        <ExternalLink size={14} />
                        WhatsApp
                      </a>
                    </div>
                    <p className="text-text-tertiary text-[13px]">
                      Code affilié : <code className="font-mono text-text-primary">{affiliateData.link?.code || '—'}</code>
                    </p>
                  </div>

                  {/* Stats du funnel */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard
                      label="Clics"
                      value={affiliateData.stats?.clicks || 0}
                      icon={ExternalLink}
                      trend="neutral"
                    />
                    <StatCard
                      label="Inscriptions"
                      value={affiliateData.stats?.signups || 0}
                      icon={Users}
                      trend={affiliateData.stats?.signups > 0 ? 'up' : 'neutral'}
                    />
                    <StatCard
                      label="Commandes"
                      value={affiliateData.stats?.orders || 0}
                      icon={ShoppingBag}
                      trend={affiliateData.stats?.orders > 0 ? 'up' : 'neutral'}
                    />
                    <StatCard
                      label="Revenus"
                      value={`${(affiliateData.stats?.revenue || 0).toLocaleString()} FCFA`}
                      icon={TrendingUp}
                      trend={affiliateData.stats?.revenue > 0 ? 'up' : 'neutral'}
                    />
                  </div>

                  {/* Détail du taux de conversion */}
                  <div className="card p-5">
                    <h3 className="text-sm font-semibold text-text-primary mb-4">Tunnel de conversion</h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Clics → Inscriptions</span>
                        <span className="text-text-primary font-medium">
                          {affiliateData.stats?.clicks > 0
                            ? `${((affiliateData.stats.signups / affiliateData.stats.clicks) * 100).toFixed(1)}%`
                            : '—'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Inscriptions → Commandes</span>
                        <span className="text-text-primary font-medium">
                          {affiliateData.stats?.signups > 0
                            ? `${((affiliateData.stats.orders / affiliateData.stats.signups) * 100).toFixed(1)}%`
                            : '—'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Clics → Commandes (global)</span>
                        <span className="text-text-primary font-medium">
                          {affiliateData.stats?.conversionRate || 0}%
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="card p-12 text-center">
                  <Share2 size={40} className="mx-auto text-text-tertiary mb-4" strokeWidth={1} />
                  <p className="text-text-secondary text-sm font-medium">Aucune donnée d'affiliation</p>
                  <p className="text-text-tertiary text-[13px] mt-1">Votre lien de suivi sera généré automatiquement.</p>
                  <button
                    onClick={() => { loadAffiliate(); }}
                    className="btn-primary mt-4 flex items-center gap-2 mx-auto px-4 py-3"
                  >
                    <RefreshCw size={14} />
                    Actualiser
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ──────────────────────────────────────────────────────── */}
          {/* ONGLET STORIES */}
          {activeTab === 'stories' && (
            <div className="animate-slide-up space-y-6">
              <div className="flex items-center justify-between">
                <h1 className="text-xl font-bold text-text-primary">Stories</h1>
                <button
                  onClick={() => setStoryModal(true)}
                  className="btn-primary flex items-center gap-2 px-4"
                >
                  <Plus size={16} />
                  Nouvelle story
                </button>
              </div>

              {errors.stories && (
                <p className="text-sm text-status-error">{errors.stories}</p>
              )}

              {storiesLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="aspect-[9/16] bg-background-secondary rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : stories.length === 0 ? (
                <div className="card p-12 text-center">
                  <Camera size={40} className="mx-auto text-text-tertiary mb-4" strokeWidth={1} />
                  <p className="text-text-secondary text-sm font-medium">Aucune story active sur vos agences</p>
                  <p className="text-text-tertiary text-[13px] mt-1">Vos stories durent 24 h et apparaissent sur l'accueil client.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {stories.map(group => (
                    <div key={group.businessId}>
                      <div className="flex items-center gap-3 mb-3">
                        {group.businessImage ? (
                          <img src={group.businessImage} alt="" className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-accent-primary/15 flex items-center justify-center">
                            <span className="text-accent-primary text-[13px] font-bold">
                              {(group.businessName || 'FF').slice(0, 2).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <p className="text-sm font-semibold text-text-primary">{group.businessName}</p>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {(group.stories || []).map(story => (
                          <div key={story.id} className="relative aspect-[9/16] rounded-xl overflow-hidden bg-background-secondary group">
                            <img src={story.mediaUrl} alt="" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                            <div className="absolute top-2 left-2 flex items-center gap-1 text-white/90 text-[11.5px]">
                              <Eye size={10} />
                              <span>{story.viewsCount || 0}</span>
                            </div>
                            <button
                              onClick={() => handleDeleteStory(story.id)}
                              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-all"
                              title="Supprimer"
                            >
                              <Trash2 size={12} />
                            </button>
                            {story.caption && (
                              <p className="absolute bottom-2 left-2 right-2 text-white text-[11px] line-clamp-2">
                                {story.caption}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ──────────────────────────────────────────────────────── */}
          {/* ONGLET MESSAGERIE */}
          {/* ──────────────────────────────────────────────────────── */}
          {activeTab === 'chat-inbox' && (
            <div className="space-y-6 animate-slide-up">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-text-primary">Messagerie</h2>
                <button onClick={loadConversations} className="btn-secondary gap-2">
                  <RefreshCw size={14} className={chatLoading ? 'animate-spin' : ''} />
                  Actualiser
                </button>
              </div>
              {chatLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <div key={i} className="card p-5"><LoadingSkeleton height="h-4" /></div>)}
                </div>
              ) : conversations.length === 0 ? (
                <EmptyState icon={MessageSquare} title="Aucune conversation" description="Aucune conversation active pour le moment." />
              ) : (
                <div className="space-y-2">
                  {conversations.map(conv => (
                    <button
                      key={conv.orderId}
                      onClick={() => handleViewChatHistory(conv.orderId)}
                      className={`card p-4 w-full text-left hover:bg-background-secondary transition ${selectedChatOrder === conv.orderId ? 'ring-2 ring-accent-primary' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-text-primary">Commande #{conv.orderId?.slice(-8)}</p>
                          <p className="text-[13px] text-text-tertiary">{conv.messageCount || 0} messages</p>
                        </div>
                        <Clock size={14} className="text-text-tertiary" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {selectedChatOrder && (
                <div className="card p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-text-primary">Commande #{selectedChatOrder?.slice(-8)}</h3>
                    <div className="flex gap-2">
                      {['merchant', 'driver'].map(ch => (
                        <button
                          key={ch}
                          onClick={() => { setChatChannel(ch); handleViewChatHistory(selectedChatOrder, ch); }}
                          className={`text-[11.5px] px-2 py-1 rounded-full font-semibold transition ${chatChannel === ch ? 'bg-accent-primary text-white' : 'bg-background-secondary text-text-secondary hover:bg-background-tertiary'}`}
                        >
                          {ch === 'merchant' ? 'Marchand' : 'Livreur'}
                        </button>
                      ))}
                    </div>
                  </div>
                  {chatHistoryLoading ? (
                    <LoadingSkeleton height="h-4" />
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto mb-4">
                      {chatHistory.length === 0 && <p className="text-[13px] text-text-tertiary">Aucun message</p>}
                      {chatHistory.map((msg, i) => (
                        <div key={msg.id || i} className="flex gap-2">
                          <div className="w-6 h-6 rounded-full bg-accent-primary text-white text-[11.5px] font-bold flex items-center justify-center shrink-0">
                            {(msg.senderRole || '?').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="text-[11px] font-semibold text-text-secondary">{msg.senderRole || 'system'}</span>
                            <span className="text-[11.5px] text-text-tertiary ml-2">{msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString('fr-FR') : msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString('fr-FR') : ''}</span>
                            <p className="text-[13px] text-text-secondary">{msg.message}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2 border-t border-border-light pt-3">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendChatMessage()}
                      placeholder="Écrire un message..."
                      className="flex-1 min-w-0 bg-background-secondary border border-border-light rounded-lg px-3 py-2 text-[13px] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-accent-primary"
                    />
                    <button
                      onClick={handleSendChatMessage}
                      disabled={!chatInput.trim()}
                      className="px-3 py-2 bg-accent-primary text-white text-[13px] font-semibold rounded-lg disabled:opacity-40 hover:bg-accent-primary/90 transition"
                    >
                      Envoyer
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ──────────────────────────────────────────────────────── */}
          {/* ONGLET LITIGES (gérant) */}
          {/* ──────────────────────────────────────────────────────── */}
          {activeTab === 'push-campaigns' && <SelfServicePushCampaigns role="merchant" />}
          {activeTab === 'disputes' && <MerchantDisputesTab />}

          {/* ──────────────────────────────────────────────────────── */}
          {/* ONGLET PARAMÈTRES */}
          {/* ──────────────────────────────────────────────────────── */}
          {activeTab === 'settings' && (
            <div className="animate-slide-up space-y-6">
              <h1 className="text-xl font-bold text-text-primary mb-6">Paramètres du Commerce</h1>
              
              {/* Configuration des modes de commande */}
              <div className="card p-6">
                <h3 className="font-bold text-text-primary mb-4 flex items-center gap-2">
                  <Settings size={16} className="text-accent-primary" />
                  Modes de commande
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-background-secondary rounded-lg">
                    <div>
                      <p className="font-semibold text-text-primary text-sm">Livraison à domicile</p>
                      <p className="text-text-tertiary text-[13px]">FasoFree dispatche des livreurs</p>
                    </div>
                    <button
                      onClick={() => toggleSetting('enableDelivery')}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        businessSettings.enableDelivery ? 'bg-accent-primary' : 'bg-border-light'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                        businessSettings.enableDelivery ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 bg-background-secondary rounded-lg">
                    <div>
                      <p className="font-semibold text-text-primary text-sm">Click & Collect (À emporter)</p>
                      <p className="text-text-tertiary text-[13px]">Clients viennent récupérer</p>
                    </div>
                    <button
                      onClick={() => toggleSetting('enablePickup')}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        businessSettings.enablePickup ? 'bg-accent-primary' : 'bg-border-light'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                        businessSettings.enablePickup ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 bg-background-secondary rounded-lg">
                    <div>
                      <p className="font-semibold text-text-primary text-sm">Consommation sur place</p>
                      <p className="text-text-tertiary text-[13px]">Réservations de tables</p>
                    </div>
                    <button
                      onClick={() => toggleSetting('enableDineIn')}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        businessSettings.enableDineIn ? 'bg-accent-primary' : 'bg-border-light'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                        businessSettings.enableDineIn ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 bg-background-secondary rounded-lg">
                    <div>
                      <p className="font-semibold text-text-primary text-sm">Utiliser mes propres livreurs</p>
                      <p className="text-text-tertiary text-[13px]">Pas de dispatch FasoFree</p>
                    </div>
                    <button
                      onClick={() => toggleSetting('hasOwnDrivers')}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        businessSettings.hasOwnDrivers ? 'bg-accent-primary' : 'bg-border-light'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                        businessSettings.hasOwnDrivers ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>
                </div>
              </div>

              {/* 🕐 Horaires d'ouverture (bloc H) */}
              <div className="card p-6">
                <h3 className="font-bold text-text-primary mb-1 flex items-center gap-2">
                  <Clock size={16} className="text-accent-primary" />
                  Horaires d'ouverture
                </h3>
                <p className="text-text-tertiary text-[13px] mb-4">
                  Ces horaires affinent l'interrupteur « ouvert / fermé » : un commerce
                  ouvert mais hors de ses horaires refuse les commandes. Un jour sans
                  créneau est fermé. Laissez tout vide pour ne piloter que par
                  l'interrupteur.
                </p>
                <div className="space-y-2">
                  {DAYS.map((day) => {
                    const slot = businessSettings.openingHours?.[day.key];
                    return (
                      <div key={day.key} className="flex flex-wrap items-center gap-3 p-3 bg-background-secondary rounded-lg">
                        <span className="w-24 text-sm font-medium text-text-primary">{day.label}</span>
                        {slot ? (
                          <>
                            <input
                              type="time"
                              value={slot.open}
                              onChange={(e) => setDayHours(day.key, 'open', e.target.value)}
                              className="input-field w-28"
                              aria-label={`Ouverture ${day.label}`}
                            />
                            <span className="text-text-tertiary text-[13px]">à</span>
                            <input
                              type="time"
                              value={slot.close}
                              onChange={(e) => setDayHours(day.key, 'close', e.target.value)}
                              className="input-field w-28"
                              aria-label={`Fermeture ${day.label}`}
                            />
                            <button
                              type="button"
                              onClick={() => clearDayHours(day.key)}
                              className="text-[11px] text-text-tertiary underline"
                            >
                              Fermé
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDayHours(day.key, 'open', '08:00')}
                            className="text-[11px] text-accent-primary font-semibold"
                          >
                            + Renseigner des horaires
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="text-[11px] text-text-tertiary mt-3">
                  Astuce : fermeture après minuit (ex. 22:00 → 02:00) est gérée
                  automatiquement comme un service de nuit.
                </p>
              </div>

              {/* 📅 Commandes à l'avance (bloc H) */}
              <div className="card p-6">
                <h3 className="font-bold text-text-primary mb-1 flex items-center gap-2">
                  <Calendar size={16} className="text-accent-primary" />
                  Commandes à l'avance
                </h3>
                <p className="text-text-tertiary text-[13px] mb-4">
                  Permet au client de choisir sa date de livraison. La commande est payée
                  immédiatement mais n'est dispatchée qu'à l'heure choisie.
                </p>

                <div className="flex items-center justify-between p-4 bg-background-secondary rounded-lg mb-4">
                  <div>
                    <p className="font-semibold text-text-primary text-sm">Accepter les commandes à l'avance</p>
                    <p className="text-text-tertiary text-[13px]">Désactivé = livraison immédiate uniquement</p>
                  </div>
                  <button
                    onClick={() =>
                      setAdvanceConfig('enabled', !businessSettings.advanceOrderConfig?.enabled)
                    }
                    className={`w-12 h-6 rounded-full transition-colors ${
                      businessSettings.advanceOrderConfig?.enabled ? 'bg-accent-primary' : 'bg-border-light'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      businessSettings.advanceOrderConfig?.enabled ? 'translate-x-6' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>

                {businessSettings.advanceOrderConfig?.enabled && (
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[13px] font-semibold text-text-tertiary mb-1">
                        Délai minimum (heures)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="72"
                        value={businessSettings.advanceOrderConfig.minHoursAhead ?? 2}
                        onChange={(e) => setAdvanceConfig('minHoursAhead', Number(e.target.value))}
                        className="input-field"
                      />
                      <p className="text-[11px] text-text-tertiary mt-1">
                        Ex. 2 = la livraison la plus proche est dans 2 h.
                      </p>
                    </div>
                    <div>
                      <label className="block text-[13px] font-semibold text-text-tertiary mb-1">
                        Délai maximum (jours)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="30"
                        value={businessSettings.advanceOrderConfig.maxDaysAhead ?? 7}
                        onChange={(e) => setAdvanceConfig('maxDaysAhead', Number(e.target.value))}
                        className="input-field"
                      />
                      <p className="text-[11px] text-text-tertiary mt-1">
                        Ex. 7 = pas de commande à plus d'une semaine.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Identité visuelle : logo + couverture */}
              <div className="card p-6">
                <h3 className="font-bold text-text-primary mb-4">Identité visuelle</h3>
                <div className="grid sm:grid-cols-2 gap-6">
                  <ImageUpload
                    label="Logo du restaurant"
                    folder="logos"
                    value={businessSettings.logo}
                    onChange={(url) => setBusinessSettings(prev => ({ ...prev, logo: url }))}
                  />
                  <ImageUpload
                    label="Image de couverture"
                    folder="covers"
                    value={businessSettings.coverImage}
                    onChange={(url) => setBusinessSettings(prev => ({ ...prev, coverImage: url }))}
                  />
                </div>
              </div>

              {/* Catégorie du commerce (niveau 1) + sous-catégorie (niveau 2) */}
              <div className="card p-6">
                <h3 className="font-bold text-text-primary mb-4">Catégorie du commerce</h3>
                <select
                  value={businessSettings.category}
                  onChange={(e) => setBusinessSettings(prev => ({ ...prev, category: e.target.value, subCategory: '' }))}
                  className="input-field"
                >
                  {(categoryCatalog.length > 0
                    ? categoryCatalog
                    : [
                        { value: 'RESTAURANT', label: 'Restaurant' },
                        { value: 'SUPERMARKET', label: 'Supermarché' },
                        { value: 'BAKERY', label: 'Boulangerie' },
                        { value: 'RETAIL', label: 'Commerce de détail' },
                        { value: 'SERVICES', label: 'Services' },
                      ]
                  ).map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>

                <label className="block text-[13px] font-semibold text-text-tertiary mt-4 mb-2">
                  Sous-catégorie
                </label>
                <select
                  value={businessSettings.subCategory || ''}
                  onChange={(e) => setBusinessSettings(prev => ({ ...prev, subCategory: e.target.value }))}
                  className="input-field"
                >
                  <option value="">— Choisir —</option>
                  {(
                    categoryCatalog.find((c) => c.value === businessSettings.category)
                      ?.subCategories || []
                  ).map((sub) => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                </select>
                <p className="text-[11px] text-text-tertiary mt-2">
                  C'est ce que le client voit dans ses filtres (ex. Fast-Food,
                  Cuisine Locale). Sans sous-catégorie, votre commerce
                  n'apparaîtra pas dans ces filtres.
                </p>
              </div>

              {/* Bouton de sauvegarde */}
              {settingsMsg && (
                <div className={`p-3 rounded-lg border text-sm ${
                  settingsMsg.type === 'success'
                    ? 'bg-status-successBg border-status-success/30 text-status-success'
                    : 'bg-status-errorBg border-status-error/30 text-status-error'
                }`}>
                  {settingsMsg.text}
                </div>
              )}
              <button
                onClick={handleSaveSettings}
                disabled={settingsSaving}
                className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {settingsSaving ? 'Sauvegarde...' : 'Sauvegarder les paramètres'}
              </button>
            </div>
          )}

        </div>
      </main>

      {/* Modals */}
      {productModal && (
        <ProductModal
          product={productModal === 'new' ? null : productModal}
          businessId={businessId}
          onSave={(result) => {
            if (productModal === 'new') {
              setProducts(prev => [...prev, result]);
            } else {
              setProducts(prev => prev.map(p => p.id === result.id ? result : p));
            }
            loadProducts();
            loadLowStockAlerts();
          }}
          onClose={() => setProductModal(null)}
        />
      )}

      {stockModal && (
        <StockAdjustmentModal
          product={stockModal}
          onSave={handleStockAdjustment}
          onClose={() => setStockModal(null)}
        />
      )}

      {/* Modal Création Story */}
      {storyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-background-card rounded-xl shadow-lg w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-border-light flex items-center justify-between">
              <h3 className="font-bold text-text-primary">Nouvelle story</h3>
              <button onClick={() => { setStoryModal(false); setStoryFile(null); setStoryPreview(null); setStoryCaption(''); }} className="p-1 rounded-lg hover:bg-background-secondary">
                <XCircle size={18} className="text-text-secondary" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div
                className="relative aspect-[9/16] max-h-[40vh] bg-background-secondary rounded-lg overflow-hidden flex items-center justify-center cursor-pointer"
                onClick={() => storyFileRef.current?.click()}
              >
                {storyPreview ? (
                  <img src={storyPreview} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center">
                    <Camera size={32} className="mx-auto text-text-tertiary mb-2" strokeWidth={1} />
                    <p className="text-[13px] text-text-secondary">Cliquez pour ajouter une image</p>
                    <p className="text-[11.5px] text-text-tertiary mt-1">JPEG, PNG, WebP — max 5 Mo</p>
                  </div>
                )}
                <input
                  ref={storyFileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleStoryFileSelect}
                  className="hidden"
                />
              </div>
              <input
                type="text"
                placeholder="Ajouter une légende..."
                value={storyCaption}
                onChange={(e) => setStoryCaption(e.target.value.slice(0, 280))}
                className="input-field"
                maxLength={280}
              />
              {errors.stories && <p className="text-[13px] text-status-error">{errors.stories}</p>}
              <div className="flex gap-2">
                {storyPreview && (
                  <button
                    onClick={() => { setStoryFile(null); setStoryPreview(null); }}
                    className="btn-secondary flex-1"
                  >
                    Changer
                  </button>
                )}
                <button
                  onClick={handleCreateStory}
                  disabled={!storyFile || storyUploading}
                  className="btn-primary flex-1 disabled:opacity-50"
                >
                  {storyUploading ? 'Publication...' : 'Publier'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Assignation Livreur */}
      {driverModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-background-card rounded-xl shadow-lg w-full max-w-md max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b border-border-light flex items-center justify-between">
              <div>
                <h3 className="font-bold text-text-primary">Assigner un livreur</h3>
                <p className="text-[13px] text-text-secondary">Commande #{driverModal.id?.slice(-6)}</p>
              </div>
              <button onClick={() => setDriverModal(null)} className="p-1 rounded-lg hover:bg-background-secondary">
                <XCircle size={18} className="text-text-secondary" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              {loadingDrivers ? (
                <div className="text-center py-8 text-text-secondary">Chargement des livreurs...</div>
              ) : availableDrivers.length === 0 ? (
                <div className="text-center py-8 text-text-secondary">Aucun livreur disponible pour le moment</div>
              ) : (
                <div className="space-y-2">
                  {availableDrivers.map(driver => (
                    <div key={driver.id} className="flex items-center justify-between p-3 rounded-lg border border-border-light hover:bg-background-secondary transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-accent-primary/10 flex items-center justify-center">
                          <span className="text-sm font-bold text-accent-primary">{driver.fullName?.charAt(0) || '?'}</span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-text-primary">{driver.fullName || 'Livreur'}</p>
                          <p className="text-[13px] text-text-secondary">{driver.phone || ''} {driver.vehicleType ? `· ${driver.vehicleType}` : ''}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleAssignDriver(driver.id)}
                        disabled={assigningDriver === driver.id}
                        className="btn-primary px-3"
                      >
                        {assigningDriver === driver.id ? '...' : 'Assigner'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BusinessAdminDashboard;