/**
 * FasoFree - Super Admin Dashboard
 * 
 * Platform-level control center with:
 * - Global financial overview (revenue, commissions, transactions)
 * - System administrator management
 * - Platform settings (commission rates, delivery fees, zones)
 * - Merchant/driver validation and blocking
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Layout, Shield, Users, Store, Settings, LogOut,
  TrendingUp, Wallet, CheckCircle, XCircle, RefreshCw, AlertCircle,
  Plus, Trash2, CreditCard, MapPin, Activity, DollarSign
} from 'lucide-react';
import useAuthStore from '../store/authStore';
import { StatCard, StatusBadge, LoadingSkeleton, EmptyState } from './components/StatCard';
import { getFinancialDashboard, getPendingDisputes } from '../services/financialService';
import { approveRefund, rejectDispute } from '../services/disputeService';

const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [activeTab, setActiveTab] = useState('overview');

  // Financial data
  const [financialStats, setFinancialStats] = useState({
    totalRevenue: 0,
    totalTransactions: 0,
    totalCommission: 0,
    pendingPayouts: 0,
    averageOrderValue: 0,
    revenueGrowth: 0,
    pendingDisputes: 0,
    floatHealth: 'unknown',
  });

  // Platform stats
  const [platformStats, setPlatformStats] = useState({
    totalMerchants: 0,
    totalClients: 0,
    totalDrivers: 0,
    activeMerchants: 0,
    pendingMerchants: 0,
    suspendedAccounts: 0,
  });

  // Pending validations
  const [pendingMerchants, setPendingMerchants] = useState([]);
  const [pendingDrivers, setPendingDrivers] = useState([]);
  const [pendingDisputes, setPendingDisputes] = useState([]);
  const [processingDispute, setProcessingDispute] = useState(null);

  // Admins list
  const [admins, setAdmins] = useState([]);

  // Platform settings
  const [platformSettings, setPlatformSettings] = useState({
    commissionRate: 15,
    baseDeliveryFee: 500,
    maxDeliveryRadius: 15,
    enableScheduling: true,
    enableBulkOrders: true,
  });

  // UI states
  const [loading, setLoading] = useState({
    financial: true,
    platform: true,
    pending: true,
    admins: true,
  });
  const [errors, setErrors] = useState({});

  // Load financial statistics
  const loadFinancialStats = useCallback(async () => {
    setLoading(prev => ({ ...prev, financial: true }));
    try {
      const data = await getFinancialDashboard();
      setFinancialStats({
        totalRevenue: data.totalRevenue || 0,
        totalTransactions: data.totalTransactions || 0,
        totalCommission: data.totalCommission || 0,
        pendingPayouts: data.pendingPayouts || 0,
        averageOrderValue: data.averageOrderValue || 0,
        revenueGrowth: data.revenueGrowth || 0,
        pendingDisputes: data.pendingDisputes || 0,
        floatHealth: data.floatHealth || 'healthy',
      });
    } catch (err) {
      setErrors(prev => ({ ...prev, financial: err.message }));
      // Fallback to mock data if API fails
      setFinancialStats({
        totalRevenue: 0,
        totalTransactions: 0,
        totalCommission: 0,
        pendingPayouts: 0,
        averageOrderValue: 0,
        revenueGrowth: 0,
        pendingDisputes: 0,
        floatHealth: 'unknown',
      });
    } finally {
      setLoading(prev => ({ ...prev, financial: false }));
    }
  }, []);

  // Load platform statistics
  const loadPlatformStats = useCallback(async () => {
    setLoading(prev => ({ ...prev, platform: true }));
    try {
      // Mock data - replace with actual API call
      setTimeout(() => {
        setPlatformStats({
          totalMerchants: 234,
          totalClients: 8945,
          totalDrivers: 156,
          activeMerchants: 198,
          pendingMerchants: 12,
          suspendedAccounts: 8,
        });
        setLoading(prev => ({ ...prev, platform: false }));
      }, 800);
    } catch (err) {
      setErrors(prev => ({ ...prev, platform: err.message }));
      setLoading(prev => ({ ...prev, platform: false }));
    }
  }, []);

  // Load pending validations
  const loadPendingValidations = useCallback(async () => {
    setLoading(prev => ({ ...prev, pending: true }));
    try {
      // Load pending disputes en attente d'approbation admin
      const disputes = await getPendingDisputes('PENDING_ADMIN_APPROVAL');
      setPendingDisputes(Array.isArray(disputes) ? disputes : []);
      
      // TODO: Load pending merchants and drivers from actual API
      setPendingMerchants([]);
      setPendingDrivers([]);
    } catch (err) {
      setErrors(prev => ({ ...prev, pending: err.message }));
      setPendingDisputes([]);
      setPendingMerchants([]);
      setPendingDrivers([]);
    } finally {
      setLoading(prev => ({ ...prev, pending: false }));
    }
  }, []);

  // Load administrators
  const loadAdmins = useCallback(async () => {
    setLoading(prev => ({ ...prev, admins: true }));
    try {
      // Mock data - replace with actual API call
      setTimeout(() => {
        setAdmins([
          { id: '1', name: 'Super Admin', email: 'super@fasofree.bf', role: 'super_admin', status: 'active' },
          { id: '2', name: 'Admin Régional', email: 'admin@fasofree.bf', role: 'admin', status: 'active' },
        ]);
        setLoading(prev => ({ ...prev, admins: false }));
      }, 500);
    } catch (err) {
      setErrors(prev => ({ ...prev, admins: err.message }));
      setLoading(prev => ({ ...prev, admins: false }));
    }
  }, []);

  useEffect(() => {
    loadFinancialStats();
    loadPlatformStats();
    loadPendingValidations();
    loadAdmins();
  }, [loadFinancialStats, loadPlatformStats, loadPendingValidations, loadAdmins]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleValidateMerchant = (id, approved) => {
    setPendingMerchants(prev => prev.filter(m => m.id !== id));
    // API call to validate/reject merchant
  };

  const handleValidateDriver = (id, approved) => {
    setPendingDrivers(prev => prev.filter(d => d.id !== id));
    // API call to validate/reject driver
  };

  const handleSaveSettings = () => {
    // API call to save platform settings
    console.log('Saving platform settings:', platformSettings);
  };

  // Handle dispute approval (refund)
  const handleApproveDispute = async (disputeId) => {
    setProcessingDispute(disputeId);
    try {
      await approveRefund(disputeId, 'Remboursement approuvé par l\'administration');
      // Reload disputes
      const disputes = await getPendingDisputes('PENDING_ADMIN_APPROVAL');
      setPendingDisputes(Array.isArray(disputes) ? disputes : []);
    } catch (err) {
      setError('disputes', err.message);
    } finally {
      setProcessingDispute(null);
    }
  };

  // Handle dispute rejection
  const handleRejectDispute = async (disputeId) => {
    setProcessingDispute(disputeId);
    try {
      await rejectDispute(disputeId, 'Litige rejeté par l\'administration');
      // Reload disputes
      const disputes = await getPendingDisputes('PENDING_ADMIN_APPROVAL');
      setPendingDisputes(Array.isArray(disputes) ? disputes : []);
    } catch (err) {
      setError('disputes', err.message);
    } finally {
      setProcessingDispute(null);
    }
  };

  const tabs = [
    { id: 'overview', label: 'Vue Globale', icon: Layout },
    { id: 'financial', label: 'Finance', icon: DollarSign },
    { id: 'merchants', label: 'Validation Commerçants', icon: Store, badge: pendingMerchants.length },
    { id: 'drivers', label: 'Validation Livreurs', icon: Users, badge: pendingDrivers.length },
    { id: 'disputes', label: 'Litiges', icon: Shield, badge: pendingDisputes.length },
    { id: 'admins', label: 'Gestion Admins', icon: Shield },
    { id: 'settings', label: 'Paramètres', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-background-primary flex">
      {/* ─── SIDEBAR SUPER ADMIN ─────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-64 bg-background-card border-r border-border-light fixed h-full z-20">
        <div className="p-5 border-b border-border-light">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-accent-primary/15">
              <span className="text-accent-primary font-bold text-sm">SA</span>
            </div>
            <div>
              <p className="text-text-primary font-bold text-sm">FasoFree</p>
              <p className="text-accent-primary text-xs font-semibold">Super Administration</p>
            </div>
          </div>
        </div>

        <div className="p-4 border-b border-border-light">
          <div className="flex items-center gap-3">
            <div className="avatar w-9 h-9 bg-accent-primary text-white text-sm font-bold flex items-center justify-center rounded-full">
              {(user?.fullName || 'S').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-text-primary text-xs font-semibold truncate">{user?.fullName || 'Super Admin'}</p>
              <p className="text-text-tertiary text-xs truncate">{user?.email}</p>
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
                className={`nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.id ? 'bg-accent-primary text-white' : 'text-text-secondary hover:bg-background-secondary'
                }`}
              >
                <Icon size={18} strokeWidth={1.5} />
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
          <button onClick={handleLogout} className="nav-item w-full flex items-center gap-3 px-3 py-2.5 text-status-error hover:bg-status-errorBg rounded-lg text-sm font-medium">
            <LogOut size={18} strokeWidth={1.5} />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* ─── MAIN CONTENT ────────────────────────────────────────── */}
      <main className="flex-1 lg:ml-64 min-h-screen p-6 lg:p-8">
        <header className="flex items-center justify-between mb-8 pb-4 border-b border-border-light">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Centre de Contrôle Global</h1>
            <p className="text-text-secondary text-sm">Gestion globale de la plateforme FasoFree</p>
          </div>
          <span className="px-3 py-1 bg-accent-primary/10 text-accent-primary text-xs font-bold rounded-full">
            Mode Super Admin
          </span>
        </header>

        {/* ──────────────────────────────────────────────────────── */}
        {/* ONGLET VUE GLOBALE */}
        {/* ──────────────────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-slide-up">
            {/* Platform Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                label="Commerçants Actifs"
                value={platformStats.activeMerchants}
                icon={Store}
                color="#3B82F6"
                loading={loading.platform}
              />
              <StatCard
                label="Clients Inscrits"
                value={platformStats.totalClients}
                icon={Users}
                color="#22C55E"
                loading={loading.platform}
              />
              <StatCard
                label="Livreurs Partenaires"
                value={platformStats.totalDrivers}
                icon={Activity}
                color="#F59E0B"
                loading={loading.platform}
              />
              <StatCard
                label="Validations en attente"
                value={platformStats.pendingMerchants + pendingDrivers.length}
                icon={Shield}
                color="#EF4444"
                loading={loading.pending}
              />
            </div>

            {/* Financial Overview */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-text-primary">Vue Financière</h2>
                <button onClick={loadFinancialStats} className="btn-secondary gap-2 text-xs">
                  <RefreshCw size={12} className={loading.financial ? 'animate-spin' : ''} />
                  Actualiser
                </button>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <StatCard
                  label="Chiffre d'affaires Global"
                  value={`${(financialStats.totalRevenue / 1000000).toFixed(1)}M FCFA`}
                  icon={TrendingUp}
                  color="#C1652E"
                  trend={financialStats.revenueGrowth}
                  loading={loading.financial}
                />
                <StatCard
                  label="Transactions Totales"
                  value={financialStats.totalTransactions.toLocaleString()}
                  icon={Activity}
                  color="#3B82F6"
                  loading={loading.financial}
                />
                <StatCard
                  label="Commissions Plateforme"
                  value={`${(financialStats.totalCommission / 1000000).toFixed(1)}M FCFA`}
                  icon={Wallet}
                  color="#22C55E"
                  loading={loading.financial}
                />
                <StatCard
                  label="Paiements en attente"
                  value={`${(financialStats.pendingPayouts / 1000000).toFixed(1)}M FCFA`}
                  icon={CreditCard}
                  color="#F59E0B"
                  loading={loading.financial}
                />
                <StatCard
                  label="Litiges en attente"
                  value={financialStats.pendingDisputes}
                  icon={AlertCircle}
                  color="#EF4444"
                  loading={loading.financial}
                />
              </div>
            </div>

            {/* System Health */}
            <div className="card p-6">
              <h2 className="text-base font-bold text-text-primary mb-4">Santé du Système</h2>
              <div className={`p-4 rounded-lg flex items-center justify-between ${
                financialStats.floatHealth === 'healthy' 
                  ? 'bg-status-successBg border border-status-success/30' 
                  : financialStats.floatHealth === 'warning'
                  ? 'bg-status-warningBg border border-status-warning/30'
                  : 'bg-status-errorBg border border-status-error/30'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full animate-ping ${
                    financialStats.floatHealth === 'healthy' 
                      ? 'bg-status-success' 
                      : financialStats.floatHealth === 'warning'
                      ? 'bg-status-warning'
                      : 'bg-status-error'
                  }`} />
                  <span className="text-sm font-semibold text-text-primary">
                    {financialStats.floatHealth === 'healthy' && 'Float Mobile Money: Sain'}
                    {financialStats.floatHealth === 'warning' && 'Float Mobile Money: Attention'}
                    {financialStats.floatHealth === 'critical' && 'Float Mobile Money: Critique'}
                    {financialStats.floatHealth === 'unknown' && 'État du système inconnu'}
                  </span>
                </div>
                <span className="text-xs text-text-secondary">Uptime: 99.9%</span>
              </div>
            </div>
          </div>
        )}

        {/* ──────────────────────────────────────────────────────── */}
        {/* ONGLET FINANCE */}
        {/* ──────────────────────────────────────────────────────── */}
        {activeTab === 'financial' && (
          <div className="space-y-6 animate-slide-up">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-text-primary">Rapports Financiers</h2>
              <button onClick={loadFinancialStats} className="btn-secondary gap-2">
                <RefreshCw size={14} className={loading.financial ? 'animate-spin' : ''} />
                Actualiser
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="card p-6">
                <h3 className="font-bold text-text-primary mb-4">Revenus par Période</h3>
                <div className="h-64 flex items-center justify-center border border-border-light rounded-lg bg-background-secondary">
                  <p className="text-text-secondary text-sm">Graphique des revenus (Bientôt)</p>
                </div>
              </div>
              <div className="card p-6">
                <h3 className="font-bold text-text-primary mb-4">Distribution des Commissions</h3>
                <div className="h-64 flex items-center justify-center border border-border-light rounded-lg bg-background-secondary">
                  <p className="text-text-secondary text-sm">Graphique des commissions (Bientôt)</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ──────────────────────────────────────────────────────── */}
        {/* ONGLET VALIDATION COMMERÇANTS */}
        {/* ──────────────────────────────────────────────────────── */}
        {activeTab === 'merchants' && (
          <div className="space-y-6 animate-slide-up">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-text-primary">Validation des Commerçants</h2>
              <button onClick={loadPendingValidations} className="btn-secondary gap-2">
                <RefreshCw size={14} className={loading.pending ? 'animate-spin' : ''} />
                Actualiser
              </button>
            </div>

            {loading.pending ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="card p-5">
                    <LoadingSkeleton height="h-4" className="mb-2" />
                    <LoadingSkeleton height="h-3" width="w-2/3" />
                  </div>
                ))}
              </div>
            ) : pendingMerchants.length === 0 ? (
              <EmptyState
                icon={Store}
                title="Aucun commerçant en attente"
                description="Tous les commerçants ont été validés."
              />
            ) : (
              <div className="space-y-3">
                {pendingMerchants.map(merchant => (
                  <div key={merchant.id} className="card p-5 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-text-primary">{merchant.name}</h3>
                      <p className="text-xs text-text-secondary">
                        Responsable : {merchant.owner} | Tél : {merchant.phone}
                      </p>
                      <div className="flex gap-2 mt-2">
                        <span className="px-2 py-0.5 bg-background-secondary text-text-tertiary text-xs rounded">
                          {merchant.category}
                        </span>
                        <span className="px-2 py-0.5 bg-background-secondary text-text-tertiary text-xs rounded">
                          {merchant.location}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleValidateMerchant(merchant.id, true)}
                        className="btn-primary py-2 px-3 text-xs flex items-center gap-1 bg-status-success hover:bg-status-success/80"
                      >
                        <CheckCircle size={14} /> Valider
                      </button>
                      <button
                        onClick={() => handleValidateMerchant(merchant.id, false)}
                        className="btn-secondary py-2 px-3 text-xs flex items-center gap-1 text-status-error border-status-error/30"
                      >
                        <XCircle size={14} /> Rejeter
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ──────────────────────────────────────────────────────── */}
        {/* ONGLET VALIDATION LIVREURS */}
        {/* ──────────────────────────────────────────────────────── */}
        {activeTab === 'drivers' && (
          <div className="space-y-6 animate-slide-up">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-text-primary">Validation des Livreurs</h2>
              <button onClick={loadPendingValidations} className="btn-secondary gap-2">
                <RefreshCw size={14} className={loading.pending ? 'animate-spin' : ''} />
                Actualiser
              </button>
            </div>

            {loading.pending ? (
              <div className="space-y-3">
                {[1, 2].map(i => (
                  <div key={i} className="card p-5">
                    <LoadingSkeleton height="h-4" className="mb-2" />
                    <LoadingSkeleton height="h-3" width="w-2/3" />
                  </div>
                ))}
              </div>
            ) : pendingDrivers.length === 0 ? (
              <EmptyState
                icon={Users}
                title="Aucun livreur en attente"
                description="Tous les livreurs ont été validés."
              />
            ) : (
              <div className="space-y-3">
                {pendingDrivers.map(driver => (
                  <div key={driver.id} className="card p-5 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-text-primary">{driver.name}</h3>
                      <p className="text-xs text-text-secondary">
                        Tél : {driver.phone} | Véhicule : {driver.vehicleType}
                      </p>
                      <span className="px-2 py-0.5 bg-background-secondary text-text-tertiary text-xs rounded mt-2">
                        {driver.location}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleValidateDriver(driver.id, true)}
                        className="btn-primary py-2 px-3 text-xs flex items-center gap-1 bg-status-success hover:bg-status-success/80"
                      >
                        <CheckCircle size={14} /> Valider
                      </button>
                      <button
                        onClick={() => handleValidateDriver(driver.id, false)}
                        className="btn-secondary py-2 px-3 text-xs flex items-center gap-1 text-status-error border-status-error/30"
                      >
                        <XCircle size={14} /> Rejeter
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ──────────────────────────────────────────────────────── */}
        {/* ONGLET LITIGES */}
        {/* ──────────────────────────────────────────────────────── */}
        {activeTab === 'disputes' && (
          <div className="space-y-6 animate-slide-up">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-text-primary">Litiges en attente</h2>
              <button onClick={loadPendingValidations} className="btn-secondary gap-2">
                <RefreshCw size={14} className={loading.pending ? 'animate-spin' : ''} />
                Actualiser
              </button>
            </div>

            {loading.pending ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="card p-5">
                    <LoadingSkeleton height="h-4" className="mb-2" />
                    <LoadingSkeleton height="h-3" width="w-2/3" />
                  </div>
                ))}
              </div>
            ) : pendingDisputes.length === 0 ? (
              <div className="card flex flex-col items-center justify-center py-16 text-center">
                <Shield size={48} className="text-text-tertiary mb-4" strokeWidth={1} />
                <p className="text-text-secondary font-semibold mb-2">Aucun litige en attente</p>
                <p className="text-text-tertiary text-sm">Tous les litiges ont été traités</p>
              </div>
            ) : (
              <div className="card overflow-hidden">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Commande</th>
                      <th>Client</th>
                      <th>Raison</th>
                      <th>Montant Remboursement</th>
                      <th>Agent Support</th>
                      <th>Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingDisputes.map(dispute => (
                      <tr key={dispute.id}>
                        <td>
                          <p className="font-mono text-text-primary text-xs">#{dispute.orderId?.slice(-8)}</p>
                        </td>
                        <td>
                          <p className="text-text-secondary text-xs">{dispute.clientId?.slice(-8)}</p>
                        </td>
                        <td>
                          <p className="text-text-primary text-sm line-clamp-1 max-w-xs">{dispute.reason}</p>
                        </td>
                        <td>
                          <p className="font-semibold text-accent-primary text-sm">
                            {dispute.refundAmount?.toLocaleString() || 'N/A'} FCFA
                          </p>
                        </td>
                        <td>
                          <p className="text-text-tertiary text-xs">
                            {dispute.supportAgentId?.slice(-8) || 'Non assigné'}
                          </p>
                          {dispute.supportNote && (
                            <p className="text-text-secondary text-xs line-clamp-1">{dispute.supportNote}</p>
                          )}
                        </td>
                        <td>
                          <p className="text-text-tertiary text-xs">
                            {new Date(dispute.createdAt).toLocaleDateString('fr-FR')}
                          </p>
                        </td>
                        <td>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => handleApproveDispute(dispute.id)}
                              disabled={processingDispute === dispute.id}
                              className="btn-icon text-status-success hover:bg-status-successBg disabled:opacity-50" 
                              title="Valider le remboursement"
                            >
                              {processingDispute === dispute.id ? (
                                <span className="w-4 h-4 border-2 border-status-success/30 border-t-status-success rounded-full animate-spin" />
                              ) : (
                                <CheckCircle size={14} />
                              )}
                            </button>
                            <button 
                              onClick={() => handleRejectDispute(dispute.id)}
                              disabled={processingDispute === dispute.id}
                              className="btn-icon text-status-error hover:bg-status-errorBg disabled:opacity-50" 
                              title="Rejeter le litige"
                            >
                              {processingDispute === dispute.id ? (
                                <span className="w-4 h-4 border-2 border-status-error/30 border-t-status-error rounded-full animate-spin" />
                              ) : (
                                <XCircle size={14} />
                              )}
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
        {/* ONGLET GESTION ADMINS */}
        {/* ──────────────────────────────────────────────────────── */}
        {activeTab === 'admins' && (
          <div className="space-y-6 animate-slide-up">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-text-primary">Gestion des Administrateurs</h2>
              <button className="btn-primary text-xs flex items-center gap-1">
                <Plus size={14} /> Ajouter un Admin
              </button>
            </div>

            {loading.admins ? (
              <div className="space-y-3">
                {[1, 2].map(i => (
                  <div key={i} className="card p-5">
                    <LoadingSkeleton height="h-4" className="mb-2" />
                    <LoadingSkeleton height="h-3" width="w-2/3" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="card overflow-hidden">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Administrateur</th>
                      <th>Email</th>
                      <th>Rôle</th>
                      <th>Statut</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {admins.map(admin => (
                      <tr key={admin.id}>
                        <td>
                          <p className="font-bold text-text-primary text-sm">{admin.name}</p>
                        </td>
                        <td>
                          <p className="text-text-secondary text-xs">{admin.email}</p>
                        </td>
                        <td>
                          <span className="px-2 py-1 rounded text-[10px] font-bold uppercase bg-background-secondary text-text-secondary">
                            {admin.role}
                          </span>
                        </td>
                        <td>
                          <StatusBadge status={admin.status} statusConfig={{
                            active: { label: 'Actif', color: 'success', dot: '#22C55E' },
                            inactive: { label: 'Inactif', color: 'gray', dot: '#A09890' },
                          }} />
                        </td>
                        <td>
                          <button className="btn-icon text-status-error hover:bg-status-errorBg">
                            <Trash2 size={14} />
                          </button>
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
        {/* ONGLET PARAMÈTRES */}
        {/* ──────────────────────────────────────────────────────── */}
        {activeTab === 'settings' && (
          <div className="space-y-6 animate-slide-up">
            <h2 className="text-xl font-bold text-text-primary">Paramètres de la Plateforme</h2>
            
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Financial Settings */}
              <div className="card p-6">
                <h3 className="font-bold text-text-primary mb-4 flex items-center gap-2">
                  <DollarSign size={16} className="text-accent-primary" />
                  Paramètres Financiers
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary uppercase mb-1">
                      Commission de la plateforme (%)
                    </label>
                    <input 
                      type="number" 
                      className="input-field"
                      value={platformSettings.commissionRate}
                      onChange={(e) => setPlatformSettings(prev => ({ ...prev, commissionRate: Number(e.target.value) }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary uppercase mb-1">
                      Frais de livraison de base (FCFA)
                    </label>
                    <input 
                      type="number" 
                      className="input-field"
                      value={platformSettings.baseDeliveryFee}
                      onChange={(e) => setPlatformSettings(prev => ({ ...prev, baseDeliveryFee: Number(e.target.value) }))}
                    />
                  </div>
                </div>
              </div>

              {/* Geographic Settings */}
              <div className="card p-6">
                <h3 className="font-bold text-text-primary mb-4 flex items-center gap-2">
                  <MapPin size={16} className="text-accent-primary" />
                  Paramètres Géographiques
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary uppercase mb-1">
                      Rayon de livraison maximal (km)
                    </label>
                    <input 
                      type="number" 
                      className="input-field"
                      value={platformSettings.maxDeliveryRadius}
                      onChange={(e) => setPlatformSettings(prev => ({ ...prev, maxDeliveryRadius: Number(e.target.value) }))}
                    />
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-background-secondary rounded-md">
                    <span className="text-sm text-text-secondary flex-1">Activer la planification</span>
                    <button
                      onClick={() => setPlatformSettings(prev => ({ ...prev, enableScheduling: !prev.enableScheduling }))}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        platformSettings.enableScheduling ? 'bg-accent-primary' : 'bg-background-tertiary'
                      }`}
                    >
                      <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                        platformSettings.enableScheduling ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-background-secondary rounded-md">
                    <span className="text-sm text-text-secondary flex-1">Activer les commandes groupées</span>
                    <button
                      onClick={() => setPlatformSettings(prev => ({ ...prev, enableBulkOrders: !prev.enableBulkOrders }))}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        platformSettings.enableBulkOrders ? 'bg-accent-primary' : 'bg-background-tertiary'
                      }`}
                    >
                      <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                        platformSettings.enableBulkOrders ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button onClick={handleSaveSettings} className="btn-primary">
                Enregistrer les modifications
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default SuperAdminDashboard;