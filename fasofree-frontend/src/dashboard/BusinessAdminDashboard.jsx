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
  ArrowUpRight, Clock, Star, Scan, AlertTriangle, Search, MessageSquare
} from 'lucide-react';
import useAuthStore from '../store/authStore';
import { StatCard, StatusBadge, LoadingSkeleton, EmptyState, OrderStatusStepper } from './components/StatCard';
import { getBusinessAnalytics } from '../services/analyticsService';
import { getMyOrders, updateOrderStatus, getStatusInfo, getOrderSteps, getNextPossibleStatuses } from '../services/orderService';
import {
  getProductsByBusiness, createProduct, updateProduct,
  deleteProduct, toggleProductAvailability,
} from '../services/productService';
import { getWallet } from '../services/walletService';
import { getBusinessProducts, getLowStockAlerts, updateStock, generateSKU } from '../services/inventoryService';
import api from '../services/api';
import { getActiveConversations, getChatHistory } from '../services/usersService';
import { getChatSocket } from '../services/realtime';
import { ProductType, InventoryStatus } from '../types';

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
    if (form.trackInventory && (!form.sku || form.stockQuantity < 0)) {
      setError('SKU requis et stock doit être positif pour le suivi d\'inventaire');
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
              <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Nom *</label>
              <input className="input-field" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Poulet bicyclette" />
            </div>
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
            <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Description</label>
            <textarea className="input-field resize-none" rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Description du produit..." />
          </div>

          {/* Product Type */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Type de produit</label>
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
                  <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">SKU / Code-barres</label>
                  <div className="flex gap-2">
                    <input className="input-field flex-1" value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} placeholder="AUTO-GEN-001" />
                    <button type="button" onClick={handleGenerateSKU} disabled={generatingSKU} className="btn-secondary">
                      <Scan size={14} className={generatingSKU ? 'animate-spin' : ''} />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Stock actuel</label>
                  <input className="input-field" type="number" min="0" value={form.stockQuantity} onChange={e => setForm({ ...form, stockQuantity: Number(e.target.value) })} placeholder="0" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Alerte stock bas</label>
                  <input className="input-field" type="number" min="0" value={form.minStockAlert} onChange={e => setForm({ ...form, minStockAlert: Number(e.target.value) })} placeholder="5" />
                </div>
              </div>
            )}
          </div>

          {/* Image */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">URL Image</label>
            <input className="input-field" value={form.imageUrl} onChange={e => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://..." />
          </div>

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
          <p className="text-xs text-text-secondary">Stock actuel: {product.stockQuantity}</p>
          <p className="text-xs text-text-secondary">SKU: {product.sku}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Ajustement (+/-)</label>
            <input 
              className="input-field" 
              type="number" 
              value={quantity} 
              onChange={e => setQuantity(Number(e.target.value))} 
              placeholder="Entrez un nombre positif ou négatif"
            />
            <p className="text-xs text-text-tertiary mt-1">Positif = ajout, Négatif = retrait</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Raison</label>
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
const BusinessAdminDashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [activeTab, setActiveTab] = useState('overview');

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
  });

  // États UI
  const [loading, setLoading] = useState({ analytics: true, orders: true, products: true, wallet: true, alerts: true });
  const [errors, setErrors] = useState({});
  const [productModal, setProductModal] = useState(null);
  const [stockModal, setStockModal] = useState(null);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [productTypeFilter, setProductTypeFilter] = useState('ALL');
  const [updating, setUpdating] = useState({});

  // Chat inbox
  const [conversations, setConversations] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [selectedChatOrder, setSelectedChatOrder] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [chatHistoryLoading, setChatHistoryLoading] = useState(false);
  const [chatChannel, setChatChannel] = useState('merchant');
  const [chatInput, setChatInput] = useState('');
  const chatSocketRef = useRef(null);

  // ID du commerce depuis le profil utilisateur
  const businessId = user?.businessId || user?.business?.id;

  const setError = (key, msg) => setErrors(prev => ({ ...prev, [key]: msg }));
  const setLoad = (key, val) => setLoading(prev => ({ ...prev, [key]: val }));

  // Toggle business settings
  const toggleSetting = (key) => {
    setBusinessSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Save business settings
  const handleSaveSettings = async () => {
    setLoading(prev => ({ ...prev, settings: true }));
    try {
      await api.patch(`/businesses/${businessId}`, businessSettings);
      // Reload business data to confirm
      const updatedBusiness = (await api.get(`/businesses/${businessId}`)).data;
      setBusinessSettings({
        enableDelivery: updatedBusiness.enableDelivery ?? true,
        enablePickup: updatedBusiness.enablePickup ?? true,
        enableDineIn: updatedBusiness.enableDineIn ?? false,
        hasOwnDrivers: updatedBusiness.hasOwnDrivers ?? false,
        category: updatedBusiness.category ?? 'RESTAURANT',
      });
    } catch (err) {
      setError('settings', err.message);
    } finally {
      setLoading(prev => ({ ...prev, settings: false }));
    }
  };

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
      const data = await getBusinessProducts(businessId);
      setProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      setError('products', err.message);
    } finally {
      setLoad('products', false);
    }
  }, [businessId]);

  const loadLowStockAlerts = useCallback(async () => {
    if (!businessId) return;
    setLoad('alerts', true);
    try {
      const data = await getLowStockAlerts(businessId);
      setLowStockAlerts(Array.isArray(data) ? data : []);
    } catch (err) {
      setError('alerts', err.message);
    } finally {
      setLoad('alerts', false);
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
    loadLowStockAlerts();
    loadWallet();
  }, [loadAnalytics, loadOrders, loadProducts, loadLowStockAlerts, loadWallet]);

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

  const handleViewChatHistory = async (orderId) => {
    setSelectedChatOrder(orderId);
    setChatHistoryLoading(true);
    try {
      const data = await getChatHistory(orderId, chatChannel);
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

    socket.emit('joinOrderChat', { orderId, channel: chatChannel }, (res) => {
      if (res?.status === 'ok') {
        setChatHistory(res.history || []);
      }
    });

    socket.on('newOrderMessage', (msg) => {
      if (msg.orderId === orderId && msg.channel === chatChannel) {
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

  const tabs = [
    { id: 'overview', label: 'Vue d\'ensemble', icon: Layout },
    { id: 'orders', label: 'Commandes', icon: ShoppingBag, badge: orders.filter(o => o.status === 'PENDING' || o.status === 'CONFIRMED').length },
    { id: 'products', label: 'Stock & Catalogue', icon: Package, badge: lowStockAlerts.length },
    { id: 'chat-inbox', label: 'Messagerie', icon: MessageSquare },
    { id: 'settings', label: 'Paramètres', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-background-primary flex">
      {/* ─── SIDEBAR ─────────────────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-60 bg-background-card border-r border-border-light fixed h-full z-20">
        <div className="p-5 border-b border-border-light">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(193,101,46,0.15)' }}>
              <span className="text-accent-primary text-sm font-bold">FF</span>
            </div>
            <div>
              <p className="text-text-primary font-bold text-sm">FasoFree</p>
              <p className="text-text-tertiary text-xs">Dashboard Commerçant</p>
            </div>
          </div>
        </div>

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
          {/* ONGLET VUE D'ENSEMBLE */}
          {/* ──────────────────────────────────────────────────────── */}
          {activeTab === 'overview' && (
            <div className="animate-slide-up">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-xl font-bold text-text-primary">Vue d'ensemble</h1>
                  <p className="text-text-secondary text-sm mt-0.5">
                    {new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                </div>
                <button onClick={() => { loadAnalytics(); loadOrders(); loadProducts(); }} className="btn-secondary gap-2">
                  <RefreshCw size={14} /> Actualiser
                </button>
              </div>

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
                      <button onClick={() => setActiveTab('products')} className="text-accent-primary text-xs font-semibold">
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

              {errors.analytics && (
                <div className="mb-6 p-3 bg-status-warningBg border border-status-warning/30 rounded-md text-status-warning text-sm flex items-center gap-2">
                  <AlertCircle size={14} /> Analytics indisponibles (backend requis). Données partielles affichées.
                </div>
              )}

              {/* Commandes récentes */}
              <div className="card p-5 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-bold text-text-primary">Commandes récentes</h2>
                  <button onClick={() => setActiveTab('orders')} className="text-accent-primary text-xs font-semibold">
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
                          <p className="text-xs font-semibold text-text-primary">#{order.id?.slice(-6)}</p>
                          <p className="text-[10px] text-text-secondary">{new Date(order.createdAt).toLocaleDateString('fr-FR')}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <StatusBadge status={order.status} />
                        <p className="text-[10px] text-text-tertiary mt-1">{order.totalAmount?.toLocaleString()} FCFA</p>
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
                    className="input-field py-1.5 text-xs"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="ALL">Tous les statuts</option>
                    <option value="PENDING">En attente</option>
                    <option value="CONFIRMED">Confirmées</option>
                    <option value="PREPARING">En préparation</option>
                    <option value="IN_TRANSIT">En livraison</option>
                    <option value="DELIVERED">Livrées</option>
                  </select>
                  <button onClick={loadOrders} className="btn-secondary gap-2 text-xs">
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
                    const nextStatuses = getNextPossibleStatuses(order.status);
                    return (
                      <div key={order.id} className="card p-5">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h3 className="font-bold text-text-primary">Commande #{order.id?.slice(-6)}</h3>
                            <p className="text-xs text-text-secondary">
                              {new Date(order.createdAt).toLocaleDateString('fr-FR')} à {new Date(order.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          <StatusBadge status={order.status} />
                        </div>

                        {/* Order Stepper */}
                        <OrderStatusStepper currentStatus={order.status} steps={getOrderSteps(order.status)} />

                        <div className="grid grid-cols-2 gap-4 mt-4 mb-4">
                          <div className="p-3 bg-background-secondary rounded-lg">
                            <p className="text-xs text-text-secondary">Client</p>
                            <p className="text-sm font-semibold text-text-primary">{order.customerName || 'N/A'}</p>
                          </div>
                          <div className="p-3 bg-background-secondary rounded-lg">
                            <p className="text-xs text-text-secondary">Total</p>
                            <p className="text-sm font-semibold text-text-primary">{order.totalAmount?.toLocaleString()} FCFA</p>
                          </div>
                        </div>

                        {/* Status Actions */}
                        {nextStatuses.length > 0 && (
                          <div className="flex gap-2">
                            {nextStatuses.map(status => (
                              <button
                                key={status}
                                onClick={() => handleUpdateStatus(order.id, status)}
                                disabled={updating[order.id]}
                                className="btn-primary text-xs py-2 px-3"
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
                <div className="flex gap-2">
                  <select 
                    className="input-field py-1.5 text-xs"
                    value={productTypeFilter}
                    onChange={(e) => setProductTypeFilter(e.target.value)}
                  >
                    <option value="ALL">Tous les types</option>
                    <option value={ProductType.RETAIL}>Retail</option>
                    <option value={ProductType.FOOD}>Restauration</option>
                    <option value={ProductType.PHARMACY}>Pharmacie</option>
                    <option value={ProductType.SERVICE}>Services</option>
                  </select>
                  <button onClick={() => setProductModal('new')} className="btn-primary gap-2 text-xs">
                    <Plus size={12} /> Nouveau produit
                  </button>
                  <button onClick={loadProducts} className="btn-secondary gap-2 text-xs">
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
                            className="btn-icon text-xs"
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
                <div className="table-container">
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
                                  <img src={product.imageUrl} alt={product.name} className="w-10 h-10 rounded object-cover" />
                                )}
                                <div>
                                  <p className="font-bold text-text-primary text-sm">{product.name}</p>
                                  <p className="text-text-tertiary text-xs">{product.category}</p>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className="text-xs font-mono text-text-secondary">{product.sku || '—'}</span>
                            </td>
                            <td>
                              <span className="text-xs text-text-secondary">{product.type}</span>
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
                                    className="btn-icon text-xs"
                                  >
                                    <Plus size={10} />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-xs text-text-tertiary">N/A</span>
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
              </div>
            </div>
          )}

          {/* ──────────────────────────────────────────────────────── */}
          {/* ONGLET MESSAGERIE (CHAT INBOX) */}
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
                          <p className="text-xs text-text-tertiary">{conv.messageCount || 0} messages</p>
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
                          onClick={() => { setChatChannel(ch); handleViewChatHistory(selectedChatOrder); }}
                          className={`text-[10px] px-2 py-1 rounded-full font-semibold transition ${chatChannel === ch ? 'bg-accent-primary text-white' : 'bg-background-secondary text-text-secondary hover:bg-background-tertiary'}`}
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
                      {chatHistory.length === 0 && <p className="text-xs text-text-tertiary">Aucun message</p>}
                      {chatHistory.map((msg, i) => (
                        <div key={msg.id || i} className="flex gap-2">
                          <div className="w-6 h-6 rounded-full bg-accent-primary text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                            {(msg.senderRole || '?').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-text-primary uppercase">{msg.senderRole || 'system'}</span>
                            <span className="text-[10px] text-text-tertiary ml-2">{msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString('fr-FR') : msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString('fr-FR') : ''}</span>
                            <p className="text-xs text-text-secondary">{msg.message}</p>
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
                      className="flex-1 bg-background-secondary border border-border-light rounded-lg px-3 py-2 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-accent-primary"
                    />
                    <button
                      onClick={handleSendChatMessage}
                      disabled={!chatInput.trim()}
                      className="px-3 py-2 bg-accent-primary text-white text-xs font-semibold rounded-lg disabled:opacity-40 hover:bg-accent-primary/90 transition"
                    >
                      Envoyer
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

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
                      <p className="text-text-tertiary text-xs">FasoFree dispatche des livreurs</p>
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
                      <p className="text-text-tertiary text-xs">Clients viennent récupérer</p>
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
                      <p className="text-text-tertiary text-xs">Réservations de tables</p>
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
                      <p className="text-text-tertiary text-xs">Pas de dispatch FasoFree</p>
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

              {/* Catégorie du commerce */}
              <div className="card p-6">
                <h3 className="font-bold text-text-primary mb-4">Catégorie du commerce</h3>
                <select
                  value={businessSettings.category}
                  onChange={(e) => setBusinessSettings(prev => ({ ...prev, category: e.target.value }))}
                  className="input-field"
                >
                  <option value="RESTAURANT">Restaurant</option>
                  <option value="SUPERMARKET">Supermarché</option>
                  <option value="PHARMACY">Pharmacie</option>
                  <option value="RETAIL">Commerce de détail</option>
                  <option value="BAKERY">Boulangerie</option>
                  <option value="SERVICES">Services</option>
                </select>
              </div>

              {/* Bouton de sauvegarde */}
              <button
                onClick={handleSaveSettings}
                className="btn-primary w-full py-3"
              >
                Sauvegarder les paramètres
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
    </div>
  );
};

export default BusinessAdminDashboard;