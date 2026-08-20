/**
 * FasoFree - Regional Admin Dashboard
 * 
 * Regional operational management center with:
 * - Local merchant validation and management
 * - Dispute resolution between clients, drivers, and merchants
 * - Real-time order execution tracking
 * - Regional performance metrics
 * - Customer support oversight
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Layout, Users, LifeBuoy, Settings, LogOut, 
  TrendingUp, Activity, DollarSign, RefreshCw, 
  AlertCircle, Shield, ShoppingBag, MapPin, Clock,
  CheckCircle, XCircle, MessageSquare, Star
} from 'lucide-react';
import useAuthStore from '../store/authStore';
import { StatCard, StatusBadge, LoadingSkeleton, EmptyState } from './components/StatCard';
import { getAllUsers } from '../services/authService';
import { getFinancialDashboard } from '../services/walletService';
import { createBanRequest } from '../services/usersService';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [activeTab, setActiveTab] = useState('overview');

  // Regional data
  const [regionalStats, setRegionalStats] = useState({
    totalMerchants: 0,
    activeMerchants: 0,
    pendingValidations: 0,
    totalOrders: 0,
    completionRate: 0,
    averageDeliveryTime: 0,
    totalDisputes: 0,
    resolvedDisputes: 0,
  });

  // Disputes
  const [disputes, setDisputes] = useState([]);
  const [selectedDispute, setSelectedDispute] = useState(null);

  // Local merchants
  const [localMerchants, setLocalMerchants] = useState([]);
  const [pendingMerchants, setPendingMerchants] = useState([]);

  // Orders tracking
  const [recentOrders, setRecentOrders] = useState([]);
  const [orderMetrics, setOrderMetrics] = useState({});

  // UI states
  const [loading, setLoading] = useState({
    stats: true,
    disputes: true,
    merchants: true,
    orders: true,
  });
  const [errors, setErrors] = useState({});

  // Ban request submission
  const [showBanModal, setShowBanModal] = useState(false);
  const [banForm, setBanForm] = useState({ targetUserId: '', reason: '' });
  const [banSubmitting, setBanSubmitting] = useState(false);
  const [banMsg, setBanMsg] = useState(null);
  const [allUsers, setAllUsers] = useState([]);

  // Load regional statistics
  const loadRegionalStats = useCallback(async () => {
    setLoading(prev => ({ ...prev, stats: true }));
    try {
      // Mock data - replace with actual API call
      setTimeout(() => {
        setRegionalStats({
          totalMerchants: 45,
          activeMerchants: 38,
          pendingValidations: 7,
          totalOrders: 1234,
          completionRate: 94.5,
          averageDeliveryTime: 32,
          totalDisputes: 23,
          resolvedDisputes: 18,
        });
        setLoading(prev => ({ ...prev, stats: false }));
      }, 800);
    } catch (err) {
      setErrors(prev => ({ ...prev, stats: err.message }));
      setLoading(prev => ({ ...prev, stats: false }));
    }
  }, []);

  // Load disputes
  const loadDisputes = useCallback(async () => {
    setLoading(prev => ({ ...prev, disputes: true }));
    try {
      // Mock data - replace with actual API call
      setTimeout(() => {
        setDisputes([
          { 
            id: '1', 
            type: 'DELIVERY', 
            orderId: 'ORD-1234',
            customer: 'Jean Kabore', 
            merchant: 'Maquis Le 20',
            driver: 'Koulibaly',
            status: 'OPEN',
            description: 'Livraison en retard de 45 minutes',
            createdAt: '2026-08-12T14:30:00Z',
            priority: 'HIGH'
          },
          { 
            id: '2', 
            type: 'PRODUCT', 
            orderId: 'ORD-1235',
            customer: 'Aisha Sanou', 
            merchant: 'Faso Grillades',
            driver: null,
            status: 'OPEN',
            description: 'Produit ne correspond pas à la commande',
            createdAt: '2026-08-12T16:15:00Z',
            priority: 'MEDIUM'
          },
        ]);
        setLoading(prev => ({ ...prev, disputes: false }));
      }, 600);
    } catch (err) {
      setErrors(prev => ({ ...prev, disputes: err.message }));
      setLoading(prev => ({ ...prev, disputes: false }));
    }
  }, []);

  // Load local merchants
  const loadLocalMerchants = useCallback(async () => {
    setLoading(prev => ({ ...prev, merchants: true }));
    try {
      // Mock data - replace with actual API call
      setTimeout(() => {
        setLocalMerchants([
          { id: '1', name: 'Maquis Le 20', category: 'Restauration', status: 'ACTIVE', rating: 4.5, orders: 234 },
          { id: '2', name: 'Pharmacie Centrale', category: 'Pharmacie', status: 'ACTIVE', rating: 4.8, orders: 567 },
          { id: '3', name: 'Supermarché ABC', category: 'Retail', status: 'ACTIVE', rating: 4.2, orders: 891 },
        ]);
        setPendingMerchants([
          { id: '4', name: 'Burger King Ouaga', category: 'Fast-Food', owner: 'M. Compaoré', phone: '+226 70 00 00 00', location: 'Patte d\'Oie' },
        ]);
        setLoading(prev => ({ ...prev, merchants: false }));
      }, 700);
    } catch (err) {
      setErrors(prev => ({ ...prev, merchants: err.message }));
      setLoading(prev => ({ ...prev, merchants: false }));
    }
  }, []);

  // Load recent orders
  const loadRecentOrders = useCallback(async () => {
    setLoading(prev => ({ ...prev, orders: true }));
    try {
      // Mock data - replace with actual API call
      setTimeout(() => {
        setRecentOrders([
          { id: 'ORD-1234', customer: 'Jean Kabore', merchant: 'Maquis Le 20', status: 'DELIVERED', total: 8500, createdAt: '2026-08-13T10:30:00Z' },
          { id: 'ORD-1235', customer: 'Aisha Sanou', merchant: 'Faso Grillades', status: 'IN_TRANSIT', total: 12000, createdAt: '2026-08-13T11:15:00Z' },
          { id: 'ORD-1236', customer: 'Paul Zongo', merchant: 'Pharmacie Centrale', status: 'PREPARING', total: 5500, createdAt: '2026-08-13T11:45:00Z' },
        ]);
        setOrderMetrics({
          today: 45,
          week: 312,
          month: 1234,
          successRate: 94.5,
        });
        setLoading(prev => ({ ...prev, orders: false }));
      }, 500);
    } catch (err) {
      setErrors(prev => ({ ...prev, orders: err.message }));
      setLoading(prev => ({ ...prev, orders: false }));
    }
  }, []);

  useEffect(() => {
    loadRegionalStats();
    loadDisputes();
    loadLocalMerchants();
    loadRecentOrders();
  }, [loadRegionalStats, loadDisputes, loadLocalMerchants, loadRecentOrders]);

  // Load users for ban request target selection
  useEffect(() => {
    getAllUsers().then(data => setAllUsers(Array.isArray(data) ? data : [])).catch(() => {});
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // ─── Ban Request ──────────────────────────────────────────────
  const handleBanSubmit = async () => {
    if (!banForm.targetUserId || banForm.reason.trim().length < 10) return;
    setBanSubmitting(true);
    setBanMsg(null);
    try {
      await createBanRequest({
        targetUserId: banForm.targetUserId,
        reason: banForm.reason.trim(),
      });
      setBanMsg({ type: 'success', text: 'Demande de bannissement soumise. En attente de validation par le Super Admin.' });
      setShowBanModal(false);
      setBanForm({ targetUserId: '', reason: '' });
    } catch (err) {
      setBanMsg({ type: 'error', text: err.message || 'Erreur lors de la soumission' });
    } finally {
      setBanSubmitting(false);
    }
  };

  const handleResolveDispute = (disputeId, resolution) => {
    setDisputes(prev => prev.map(d => 
      d.id === disputeId ? { ...d, status: 'RESOLVED', resolution } : d
    ));
    setSelectedDispute(null);
  };

  const handleValidateMerchant = (merchantId, approved) => {
    setPendingMerchants(prev => prev.filter(m => m.id !== merchantId));
    if (approved) {
      setLocalMerchants(prev => [...prev, { 
        ...pendingMerchants.find(m => m.id === merchantId), 
        status: 'ACTIVE',
        rating: 0,
        orders: 0
      }]);
    }
  };

  const tabs = [
    { id: 'overview', label: 'Vue Régionale', icon: Layout, show: true },
    { id: 'merchants', label: 'Commerçants Locaux', icon: Users, show: true },
    { id: 'disputes', label: 'Litiges & Support', icon: LifeBuoy, show: true, badge: disputes.filter(d => d.status === 'OPEN').length },
    { id: 'ban-request', label: 'Signaler un utilisateur', icon: AlertCircle, show: true },
    { id: 'orders', label: 'Suivi Commandes', icon: ShoppingBag, show: true },
    { id: 'settings', label: 'Paramètres Région', icon: Settings, show: true },
  ].filter(t => t.show);

  return (
    <div className="min-h-screen bg-background-primary flex">
      {/* ─── SIDEBAR ADMIN ─────────────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-60 bg-background-card border-r border-border-light fixed h-full z-20">
        <div className="p-5 border-b border-border-light">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-accent-primary text-white shadow-glow-sm">
              <Shield size={16} />
            </div>
            <div>
              <p className="text-text-primary font-bold text-sm leading-tight">FasoFree</p>
              <p className="text-accent-primary text-[10px] font-bold uppercase tracking-wider">Administration Régionale</p>
            </div>
          </div>
        </div>

        <div className="p-4 border-b border-border-light">
          <div className="flex items-center gap-3">
            <div className="avatar w-9 h-9 text-sm">
              {(user?.fullName || 'A').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-text-primary text-xs font-bold truncate">{user?.fullName || 'Administrateur'}</p>
              <p className="text-text-tertiary text-[10px] uppercase font-semibold">{user?.role}</p>
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
                  <span className="w-5 h-5 bg-status-error text-white text-xs rounded-full flex items-center justify-center font-bold">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border-light">
          <button onClick={handleLogout} className="nav-item w-full text-status-error hover:bg-status-errorBg">
            <LogOut size={16} strokeWidth={1.5} /> Déconnexion
          </button>
        </div>
      </aside>

      {/* ─── MAIN CONTENT ────────────────────────────────────────── */}
      <main className="flex-1 lg:ml-60 min-h-screen">
        {/* Header mobile */}
        <header className="lg:hidden flex items-center justify-between px-4 py-4 border-b border-border-light bg-background-card sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-accent-primary" />
            <p className="text-text-primary font-bold">Admin FasoFree</p>
          </div>
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
                <Icon size={14} strokeWidth={1.5} /> {tab.label}
                {tab.badge > 0 && <span className="w-4 h-4 bg-accent-primary text-white text-xs rounded-full flex items-center justify-center">{tab.badge}</span>}
              </button>
            );
          })}
        </div>

        <div className="p-4 sm:p-6 lg:p-8">
          
          {/* ──────────────────────────────────────────────────────── */}
          {/* ONGLET VUE RÉGIONALE */}
          {/* ──────────────────────────────────────────────────────── */}
          {activeTab === 'overview' && (
            <div className="animate-slide-up">
              <div className="flex items-center justify-between mb-6">
                <h1 className="text-xl font-bold text-text-primary">Vue Régionale</h1>
                <button onClick={loadRegionalStats} className="btn-secondary gap-2 text-xs">
                  <RefreshCw size={12} className={loading.stats ? 'animate-spin' : ''} /> Actualiser
                </button>
              </div>

              {errors.stats && (
                <div className="mb-6 p-3 bg-status-errorBg border border-status-error/30 rounded-md text-status-error text-sm flex items-center gap-2">
                  <AlertCircle size={14} /> {errors.stats}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <StatCard
                  label="Commerçants Actifs"
                  value={regionalStats.activeMerchants}
                  icon={Users}
                  color="#3B82F6"
                  loading={loading.stats}
                />
                <StatCard
                  label="Commandes du Jour"
                  value={orderMetrics.today || regionalStats.totalOrders}
                  icon={ShoppingBag}
                  color="#22C55E"
                  loading={loading.orders}
                />
                <StatCard
                  label="Taux de Réussite"
                  value={`${regionalStats.completionRate}%`}
                  icon={TrendingUp}
                  color="#C1652E"
                  loading={loading.stats}
                />
                <StatCard
                  label="Litiges en Cours"
                  value={disputes.filter(d => d.status === 'OPEN').length}
                  icon={AlertCircle}
                  color="#EF4444"
                  loading={loading.disputes}
                />
              </div>

              {/* Recent Activity */}
              <div className="card p-6 mb-6">
                <h2 className="text-sm font-bold text-text-primary mb-4 flex items-center gap-2">
                  <Activity size={16} className="text-accent-primary" /> Activité Récente
                </h2>
                <div className="space-y-3">
                  {recentOrders.slice(0, 3).map(order => (
                    <div key={order.id} className="flex items-center justify-between p-3 bg-background-secondary rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-accent-primary/10 flex items-center justify-center">
                          <ShoppingBag size={14} className="text-accent-primary" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-text-primary">{order.customer}</p>
                          <p className="text-[10px] text-text-secondary">{order.merchant}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <StatusBadge status={order.status} statusConfig={{
                          DELIVERED: { label: 'Livrée', color: 'success', dot: '#22C55E' },
                          IN_TRANSIT: { label: 'En livraison', color: 'info', dot: '#3B82F6' },
                          PREPARING: { label: 'En préparation', color: 'processing', dot: '#FF6600' },
                        }} />
                        <p className="text-[10px] text-text-tertiary mt-1">{order.total.toLocaleString()} FCFA</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Performance Metrics */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="card p-5">
                  <h3 className="font-bold text-text-primary mb-2 flex items-center gap-2">
                    <Clock size={16} className="text-accent-primary" />
                    Temps de Livraison Moyen
                  </h3>
                  <p className="text-2xl font-bold text-text-primary">{regionalStats.averageDeliveryTime} min</p>
                  <p className="text-xs text-text-secondary mt-1">Objectif: 30 min</p>
                </div>
                <div className="card p-5">
                  <h3 className="font-bold text-text-primary mb-2 flex items-center gap-2">
                    <Star size={16} className="text-accent-primary" />
                    Taux de Résolution Litiges
                  </h3>
                  <p className="text-2xl font-bold text-text-primary">
                    {regionalStats.totalDisputes > 0 
                      ? Math.round((regionalStats.resolvedDisputes / regionalStats.totalDisputes) * 100) 
                      : 0}%
                  </p>
                  <p className="text-xs text-text-secondary mt-1">{regionalStats.resolvedDisputes}/{regionalStats.totalDisputes} résolus</p>
                </div>
              </div>
            </div>
          )}

          {/* ──────────────────────────────────────────────────────── */}
          {/* ONGLET COMMERÇANTS LOCAUX */}
          {/* ──────────────────────────────────────────────────────── */}
          {activeTab === 'merchants' && (
            <div className="animate-slide-up">
              <div className="flex items-center justify-between mb-6">
                <h1 className="text-xl font-bold text-text-primary">Commerçants Locaux</h1>
                <button onClick={loadLocalMerchants} className="btn-secondary gap-2 text-xs">
                  <RefreshCw size={12} className={loading.merchants ? 'animate-spin' : ''} />
                </button>
              </div>

              {/* Pending Validations */}
              {pendingMerchants.length > 0 && (
                <div className="mb-6">
                  <h2 className="text-sm font-bold text-text-primary mb-3">Validations en Attente</h2>
                  <div className="space-y-3">
                    {pendingMerchants.map(merchant => (
                      <div key={merchant.id} className="card p-4 flex items-center justify-between">
                        <div>
                          <h3 className="font-bold text-text-primary text-sm">{merchant.name}</h3>
                          <p className="text-xs text-text-secondary">
                            {merchant.owner} | {merchant.phone}
                          </p>
                          <span className="text-[10px] text-text-tertiary">{merchant.location}</span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleValidateMerchant(merchant.id, true)}
                            className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1 bg-status-success hover:bg-status-success/80"
                          >
                            <CheckCircle size={12} /> Valider
                          </button>
                          <button
                            onClick={() => handleValidateMerchant(merchant.id, false)}
                            className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1 text-status-error border-status-error/30"
                          >
                            <XCircle size={12} /> Rejeter
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Active Merchants */}
              <div className="card overflow-hidden">
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Commerçant</th>
                        <th>Catégorie</th>
                        <th>Note</th>
                        <th>Commandes</th>
                        <th>Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading.merchants ? (
                        [1,2,3].map(i => (
                          <tr key={i}>
                            <td colSpan="5"><LoadingSkeleton height="h-8" /></td>
                          </tr>
                        ))
                      ) : localMerchants.map(merchant => (
                        <tr key={merchant.id}>
                          <td>
                            <p className="font-bold text-text-primary text-sm">{merchant.name}</p>
                          </td>
                          <td>
                            <span className="text-xs text-text-secondary">{merchant.category}</span>
                          </td>
                          <td>
                            <div className="flex items-center gap-1">
                              <Star size={12} className="text-yellow-500 fill-yellow-500" />
                              <span className="text-xs font-semibold text-text-primary">{merchant.rating}</span>
                            </div>
                          </td>
                          <td>
                            <span className="text-xs text-text-secondary">{merchant.orders}</span>
                          </td>
                          <td>
                            <StatusBadge status={merchant.status} statusConfig={{
                              ACTIVE: { label: 'Actif', color: 'success', dot: '#22C55E' },
                              SUSPENDED: { label: 'Suspendu', color: 'error', dot: '#EF4444' },
                            }} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ──────────────────────────────────────────────────────── */}
          {/* ONGLET LITIGES & SUPPORT */}
          {/* ──────────────────────────────────────────────────────── */}
          {activeTab === 'disputes' && (
            <div className="animate-slide-up">
              <div className="flex items-center justify-between mb-6">
                <h1 className="text-xl font-bold text-text-primary">Litiges & Support</h1>
                <button onClick={loadDisputes} className="btn-secondary gap-2 text-xs">
                  <RefreshCw size={12} className={loading.disputes ? 'animate-spin' : ''} />
                </button>
              </div>

              {selectedDispute ? (
                <div className="card p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-bold text-text-primary">Détail du Litige #{selectedDispute.id}</h2>
                    <button onClick={() => setSelectedDispute(null)} className="btn-icon">
                      <XCircle size={16} />
                    </button>
                  </div>
                  
                  <div className="space-y-4 mb-6">
                    <div className="p-4 bg-background-secondary rounded-lg">
                      <p className="text-xs text-text-secondary mb-1">Type</p>
                      <p className="text-sm font-semibold text-text-primary">{selectedDispute.type}</p>
                    </div>
                    <div className="p-4 bg-background-secondary rounded-lg">
                      <p className="text-xs text-text-secondary mb-1">Description</p>
                      <p className="text-sm text-text-primary">{selectedDispute.description}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-background-secondary rounded-lg">
                        <p className="text-xs text-text-secondary mb-1">Client</p>
                        <p className="text-sm font-semibold text-text-primary">{selectedDispute.customer}</p>
                      </div>
                      <div className="p-4 bg-background-secondary rounded-lg">
                        <p className="text-xs text-text-secondary mb-1">Commerçant</p>
                        <p className="text-sm font-semibold text-text-primary">{selectedDispute.merchant}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button 
                      onClick={() => handleResolveDispute(selectedDispute.id, 'FAVOR_CUSTOMER')}
                      className="btn-primary flex-1 bg-status-success hover:bg-status-success/80"
                    >
                      Favoriser Client
                    </button>
                    <button 
                      onClick={() => handleResolveDispute(selectedDispute.id, 'FAVOR_MERCHANT')}
                      className="btn-secondary flex-1 text-status-error border-status-error/30"
                    >
                      Favoriser Commerçant
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {loading.disputes ? (
                    [1,2].map(i => (
                      <div key={i} className="card p-5">
                        <LoadingSkeleton height="h-4" className="mb-2" />
                        <LoadingSkeleton height="h-3" width="w-2/3" />
                      </div>
                    ))
                  ) : disputes.length === 0 ? (
                    <EmptyState
                      icon={LifeBuoy}
                      title="Aucun litige en cours"
                      description="Tous les litiges ont été résolus."
                    />
                  ) : (
                    disputes.map(dispute => (
                      <div key={dispute.id} className="card p-5 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedDispute(dispute)}>
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-status-warningBg flex items-center justify-center">
                              <MessageSquare size={18} className="text-status-warning" />
                            </div>
                            <div>
                              <h3 className="font-bold text-text-primary text-sm">Litige #{dispute.id}</h3>
                              <p className="text-xs text-text-secondary">Commande: {dispute.orderId}</p>
                            </div>
                          </div>
                          <StatusBadge status={dispute.status} statusConfig={{
                            OPEN: { label: 'Ouvert', color: 'warning', dot: '#F59E0B' },
                            RESOLVED: { label: 'Résolu', color: 'success', dot: '#22C55E' },
                          }} />
                        </div>
                        <p className="text-sm text-text-secondary mb-3">{dispute.description}</p>
                        <div className="flex items-center gap-4 text-xs text-text-tertiary">
                          <span>Client: {dispute.customer}</span>
                          <span>Commerçant: {dispute.merchant}</span>
                          {dispute.driver && <span>Livreur: {dispute.driver}</span>}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* ──────────────────────────────────────────────────────── */}
          {/* ONGLET SUIVI COMMANDES */}
          {/* ──────────────────────────────────────────────────────── */}
          {activeTab === 'orders' && (
            <div className="animate-slide-up">
              <div className="flex items-center justify-between mb-6">
                <h1 className="text-xl font-bold text-text-primary">Suivi des Commandes</h1>
                <button onClick={loadRecentOrders} className="btn-secondary gap-2 text-xs">
                  <RefreshCw size={12} className={loading.orders ? 'animate-spin' : ''} />
                </button>
              </div>

              <div className="card overflow-hidden">
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Commande</th>
                        <th>Client</th>
                        <th>Commerçant</th>
                        <th>Montant</th>
                        <th>Statut</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading.orders ? (
                        [1,2,3].map(i => (
                          <tr key={i}>
                            <td colSpan="6"><LoadingSkeleton height="h-8" /></td>
                          </tr>
                        ))
                      ) : recentOrders.map(order => (
                        <tr key={order.id}>
                          <td>
                            <p className="font-bold text-text-primary text-sm">{order.id}</p>
                          </td>
                          <td>
                            <p className="text-text-secondary text-xs">{order.customer}</p>
                          </td>
                          <td>
                            <p className="text-text-secondary text-xs">{order.merchant}</p>
                          </td>
                          <td>
                            <p className="text-text-primary text-xs font-semibold">{order.total.toLocaleString()} FCFA</p>
                          </td>
                          <td>
                            <StatusBadge status={order.status} statusConfig={{
                              DELIVERED: { label: 'Livrée', color: 'success', dot: '#22C55E' },
                              IN_TRANSIT: { label: 'En livraison', color: 'info', dot: '#3B82F6' },
                              PREPARING: { label: 'En préparation', color: 'processing', dot: '#FF6600' },
                            }} />
                          </td>
                          <td>
                            <span className="text-text-tertiary text-xs">
                              {new Date(order.createdAt).toLocaleDateString('fr-FR')}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ──────────────────────────────────────────────────────── */}
          {/* ONGLET SIGNALER UN UTILISATEUR */}
          {/* ──────────────────────────────────────────────────────── */}
          {activeTab === 'ban-request' && (
            <div className="space-y-6 animate-slide-up">
              <div>
                <h1 className="text-xl font-bold text-text-primary">Signaler un Utilisateur</h1>
                <p className="text-text-secondary text-sm">
                  Soumettez une demande de bannissement au Super Admin. La décision finale lui appartient.
                </p>
              </div>

              {banMsg && (
                <div className={`p-3 rounded-lg border text-sm ${banMsg.type === 'success' ? 'bg-status-successBg border-status-success/30 text-status-success' : 'bg-status-errorBg border-status-error/30 text-status-error'}`}>
                  {banMsg.text}
                </div>
              )}

              <div className="card p-6 max-w-xl">
                <div className="mb-4">
                  <label className="block text-xs text-text-secondary mb-2">Utilisateur cible</label>
                  <select
                    value={banForm.targetUserId}
                    onChange={(e) => setBanForm(prev => ({ ...prev, targetUserId: e.target.value }))}
                    className="input-field w-full"
                  >
                    <option value="">— Sélectionner un utilisateur —</option>
                    {allUsers.filter(u => u.role !== 'super_admin').map(u => (
                      <option key={u.id} value={u.id}>
                        {u.fullName || u.email} ({u.role}) — {u.isActive ? 'Actif' : 'Banni'}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mb-4">
                  <label className="block text-xs text-text-secondary mb-2">Raison du signalement (min. 10 caractères)</label>
                  <textarea
                    value={banForm.reason}
                    onChange={(e) => setBanForm(prev => ({ ...prev, reason: e.target.value }))}
                    placeholder="Décrivez le comportement problématique..."
                    rows={4}
                    className="input-field w-full resize-none"
                  />
                </div>
                <button
                  onClick={handleBanSubmit}
                  disabled={banSubmitting || !banForm.targetUserId || banForm.reason.trim().length < 10}
                  className="btn-primary flex items-center gap-2 disabled:opacity-50"
                >
                  {banSubmitting ? <RefreshCw size={14} className="animate-spin" /> : <AlertCircle size={14} />}
                  Soumettre la demande
                </button>
              </div>
            </div>
          )}

          {/* ──────────────────────────────────────────────────────── */}
          {/* ONGLET PARAMÈTRES RÉGION */}
          {/* ──────────────────────────────────────────────────────── */}
          {activeTab === 'settings' && (
            <div className="animate-slide-up">
              <h1 className="text-xl font-bold text-text-primary mb-6">Paramètres Régionaux</h1>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="card p-5">
                  <h3 className="font-bold text-text-primary mb-2 flex items-center gap-2">
                    <MapPin size={16} className="text-accent-primary" />
                    Zone Géographique
                  </h3>
                  <p className="text-text-secondary text-xs mb-4">Définir la zone de couverture pour cette région.</p>
                  <button disabled className="btn-secondary w-full opacity-50">Configurer la zone</button>
                </div>
                <div className="card p-5">
                  <h3 className="font-bold text-text-primary mb-2 flex items-center gap-2">
                    <Clock size={16} className="text-accent-primary" />
                    Horaires de Livraison
                  </h3>
                  <p className="text-text-secondary text-xs mb-4">Définir les horaires de livraison pour cette région.</p>
                  <button disabled className="btn-secondary w-full opacity-50">Configurer les horaires</button>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;