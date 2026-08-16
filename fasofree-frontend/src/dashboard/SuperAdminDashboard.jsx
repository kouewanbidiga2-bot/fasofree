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
  Plus, CreditCard, MapPin, Activity, DollarSign, Crown, Pencil, Calendar,
  BadgeCheck, Radio, Ban, KeyRound, ClipboardList
} from 'lucide-react';
import useAuthStore from '../store/authStore';
import { StatCard, StatusBadge, LoadingSkeleton, EmptyState } from './components/StatCard';
import { getFinancialDashboard, getPendingDisputes } from '../services/financialService';
import { approveRefund, rejectDispute } from '../services/disputeService';
import {
  getSubscriptionPlans,
  createSubscriptionPlan,
  updateSubscriptionPlan,
  getSubscriptions,
  assignSubscription,
  getBusinesses,
} from '../services/subscriptionService';
import {
  getUsers,
  createUser,
  updateUserStatus,
  updateUserRole,
} from '../services/usersService';
import { getKycPending, approveKyc, rejectKyc } from '../services/kycService';

const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [activeTab, setActiveTab] = useState('overview');

  const userRole = String(user?.role || '').toLowerCase().replace('-', '_');
  const isSuperAdmin = ['super_admin', 'superadmin'].includes(userRole);

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
  const [pendingDisputes, setPendingDisputes] = useState([]);
  const [processingDispute, setProcessingDispute] = useState(null);

  // KYC validation queue (commerçants & livreurs)
  const [kycPending, setKycPending] = useState([]);
  const [kycBusy, setKycBusy] = useState(null);
  const [kycMsg, setKycMsg] = useState(null);

  // Users management
  const [users, setUsers] = useState([]);
  const [usersBusy, setUsersBusy] = useState(null);
  const [usersMsg, setUsersMsg] = useState(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [createUserBusy, setCreateUserBusy] = useState(false);
  const [userForm, setUserForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    role: 'admin',
  });

  // Subscriptions
  const [plans, setPlans] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [planForm, setPlanForm] = useState({
    code: '',
    name: '',
    description: '',
    subjectType: 'MERCHANT',
    priceFcfa: 0,
    durationDays: 30,
    commissionRate: 0.015,
    freeServiceFee: false,
    freeDelivery: false,
    isActive: true,
  });
  const [assignForm, setAssignForm] = useState({
    subjectType: 'MERCHANT',
    subjectId: '',
    planCode: 'PRO',
    durationDays: '',
    autoRenew: true,
    renew: false,
    debitWallet: false,
  });
  const [subLoading, setSubLoading] = useState(false);
  const [subError, setSubError] = useState(null);
  const [subSuccess, setSubSuccess] = useState(null);
  const [assignBusy, setAssignBusy] = useState(false);

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
    kyc: true,
    users: true,
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

  // Load pending validations (litiges à approuver)
  const loadPendingValidations = useCallback(async () => {
    setLoading(prev => ({ ...prev, pending: true }));
    try {
      // Load pending disputes en attente d'approbation admin
      const disputes = await getPendingDisputes('PENDING_ADMIN_APPROVAL');
      setPendingDisputes(Array.isArray(disputes) ? disputes : []);
    } catch (err) {
      setErrors(prev => ({ ...prev, pending: err.message }));
      setPendingDisputes([]);
    } finally {
      setLoading(prev => ({ ...prev, pending: false }));
    }
  }, []);

  // File d'attente KYC (validation des comptes commerçants & livreurs)
  const loadKyc = useCallback(async () => {
    setLoading(prev => ({ ...prev, kyc: true }));
    try {
      const data = await getKycPending();
      setKycPending(Array.isArray(data) ? data : []);
      setKycMsg(null);
    } catch (err) {
      setKycMsg({ type: 'error', text: err.message });
    } finally {
      setLoading(prev => ({ ...prev, kyc: false }));
    }
  }, []);

  // Utilisateurs + statistiques plateforme (données réelles)
  const loadUsers = useCallback(async () => {
    setLoading(prev => ({ ...prev, users: true, platform: true }));
    try {
      const [usersData, businessesData] = await Promise.all([
        getUsers(),
        getBusinesses(),
      ]);
      const list = Array.isArray(usersData) ? usersData : [];
      const merchants = Array.isArray(businessesData) ? businessesData : [];
      setUsers(list);
      const countRole = (r) =>
        list.filter((u) => String(u.role).toLowerCase().replace('-', '_') === r).length;
      setPlatformStats({
        totalMerchants: merchants.length,
        totalClients: countRole('client') + countRole('customer'),
        totalDrivers: countRole('driver') + countRole('courier'),
        activeMerchants: merchants.filter((b) => b.isActive !== false).length,
        pendingMerchants: 0,
        suspendedAccounts: list.filter((u) => u.isActive === false).length,
      });
      setUsersMsg(null);
    } catch (err) {
      setUsersMsg({ type: 'error', text: err.message });
    } finally {
      setLoading(prev => ({ ...prev, users: false, platform: false }));
    }
  }, []);

  useEffect(() => {
    loadFinancialStats();
    loadPendingValidations();
    loadKyc();
    loadUsers();
  }, [loadFinancialStats, loadPendingValidations, loadKyc, loadUsers]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // ─── Actions Utilisateurs ─────────────────────────────────────────────
  const handleCreateUserSubmit = async () => {
    setUsersMsg(null);
    setCreateUserBusy(true);
    try {
      await createUser({
        fullName: userForm.fullName.trim(),
        email: userForm.email.trim().toLowerCase(),
        phone: userForm.phone.trim(),
        password: userForm.password,
        role: userForm.role,
      });
      setShowUserModal(false);
      setUserForm({ fullName: '', email: '', phone: '', password: '', role: 'admin' });
      setUsersMsg({ type: 'success', text: 'Compte créé avec succès.' });
      await loadUsers();
    } catch (err) {
      setUsersMsg({ type: 'error', text: err.message });
    } finally {
      setCreateUserBusy(false);
    }
  };

  const handleToggleUserStatus = async (id, isActive) => {
    setUsersBusy(id);
    setUsersMsg(null);
    try {
      await updateUserStatus(id, isActive);
      setUsersMsg({ type: 'success', text: isActive ? 'Compte réactivé.' : 'Compte banni.' });
      await loadUsers();
    } catch (err) {
      setUsersMsg({ type: 'error', text: err.message });
    } finally {
      setUsersBusy(null);
    }
  };

  const handleChangeUserRole = async (id, role) => {
    setUsersBusy(id);
    setUsersMsg(null);
    try {
      await updateUserRole(id, role);
      setUsersMsg({ type: 'success', text: 'Rôle mis à jour.' });
      await loadUsers();
    } catch (err) {
      setUsersMsg({ type: 'error', text: err.message });
    } finally {
      setUsersBusy(null);
    }
  };

  // ─── Actions KYC ──────────────────────────────────────────────────────
  const handleApproveKyc = async (id) => {
    setKycBusy(id);
    setKycMsg(null);
    try {
      await approveKyc(id);
      setKycMsg({ type: 'success', text: 'Document KYC approuvé.' });
      await loadKyc();
    } catch (err) {
      setKycMsg({ type: 'error', text: err.message });
    } finally {
      setKycBusy(null);
    }
  };

  const handleRejectKyc = async (id) => {
    const reason = window.prompt('Motif du rejet (obligatoire) :');
    if (reason === null) return;
    setKycBusy(id);
    setKycMsg(null);
    try {
      await rejectKyc(id, reason.trim() || 'Pièce invalide ou illisible');
      setKycMsg({ type: 'success', text: 'Document KYC rejeté.' });
      await loadKyc();
    } catch (err) {
      setKycMsg({ type: 'error', text: err.message });
    } finally {
      setKycBusy(null);
    }
  };

  // ─── Helpers d'affichage ──────────────────────────────────────────────
  const roleLabel = (role) =>
    String(role || '')
      .toLowerCase()
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  const kycTypeLabel = (type) =>
    ({
      IDENTITY_CARD: 'Carte d\'identité',
      DRIVER_LICENSE: 'Permis de conduire',
      VEHICLE_REGISTRATION: 'Carte grise du véhicule',
    })[type] || String(type || '').replace(/_/g, ' ');

  const handleSaveSettings = () => {
    // API call to save platform settings
    console.log('Saving platform settings:', platformSettings);
  };

  // Load subscription data (catalog, active subs, businesses)
  const loadSubscriptions = useCallback(async () => {
    setSubLoading(true);
    setSubError(null);
    try {
      const [plansData, subsData, businessesData] = await Promise.all([
        getSubscriptionPlans(),
        getSubscriptions(),
        getBusinesses(),
      ]);
      setPlans(Array.isArray(plansData) ? plansData : []);
      setSubscriptions(Array.isArray(subsData) ? subsData : []);
      setBusinesses(Array.isArray(businessesData) ? businessesData : []);
    } catch (err) {
      setSubError(err.message);
    } finally {
      setSubLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSubscriptions();
  }, [loadSubscriptions]);

  const openCreatePlan = () => {
    setEditingPlan(null);
    setPlanForm({
      code: '',
      name: '',
      description: '',
      subjectType: 'MERCHANT',
      priceFcfa: 0,
      durationDays: 30,
      commissionRate: 0.015,
      freeServiceFee: false,
      freeDelivery: false,
      isActive: true,
    });
    setShowPlanModal(true);
  };

  const openEditPlan = (plan) => {
    setEditingPlan(plan);
    setPlanForm({
      code: plan.code,
      name: plan.name,
      description: plan.description || '',
      subjectType: plan.subjectType,
      priceFcfa: Number(plan.priceFcfa) || 0,
      durationDays: plan.durationDays,
      commissionRate: Number(plan.commissionRate) ?? null,
      freeServiceFee: !!plan.freeServiceFee,
      freeDelivery: !!plan.freeDelivery,
      isActive: !!plan.isActive,
    });
    setShowPlanModal(true);
  };

  const handleSavePlan = async () => {
    setSubError(null);
    setSubSuccess(null);
    try {
      const price = Number(planForm.priceFcfa) || 0;
      if (
        planForm.subjectType === 'MERCHANT' &&
        price > 0 &&
        price < 5000
      ) {
        setSubError('Le prix minimum d\'un forfait marchand payant est de 5 000 FCFA (le plan gratuit Starter reste à 0 FCFA).');
        return;
      }
      const payload = {
        name: planForm.name,
        description: planForm.description,
        subjectType: planForm.subjectType,
        priceFcfa: price,
        durationDays: Math.max(1, Number(planForm.durationDays) || 30),
        commissionRate:
          planForm.commissionRate === null || planForm.commissionRate === ''
            ? null
            : Number(planForm.commissionRate),
        freeServiceFee: !!planForm.freeServiceFee,
        freeDelivery: !!planForm.freeDelivery,
        isActive: !!planForm.isActive,
      };
      if (editingPlan) {
        await updateSubscriptionPlan(editingPlan.code, payload);
        setSubSuccess(`Forfait ${editingPlan.code} mis à jour.`);
      } else {
        await createSubscriptionPlan({ code: planForm.code, ...payload });
        setSubSuccess(`Forfait ${planForm.code} créé.`);
      }
      setShowPlanModal(false);
      await loadSubscriptions();
    } catch (err) {
      setSubError(err.message);
    }
  };

  const handleAssign = async () => {
    setSubError(null);
    setSubSuccess(null);
    setAssignBusy(true);
    try {
      const result = await assignSubscription({
        subjectType: assignForm.subjectType,
        subjectId: assignForm.subjectId,
        planCode: assignForm.planCode,
        durationDays: assignForm.durationDays
          ? Number(assignForm.durationDays)
          : undefined,
        autoRenew: assignForm.autoRenew,
        renew: assignForm.renew,
        debitWallet: assignForm.debitWallet,
      });
      setSubSuccess(
        `Abonnement ${result.plan} assigné (${result.subjectType}/${result.subjectId.slice(0, 8)}…).`,
      );
      setAssignForm((prev) => ({ ...prev, subjectId: '' }));
      await loadSubscriptions();
    } catch (err) {
      setSubError(err.message);
    } finally {
      setAssignBusy(false);
    }
  };

  const formatFcfa = (v) => `${Number(v || 0).toLocaleString('fr-FR')} FCFA`;
  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString('fr-FR') : '—';
  const merchantOptions =
    assignForm.subjectType === 'MERCHANT'
      ? businesses
      : [];

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
    { id: 'kyc', label: 'Validation KYC', icon: BadgeCheck, badge: kycPending.length },
    { id: 'disputes', label: 'Litiges', icon: Shield, badge: pendingDisputes.length },
    ...(isSuperAdmin
      ? [
          { id: 'financial', label: 'Finance', icon: DollarSign },
          { id: 'subscriptions', label: 'Abonnements', icon: Crown },
          { id: 'users', label: 'Gestion Utilisateurs', icon: Users },
          { id: 'settings', label: 'Paramètres', icon: Settings },
        ]
      : []),
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
              <p className="text-accent-primary text-xs font-semibold">
                {isSuperAdmin ? 'Super Administration' : 'Administration'}
              </p>
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

          <button
            onClick={() => navigate('/dashboard/applications')}
            className="nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-status-info border border-status-info/30 mt-2 hover:bg-background-secondary"
          >
            <ClipboardList size={18} strokeWidth={1.5} />
            <span className="flex-1 text-left">Candidatures (Onboarding)</span>
            {kycPending.length > 0 && (
              <span className="w-5 h-5 bg-status-error text-white text-xs rounded-full flex items-center justify-center font-bold">
                {kycPending.length}
              </span>
            )}
          </button>

          <button
            onClick={() => navigate('/dashboard/live-orders')}
            className="nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-status-success border border-status-success/30 mt-2 hover:bg-status-successBg"
          >
            <Radio size={18} strokeWidth={1.5} className="animate-pulse" />
            <span className="flex-1 text-left">Tour de contrôle (Live)</span>
          </button>
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
            Mode {isSuperAdmin ? 'Super Admin' : roleLabel(userRole)}
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
                value={kycPending.length}
                icon={Shield}
                color="#EF4444"
                loading={loading.pending}
              />
            </div>

            {/* Financial Overview (réservé au Super Admin) */}
            {isSuperAdmin && (
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
            )}

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
        {/* ONGLET VALIDATION KYC */}
        {/* ──────────────────────────────────────────────────────── */}
        {activeTab === 'kyc' && (
          <div className="space-y-6 animate-slide-up">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-text-primary">Validation KYC</h2>
                <p className="text-text-secondary text-sm">
                  Comptes commerçants & livreurs en attente de validation (carte d'identité, permis, carte grise).
                </p>
              </div>
              <button onClick={loadKyc} className="btn-secondary gap-2">
                <RefreshCw size={14} className={loading.kyc ? 'animate-spin' : ''} />
                Actualiser
              </button>
            </div>

            {kycMsg && (
              <div className={`p-3 rounded-lg border text-sm ${kycMsg.type === 'success' ? 'bg-status-successBg border-status-success/30 text-status-success' : 'bg-status-errorBg border-status-error/30 text-status-error'}`}>
                {kycMsg.text}
              </div>
            )}

            {loading.kyc ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="card p-5">
                    <LoadingSkeleton height="h-4" className="mb-2" />
                    <LoadingSkeleton height="h-3" width="w-2/3" />
                  </div>
                ))}
              </div>
            ) : kycPending.length === 0 ? (
              <div className="card flex flex-col items-center justify-center py-16 text-center">
                <BadgeCheck size={48} className="text-text-tertiary mb-4" strokeWidth={1} />
                <p className="text-text-secondary font-semibold mb-2">Aucune demande KYC en attente</p>
                <p className="text-text-tertiary text-sm">Toutes les demandes ont été traitées</p>
              </div>
            ) : (
              <div className="card overflow-hidden">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Utilisateur (ID)</th>
                      <th>Document</th>
                      <th>Fichier</th>
                      <th>Taille</th>
                      <th>Soumise le</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kycPending.map(doc => (
                      <tr key={doc.id}>
                        <td>
                          <p className="font-mono text-text-primary text-xs font-bold">{doc.ownerId?.slice(0, 8)}</p>
                        </td>
                        <td>
                          <span className="px-2 py-1 rounded text-[10px] font-bold uppercase bg-background-secondary text-text-secondary">
                            {kycTypeLabel(doc.type)}
                          </span>
                        </td>
                        <td>
                          <p className="text-text-secondary text-xs">{doc.mimeType}</p>
                        </td>
                        <td>
                          <p className="text-text-secondary text-xs">{(Number(doc.size || 0) / 1024).toFixed(0)} Ko</p>
                        </td>
                        <td>
                          <p className="text-text-tertiary text-xs">{formatDate(doc.createdAt)}</p>
                        </td>
                        <td>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleApproveKyc(doc.id)}
                              disabled={kycBusy === doc.id}
                              className="btn-icon text-status-success hover:bg-status-successBg disabled:opacity-50"
                              title="Approuver"
                            >
                              {kycBusy === doc.id ? (
                                <span className="w-4 h-4 border-2 border-status-success/30 border-t-status-success rounded-full animate-spin" />
                              ) : (
                                <CheckCircle size={14} />
                              )}
                            </button>
                            <button
                              onClick={() => handleRejectKyc(doc.id)}
                              disabled={kycBusy === doc.id}
                              className="btn-icon text-status-error hover:bg-status-errorBg disabled:opacity-50"
                              title="Rejeter"
                            >
                              {kycBusy === doc.id ? (
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
        {/* ONGLET ABONNEMENTS */}
        {/* ──────────────────────────────────────────────────────── */}
        {activeTab === 'subscriptions' && (
          <div className="space-y-6 animate-slide-up">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-text-primary">Abonnements & Forfaits</h2>
                <p className="text-text-secondary text-sm">
                  Forfaits marchands (Starter/Pro, commission ≥ 1,5%) et FasoFree Pass VIP (frais de plateforme offerts).
                </p>
              </div>
              <button onClick={loadSubscriptions} className="btn-secondary gap-2">
                <RefreshCw size={14} className={subLoading ? 'animate-spin' : ''} />
                Actualiser
              </button>
            </div>

            {subError && (
              <div className="p-3 rounded-lg bg-status-errorBg border border-status-error/30 text-status-error text-sm">
                {subError}
              </div>
            )}
            {subSuccess && (
              <div className="p-3 rounded-lg bg-status-successBg border border-status-success/30 text-status-success text-sm">
                {subSuccess}
              </div>
            )}

            {/* Catalogue des forfaits */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-text-primary flex items-center gap-2">
                  <Crown size={16} className="text-accent-primary" /> Catalogue des forfaits
                </h3>
                <button onClick={openCreatePlan} className="btn-primary text-xs flex items-center gap-1">
                  <Plus size={14} /> Créer un forfait
                </button>
              </div>

              {subLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="border border-border-light rounded-lg p-4">
                      <LoadingSkeleton height="h-4" className="mb-2" />
                      <LoadingSkeleton height="h-3" width="w-2/3" />
                    </div>
                  ))}
                </div>
              ) : plans.length === 0 ? (
                <EmptyState
                  icon={Crown}
                  title="Aucun forfait"
                  description="Créez votre premier forfait d'abonnement."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Code</th>
                        <th>Nom</th>
                        <th>Type</th>
                        <th>Prix</th>
                        <th>Durée</th>
                        <th>Commission</th>
                        <th>Avantages</th>
                        <th>Statut</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plans.map(plan => (
                        <tr key={plan.code}>
                          <td><p className="font-mono text-text-primary text-xs font-bold">{plan.code}</p></td>
                          <td>
                            <p className="font-semibold text-text-primary text-sm">{plan.name}</p>
                            {plan.description && (
                              <p className="text-text-tertiary text-xs line-clamp-1 max-w-xs">{plan.description}</p>
                            )}
                          </td>
                          <td>
                            <span className="px-2 py-1 rounded text-[10px] font-bold uppercase bg-background-secondary text-text-secondary">
                              {plan.subjectType}
                            </span>
                          </td>
                          <td>
                            <p className="font-semibold text-accent-primary text-sm">{formatFcfa(plan.priceFcfa)}</p>
                          </td>
                          <td>
                            <p className="text-text-secondary text-xs">
                              {plan.durationDays >= 365 ? `${(plan.durationDays / 365).toFixed(0)} an(s)` : `${plan.durationDays} j`}
                            </p>
                          </td>
                          <td>
                            <p className="text-text-secondary text-xs">
                              {plan.commissionRate === null || plan.commissionRate === undefined
                                ? '—'
                                : `${(Number(plan.commissionRate) * 100).toLocaleString('fr-FR')} %`}
                            </p>
                          </td>
                          <td>
                            <div className="flex flex-wrap gap-1">
                              {plan.freeServiceFee && (
                                <span className="px-2 py-0.5 bg-status-successBg text-status-success text-[10px] font-bold rounded">Frais 100 FCFA offerts</span>
                              )}
                              {plan.freeDelivery && (
                                <span className="px-2 py-0.5 bg-status-successBg text-status-success text-[10px] font-bold rounded">Livraison offerte</span>
                              )}
                              {!plan.freeServiceFee && !plan.freeDelivery && (
                                <span className="text-text-tertiary text-xs">—</span>
                              )}
                            </div>
                          </td>
                          <td>
                            <StatusBadge status={plan.isActive ? 'active' : 'inactive'} statusConfig={{
                              active: { label: 'Actif', color: 'success', dot: '#22C55E' },
                              inactive: { label: 'Inactif', color: 'gray', dot: '#A09890' },
                            }} />
                          </td>
                          <td>
                            <button
                              onClick={() => openEditPlan(plan)}
                              className="btn-icon text-accent-primary hover:bg-background-secondary"
                              title="Modifier"
                            >
                              <Pencil size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Assignation d'abonnement */}
            <div className="card p-6">
              <h3 className="font-bold text-text-primary mb-4 flex items-center gap-2">
                <Calendar size={16} className="text-accent-primary" /> Assigner / Renouveler un abonnement
              </h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary uppercase mb-1">Sujet</label>
                  <select
                    className="input-field"
                    value={assignForm.subjectType}
                    onChange={(e) => setAssignForm(prev => ({ ...prev, subjectType: e.target.value, subjectId: '' }))}
                  >
                    <option value="MERCHANT">Commerçant</option>
                    <option value="CUSTOMER">Client (VIP)</option>
                  </select>
                </div>
                {assignForm.subjectType === 'MERCHANT' ? (
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary uppercase mb-1">Commerce</label>
                    <select
                      className="input-field"
                      value={assignForm.subjectId}
                      onChange={(e) => setAssignForm(prev => ({ ...prev, subjectId: e.target.value }))}
                    >
                      <option value="">— Choisir —</option>
                      {merchantOptions.map(b => (
                        <option key={b.id} value={b.id}>{b.name} ({b.id.slice(0, 8)}…)</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary uppercase mb-1">ID Client (UUID)</label>
                    <input
                      className="input-field"
                      placeholder="UUID du client"
                      value={assignForm.subjectId}
                      onChange={(e) => setAssignForm(prev => ({ ...prev, subjectId: e.target.value }))}
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold text-text-secondary uppercase mb-1">Forfait</label>
                  <select
                    className="input-field"
                    value={assignForm.planCode}
                    onChange={(e) => setAssignForm(prev => ({ ...prev, planCode: e.target.value }))}
                  >
                    {plans.map(p => (
                      <option key={p.code} value={p.code}>
                        {p.code} — {p.name} ({formatFcfa(p.priceFcfa)})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary uppercase mb-1">Durée (jours, optionnel)</label>
                  <input
                    type="number"
                    className="input-field"
                    placeholder="Durée du forfait"
                    value={assignForm.durationDays}
                    onChange={(e) => setAssignForm(prev => ({ ...prev, durationDays: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col justify-end gap-2">
                  <label className="flex items-center gap-2 text-sm text-text-secondary">
                    <input
                      type="checkbox"
                      checked={assignForm.renew}
                      onChange={(e) => setAssignForm(prev => ({ ...prev, renew: e.target.checked }))}
                    />
                    Prolonger l'abonnement actif
                  </label>
                  <label className="flex items-center gap-2 text-sm text-text-secondary">
                    <input
                      type="checkbox"
                      checked={assignForm.debitWallet}
                      onChange={(e) => setAssignForm(prev => ({ ...prev, debitWallet: e.target.checked }))}
                    />
                    Débiter le portefeuille marchand
                  </label>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleAssign}
                    disabled={!assignForm.subjectId || assignBusy}
                    className="btn-primary text-xs disabled:opacity-50"
                  >
                    {assignBusy ? 'Envoi…' : 'Assigner'}
                  </button>
                </div>
              </div>
            </div>

            {/* Abonnements actifs */}
            <div className="card p-6">
              <h3 className="font-bold text-text-primary mb-4">Abonnements actifs</h3>
              {subLoading ? (
                <div className="space-y-3">
                  {[1, 2].map(i => (
                    <div key={i} className="border border-border-light rounded-lg p-4">
                      <LoadingSkeleton height="h-4" className="mb-2" />
                      <LoadingSkeleton height="h-3" width="w-1/2" />
                    </div>
                  ))}
                </div>
              ) : subscriptions.length === 0 ? (
                <EmptyState
                  icon={Crown}
                  title="Aucun abonnement"
                  description="Les abonnements assignés apparaîtront ici."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Sujet</th>
                        <th>ID</th>
                        <th>Forfait</th>
                        <th>Début</th>
                        <th>Expiration</th>
                        <th>Renouvellement auto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subscriptions.map(sub => (
                        <tr key={sub.id}>
                          <td>
                            <span className="px-2 py-1 rounded text-[10px] font-bold uppercase bg-background-secondary text-text-secondary">
                              {sub.subjectType}
                            </span>
                          </td>
                          <td>
                            <p className="font-mono text-text-secondary text-xs">{sub.subjectId}</p>
                          </td>
                          <td>
                            <span className="px-2 py-1 rounded text-[10px] font-bold uppercase bg-accent-primary/10 text-accent-primary">
                              {sub.plan}
                            </span>
                          </td>
                          <td><p className="text-text-secondary text-xs">{formatDate(sub.startDate)}</p></td>
                          <td>
                            <p className={`text-xs ${sub.isActive ? 'text-text-primary' : 'text-text-tertiary'}`}>
                              {formatDate(sub.endDate)}
                            </p>
                          </td>
                          <td>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${sub.autoRenew ? 'bg-status-successBg text-status-success' : 'bg-background-secondary text-text-tertiary'}`}>
                              {sub.autoRenew ? 'Oui' : 'Non'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ──────────────────────────────────────────────────────── */}
        {/* ONGLET GESTION UTILISATEURS */}
        {/* ──────────────────────────────────────────────────────── */}
        {activeTab === 'users' && (
          <div className="space-y-6 animate-slide-up">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-text-primary">Gestion des Utilisateurs</h2>
                <p className="text-text-secondary text-sm">
                  Bannir / réactiver des comptes, changer les rôles et créer des comptes administrateurs.
                </p>
              </div>
              <button onClick={() => setShowUserModal(true)} className="btn-primary text-xs flex items-center gap-1">
                <Plus size={14} /> Créer un compte
              </button>
            </div>

            {usersMsg && (
              <div className={`p-3 rounded-lg border text-sm ${usersMsg.type === 'success' ? 'bg-status-successBg border-status-success/30 text-status-success' : 'bg-status-errorBg border-status-error/30 text-status-error'}`}>
                {usersMsg.text}
              </div>
            )}

            {loading.users ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="card p-5">
                    <LoadingSkeleton height="h-4" className="mb-2" />
                    <LoadingSkeleton height="h-3" width="w-2/3" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Utilisateur</th>
                        <th>Email</th>
                        <th>Téléphone</th>
                        <th>Rôle</th>
                        <th>Statut</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map(u => {
                        const isSelf = u.id === user?.id;
                        const isProtected = String(u.role || '').toLowerCase().replace('-', '_') === 'super_admin' && !isSelf;
                        return (
                          <tr key={u.id}>
                            <td>
                              <div className="flex items-center gap-2">
                                <div className="avatar w-8 h-8 bg-accent-primary text-white text-xs font-bold flex items-center justify-center rounded-full">
                                  {(u.fullName || u.email || '?').charAt(0).toUpperCase()}
                                </div>
                                <p className="font-semibold text-text-primary text-sm">{u.fullName || '—'}</p>
                              </div>
                            </td>
                            <td>
                              <p className="text-text-secondary text-xs">{u.email}</p>
                            </td>
                            <td>
                              <p className="text-text-secondary text-xs">{u.phone || '—'}</p>
                            </td>
                            <td>
                              <span className="px-2 py-1 rounded text-[10px] font-bold uppercase bg-background-secondary text-text-secondary">
                                {roleLabel(u.role)}
                              </span>
                            </td>
                            <td>
                              <StatusBadge status={u.isActive ? 'active' : 'inactive'} statusConfig={{
                                active: { label: 'Actif', color: 'success', dot: '#22C55E' },
                                inactive: { label: 'Banni', color: 'gray', dot: '#A09890' },
                              }} />
                            </td>
                            <td>
                              <div className="flex items-center gap-2">
                                <select
                                  className="input-field !py-1.5 !text-xs"
                                  value={u.role}
                                  disabled={usersBusy === u.id || isSelf || isProtected}
                                  onChange={(e) => handleChangeUserRole(u.id, e.target.value)}
                                >
                                  {['client', 'business_admin', 'driver', 'support', 'admin', 'super_admin'].map(r => (
                                    <option key={r} value={r}>{roleLabel(r)}</option>
                                  ))}
                                </select>
                                <button
                                  onClick={() => handleToggleUserStatus(u.id, !u.isActive)}
                                  disabled={usersBusy === u.id || isSelf || isProtected}
                                  className={`btn-icon disabled:opacity-40 disabled:cursor-not-allowed ${u.isActive ? 'text-status-error hover:bg-status-errorBg' : 'text-status-success hover:bg-status-successBg'}`}
                                  title={
                                    isSelf
                                      ? 'Impossible sur votre propre compte'
                                      : isProtected
                                        ? 'Super Admin protégé'
                                        : u.isActive
                                          ? 'Bannir le compte'
                                          : 'Réactiver le compte'
                                  }
                                >
                                  <Ban size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
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

      {/* ─── MODAL CRÉER UN COMPTE ───────────────────────────────── */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowUserModal(false)}>
          <div className="card w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-text-primary flex items-center gap-2">
                <KeyRound size={16} className="text-accent-primary" /> Créer un compte
              </h3>
              <button onClick={() => setShowUserModal(false)} className="btn-icon text-text-secondary hover:bg-background-secondary">
                <XCircle size={18} />
              </button>
            </div>

            {usersMsg && (
              <div className={`p-3 mb-4 rounded-lg border text-sm ${usersMsg.type === 'success' ? 'bg-status-successBg border-status-success/30 text-status-success' : 'bg-status-errorBg border-status-error/30 text-status-error'}`}>
                {usersMsg.text}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase mb-1">Nom complet</label>
                <input
                  className="input-field"
                  placeholder="Ex : Awa Diallo"
                  value={userForm.fullName}
                  onChange={(e) => setUserForm(prev => ({ ...prev, fullName: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary uppercase mb-1">Email</label>
                  <input
                    className="input-field"
                    type="email"
                    placeholder="awa@fasofree.bf"
                    value={userForm.email}
                    onChange={(e) => setUserForm(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary uppercase mb-1">Téléphone</label>
                  <input
                    className="input-field"
                    placeholder="+22670000000"
                    value={userForm.phone}
                    onChange={(e) => setUserForm(prev => ({ ...prev, phone: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase mb-1">Mot de passe (min. 8 caractères)</label>
                <input
                  className="input-field"
                  type="password"
                  placeholder="MotDePasseFort123!"
                  value={userForm.password}
                  onChange={(e) => setUserForm(prev => ({ ...prev, password: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase mb-1">Rôle</label>
                <select
                  className="input-field"
                  value={userForm.role}
                  onChange={(e) => setUserForm(prev => ({ ...prev, role: e.target.value }))}
                >
                  <option value="admin">Admin</option>
                  <option value="support">Support</option>
                  <option value="business_admin">Responsable Commerce</option>
                  <option value="driver">Livreur</option>
                  <option value="client">Client</option>
                  <option value="super_admin">Super Admin</option>
                </select>
                <p className="text-[11px] text-text-secondary mt-1">
                  Les comptes Admin / Support / Super Admin ne peuvent être créés qu'ici.
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <button onClick={() => setShowUserModal(false)} className="btn-secondary">
                  Annuler
                </button>
                <button
                  onClick={handleCreateUserSubmit}
                  disabled={!userForm.fullName.trim() || !userForm.email.trim() || !userForm.phone.trim() || userForm.password.length < 8 || createUserBusy}
                  className="btn-primary disabled:opacity-50"
                >
                  {createUserBusy ? 'Création…' : 'Créer le compte'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL FORFAIT ─────────────────────────────────────── */}
      {showPlanModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowPlanModal(false)}>
          <div className="card w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-text-primary">
                {editingPlan ? `Modifier le forfait ${editingPlan.code}` : 'Créer un forfait'}
              </h3>
              <button onClick={() => setShowPlanModal(false)} className="btn-icon text-text-secondary hover:bg-background-secondary">
                <XCircle size={18} />
              </button>
            </div>

            {subError && (
              <div className="p-3 mb-4 rounded-lg bg-status-errorBg border border-status-error/30 text-status-error text-sm">
                {subError}
              </div>
            )}

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary uppercase mb-1">Code</label>
                  <input
                    className="input-field"
                    value={planForm.code}
                    disabled={!!editingPlan}
                    placeholder="VIP"
                    onChange={(e) => setPlanForm(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary uppercase mb-1">Nom</label>
                  <input
                    className="input-field"
                    value={planForm.name}
                    placeholder="FasoFree Pass VIP"
                    onChange={(e) => setPlanForm(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase mb-1">Description</label>
                <textarea
                  className="input-field"
                  rows={2}
                  value={planForm.description}
                  onChange={(e) => setPlanForm(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary uppercase mb-1">Type de sujet</label>
                  <select
                    className="input-field"
                    value={planForm.subjectType}
                    disabled={!!editingPlan}
                    onChange={(e) => setPlanForm(prev => ({ ...prev, subjectType: e.target.value }))}
                  >
                    <option value="MERCHANT">Commerçant</option>
                    <option value="CUSTOMER">Client</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary uppercase mb-1">Prix (FCFA)</label>
                  <input
                    type="number"
                    min="0"
                    className="input-field"
                    value={planForm.priceFcfa}
                    onChange={(e) => setPlanForm(prev => ({ ...prev, priceFcfa: e.target.value }))}
                  />
                  {planForm.subjectType === 'MERCHANT' && (
                    <p className="text-[11px] text-text-secondary mt-1">
                      Forfait marchand payant : minimum{' '}
                      <span className="font-semibold text-accent-primary">5 000 FCFA</span> (Starter gratuit : 0 FCFA).
                      Aucune limite haute.
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary uppercase mb-1">Durée (jours)</label>
                  <input
                    type="number"
                    className="input-field"
                    value={planForm.durationDays}
                    onChange={(e) => setPlanForm(prev => ({ ...prev, durationDays: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary uppercase mb-1">
                    Commission (% — min 1,5 %)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    className="input-field"
                    value={planForm.commissionRate === null ? '' : Number(planForm.commissionRate) * 100}
                    onChange={(e) => {
                      const v = e.target.value;
                      setPlanForm(prev => ({
                        ...prev,
                        commissionRate: v === '' ? null : Number(v) / 100,
                      }));
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <label className="flex items-center gap-2 p-3 bg-background-secondary rounded-md text-sm text-text-secondary">
                  <input
                    type="checkbox"
                    checked={planForm.freeServiceFee}
                    onChange={(e) => setPlanForm(prev => ({ ...prev, freeServiceFee: e.target.checked }))}
                  />
                  Frais 100 FCFA offerts
                </label>
                <label className="flex items-center gap-2 p-3 bg-background-secondary rounded-md text-sm text-text-secondary">
                  <input
                    type="checkbox"
                    checked={planForm.freeDelivery}
                    onChange={(e) => setPlanForm(prev => ({ ...prev, freeDelivery: e.target.checked }))}
                  />
                  Livraison offerte
                </label>
                <label className="flex items-center gap-2 p-3 bg-background-secondary rounded-md text-sm text-text-secondary">
                  <input
                    type="checkbox"
                    checked={planForm.isActive}
                    onChange={(e) => setPlanForm(prev => ({ ...prev, isActive: e.target.checked }))}
                  />
                  Actif
                </label>
              </div>

              <div className="flex justify-end gap-2">
                <button onClick={() => setShowPlanModal(false)} className="btn-secondary">
                  Annuler
                </button>
                <button
                  onClick={handleSavePlan}
                  disabled={!planForm.code || !planForm.name}
                  className="btn-primary disabled:opacity-50"
                >
                  {editingPlan ? 'Enregistrer' : 'Créer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminDashboard;