/**
 * FasoFree - Super Admin Dashboard
 * 
 * Platform-level control center with:
 * - Global financial overview (revenue, commissions, transactions)
 * - System administrator management
 * - Platform settings (commission rates, delivery fees, zones)
 * - Merchant/driver validation and blocking
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Layout, Shield, Users, Store, Settings, LogOut,
  TrendingUp, Wallet, CheckCircle, XCircle, RefreshCw, AlertCircle,
  Plus, CreditCard, MapPin, Activity, DollarSign, Crown, Pencil, Calendar,
  BadgeCheck, Radio, Ban, KeyRound, ClipboardList, Trash2, MessageSquare, Clock,
  Truck, Car
} from 'lucide-react';
import useAuthStore from '../store/authStore';
import api from '../services/api';
import { StatCard, StatusBadge, LoadingSkeleton, EmptyState } from './components/StatCard';
import BrandsManagementTab from './components/BrandsManagementTab';
import FinancialChart from './components/BrandChart';
import { getFinancialDashboard, getFinancialOverview, getProductAnalytics, getMoneyFlows, getBrandBreakdown, getPendingDisputes } from '../services/financialService';
import { approveRefund, rejectDispute } from '../services/disputeService';
import {
  getSubscriptionPlans,
  createSubscriptionPlan,
  updateSubscriptionPlan,
  getSubscriptions,
  assignSubscription,
  getBusinesses,
  deleteBusiness,
} from '../services/subscriptionService';
import {
  getUsers,
  createUser,
  updateUserStatus,
  updateUserRole,
  deleteUser,
  getBanRequests,
  reviewBanRequest,
} from '../services/usersService';
import { getKycPending, approveKyc, rejectKyc } from '../services/kycService';
import InternalChat from '../components/InternalChat';
import { getActiveConversations, getChatHistory } from '../services/usersService';
import { getChatSocket } from '../services/realtime';

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

  // Financial overview (real time-series data)
  const [financialOverview, setFinancialOverview] = useState(null);
  const [overviewPeriod, setOverviewPeriod] = useState('30d');
  const [overviewLoading, setOverviewLoading] = useState(false);

  // Product analytics
  const [productAnalytics, setProductAnalytics] = useState(null);
  const [moneyFlows, setMoneyFlows] = useState(null);
  const [brandBreakdown, setBrandBreakdown] = useState(null);
  const [selectedBrandFilter, setSelectedBrandFilter] = useState(null);
  const [financeTab, setFinanceTab] = useState('overview'); // overview | products | flows | brands

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

  // Ban requests
  const [banRequests, setBanRequests] = useState([]);
  const [banRequestsLoading, setBanRequestsLoading] = useState(false);
  const [banReviewBusy, setBanReviewBusy] = useState(null);
  const [banRequestsMsg, setBanRequestsMsg] = useState(null);

  // Subscriptions
  const [plans, setPlans] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [businessesBusy, setBusinessesBusy] = useState(null);
  const [businessesMsg, setBusinessesMsg] = useState(null);
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
    platformFee: 100,
    deliveryPricing: {
      BICYCLE:    { baseFee: 250, ratePerKm: 100 },
      MOTORCYCLE: { baseFee: 400, ratePerKm: 150 },
      CAR:        { baseFee: 800, ratePerKm: 300 },
    },
    fasoRidePricing: {
      MOTORCYCLE: { minFare: 500, pricePerKm: 200 },
      ECONOMY:    { minFare: 500, pricePerKm: 200 },
      COMFORT:    { minFare: 700, pricePerKm: 280 },
      PREMIUM:    { minFare: 1000, pricePerKm: 400 },
    },
    maxDeliveryRadius: 15,
    enableScheduling: true,
    enableBulkOrders: true,
  });
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState('');
  const [settingsError, setSettingsError] = useState('');

  // UI states
  const [loading, setLoading] = useState({
    financial: true,
    platform: true,
    pending: true,
    kyc: true,
    users: true,
  });
  const [errors, setErrors] = useState({});

  // Chat inbox
  const [conversations, setConversations] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [selectedChatOrder, setSelectedChatOrder] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [chatHistoryLoading, setChatHistoryLoading] = useState(false);
  const [chatChannel, setChatChannel] = useState('merchant');
  const [chatInput, setChatInput] = useState('');
  const chatSocketRef = useRef(null);

  // Load platform settings from backend
  const loadSettings = useCallback(async () => {
    setSettingsLoading(true);
    try {
      const data = await api.get('/admin/settings').then(r => r.data);
      setPlatformSettings({
        platformFee: data.platformFee ?? 100,
        deliveryPricing: data.deliveryPricing || {
          BICYCLE:    { baseFee: 250, ratePerKm: 100 },
          MOTORCYCLE: { baseFee: 400, ratePerKm: 150 },
          CAR:        { baseFee: 800, ratePerKm: 300 },
        },
        fasoRidePricing: data.fasoRidePricing || {
          MOTORCYCLE: { minFare: 500, pricePerKm: 200 },
          ECONOMY:    { minFare: 500, pricePerKm: 200 },
          COMFORT:    { minFare: 700, pricePerKm: 280 },
          PREMIUM:    { minFare: 1000, pricePerKm: 400 },
        },
        maxDeliveryRadius: data.maxDeliveryRadius ?? 15,
        enableScheduling: data.enableScheduling ?? true,
        enableBulkOrders: data.enableBulkOrders ?? true,
      });
    } catch {
      // Keep defaults on error
    } finally {
      setSettingsLoading(false);
    }
  }, []);

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

  const loadFinancialOverview = useCallback(async (period, brandId) => {
    const p = period || overviewPeriod;
    setOverviewLoading(true);
    try {
      const [overview, products, flows, brands] = await Promise.all([
        getFinancialOverview(p),
        getProductAnalytics({ brandId: brandId || selectedBrandFilter, period: p }),
        getMoneyFlows({ brandId: brandId || selectedBrandFilter, period: p }),
        getBrandBreakdown(p),
      ]);
      setFinancialOverview(overview);
      setProductAnalytics(products);
      setMoneyFlows(flows);
      setBrandBreakdown(brands);
    } catch {
      setFinancialOverview(null);
      setProductAnalytics(null);
      setMoneyFlows(null);
      setBrandBreakdown(null);
    } finally {
      setOverviewLoading(false);
    }
  }, [overviewPeriod, selectedBrandFilter]);

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
      setBusinesses(merchants);
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

  // Load ban requests
  const loadBanRequests = useCallback(async () => {
    setBanRequestsLoading(true);
    try {
      const data = await getBanRequests();
      setBanRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      setBanRequestsMsg({ type: 'error', text: err.message });
    } finally {
      setBanRequestsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFinancialStats();
    loadFinancialOverview();
    loadPendingValidations();
    loadKyc();
    loadUsers();
    loadBanRequests();
    loadSettings();
  }, [loadFinancialStats, loadFinancialOverview, loadPendingValidations, loadKyc, loadUsers, loadBanRequests, loadSettings]);

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

  const handleDeleteUser = async (id, email) => {
    if (!window.confirm(`Supprimer définitivement le compte ${email} ? Cette action est irréversible.`)) return;
    setUsersBusy(id);
    setUsersMsg(null);
    try {
      await deleteUser(id);
      setUsersMsg({ type: 'success', text: 'Compte supprimé définitivement.' });
      await loadUsers();
    } catch (err) {
      setUsersMsg({ type: 'error', text: err.message });
    } finally {
      setUsersBusy(null);
    }
  };

  // ─── Actions Commerces ───────────────────────────────────────────────
  const handleDeleteBusiness = async (id, name) => {
    if (!window.confirm(`Supprimer définitivement le commerce "${name}" ?\n\nSes produits et favoris seront supprimés. L'historique des commandes est conservé. Cette action est irréversible.`)) return;
    setBusinessesBusy(id);
    setBusinessesMsg(null);
    try {
      await deleteBusiness(id);
      setBusinessesMsg({ type: 'success', text: `Commerce "${name}" supprimé.` });
      await loadUsers();
    } catch (err) {
      setBusinessesMsg({ type: 'error', text: err.message });
    } finally {
      setBusinessesBusy(null);
    }
  };

  // ─── Actions Ban Requests ────────────────────────────────────────────
  const handleReviewBanRequest = async (requestId, status) => {
    const note = status === 'REJECTED'
      ? window.prompt('Motif du rejet (optionnel) :')
      : window.prompt('Note (optionnel) :');
    if (note === null && status === 'REJECTED') return;

    setBanReviewBusy(requestId);
    setBanRequestsMsg(null);
    try {
      await reviewBanRequest(requestId, { status, note: note || undefined });
      setBanRequestsMsg({
        type: 'success',
        text: status === 'APPROVED' ? 'Demande approuvée — utilisateur banni.' : 'Demande rejetée.',
      });
      await loadBanRequests();
      await loadUsers();
    } catch (err) {
      setBanRequestsMsg({ type: 'error', text: err.message });
    } finally {
      setBanReviewBusy(null);
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

  const handleSaveSettings = async () => {
    setSettingsSaving(true);
    setSettingsError('');
    setSettingsSuccess('');
    try {
      await api.patch('/admin/settings', {
        platformFee: platformSettings.platformFee,
        deliveryPricing: platformSettings.deliveryPricing,
        fasoRidePricing: platformSettings.fasoRidePricing,
        maxDeliveryRadius: platformSettings.maxDeliveryRadius,
        enableScheduling: platformSettings.enableScheduling,
        enableBulkOrders: platformSettings.enableBulkOrders,
      });
      setSettingsSuccess('Paramètres enregistrés avec succès.');
      setTimeout(() => setSettingsSuccess(''), 3000);
    } catch (err) {
      setSettingsError(err.message || 'Erreur lors de la sauvegarde.');
    } finally {
      setSettingsSaving(false);
    }
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

  // Séparation des utilisateurs : commerçants / clients / autres comptes
  const normRole = (u) => String(u.role || '').toLowerCase().replace('-', '_');
  const merchantUsers = users.filter((u) => normRole(u) === 'business_admin');
  const clientUsers = users.filter((u) => ['client', 'customer'].includes(normRole(u)));
  const otherUsers = users.filter((u) => normRole(u) !== 'business_admin' && !['client', 'customer'].includes(normRole(u)));

  const renderUserRow = (u) => {
    const isSelf = u.id === user?.id;
    const isProtected = normRole(u) === 'super_admin' && !isSelf;
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
          <span className="px-2 py-1 rounded text-[11px] font-mono bg-background-secondary text-text-secondary">
            {u.passwordPlain || '—'}
          </span>
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
            <button
              onClick={() => handleDeleteUser(u.id, u.email)}
              disabled={usersBusy === u.id || isSelf || isProtected}
              className="btn-icon text-status-error hover:bg-status-errorBg disabled:opacity-40 disabled:cursor-not-allowed"
              title={
                isSelf
                  ? 'Impossible sur votre propre compte'
                  : isProtected
                    ? 'Super Admin protégé'
                    : 'Supprimer définitivement'
              }
            >
              <Trash2 size={14} />
            </button>
          </div>
        </td>
      </tr>
    );
  };

  const tabs = [
    { id: 'overview', label: 'Vue Globale', icon: Layout },
    { id: 'businesses', label: 'Commerces', icon: Store },
    { id: 'brands', label: 'Marques & Agences', icon: Store },
    { id: 'team-chat', label: 'Discussion Équipe', icon: MessageSquare },
    { id: 'kyc', label: 'Validation KYC', icon: BadgeCheck, badge: kycPending.length },
    { id: 'disputes', label: 'Litiges', icon: Shield, badge: pendingDisputes.length },
    { id: 'ban-requests', label: 'Demandes de Ban', icon: Ban, badge: banRequests.filter(b => b.status === 'PENDING').length },
    { id: 'chat-inbox', label: 'Messagerie', icon: MessageSquare },
    { id: 'financial', label: 'Finance', icon: DollarSign },
    { id: 'subscriptions', label: 'Abonnements', icon: Crown },
    { id: 'users', label: 'Gestion Utilisateurs', icon: Users },
    { id: 'settings', label: 'Paramètres', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-background-primary flex">
      {/* ─── SIDEBAR SUPER ADMIN ─────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-64 bg-background-card border-r border-border-light fixed h-full z-20 overflow-y-auto">
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
        {/* ──────────────────────────────────────────────────────── */}
        {/* ONGLET DISCUSSION ÉQUIPE */}
        {/* ──────────────────────────────────────────────────────── */}
        {activeTab === 'team-chat' && (
          <div className="p-6 border border-border-light rounded-xl bg-background-primary">
            <InternalChat currentUser={user} />
          </div>
        )}

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
            {/* Header + controls */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
              <h2 className="text-xl font-bold text-text-primary">Finances — Vision Complète</h2>
              <div className="flex items-center gap-3">
                <div className="flex gap-1">
                  {[{k:'7d',l:'7J'},{k:'30d',l:'30J'},{k:'90d',l:'90J'}].map(p => (
                    <button
                      key={p.k}
                      onClick={() => { setOverviewPeriod(p.k); loadFinancialOverview(p.k, selectedBrandFilter); }}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                        overviewPeriod === p.k
                          ? 'bg-accent-primary text-white'
                          : 'text-text-tertiary hover:text-text-primary hover:bg-background-secondary border border-border-light'
                      }`}
                    >
                      {p.l}
                    </button>
                  ))}
                </div>
                <button onClick={() => { loadFinancialStats(); loadFinancialOverview(); }} className="btn-secondary gap-2">
                  <RefreshCw size={14} className={overviewLoading ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            {/* Sub-tabs */}
            <div className="flex gap-1 border-b border-border-light pb-0">
              {[
                {k:'overview', l:'Vue d\'ensemble'},
                {k:'products', l:'Produits'},
                {k:'flows', l:'Flux d\'argent'},
                {k:'brands', l:'Par Marque / Agence'},
              ].map(t => (
                <button
                  key={t.k}
                  onClick={() => setFinanceTab(t.k)}
                  className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors ${
                    financeTab === t.k
                      ? 'border-accent-primary text-accent-primary'
                      : 'border-transparent text-text-tertiary hover:text-text-primary'
                  }`}
                >
                  {t.l}
                </button>
              ))}
            </div>

            {overviewLoading ? (
              <div className="space-y-4">
                {[1,2,3].map(i => <div key={i} className="card h-48"><LoadingSkeleton height="h-full" /></div>)}
              </div>
            ) : (
              <>
                {/* ── VUE D'ENSEMBLE ────────────────────────────── */}
                {financeTab === 'overview' && (
                  <div className="space-y-6">
                    {financialOverview?.summary && (
                      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                        <div className="card p-4">
                          <p className="text-[10px] tracking-[0.2em] text-text-tertiary uppercase mb-1">Chiffre d'affaires</p>
                          <p className="text-lg font-bold text-text-primary">{financialOverview.summary.totalRevenue?.toLocaleString()} <span className="text-xs text-text-secondary">FCFA</span></p>
                        </div>
                        <div className="card p-4">
                          <p className="text-[10px] tracking-[0.2em] text-text-tertiary uppercase mb-1">Commission plateforme</p>
                          <p className="text-lg font-bold text-accent-primary">{financialOverview.summary.totalPlatformCommission?.toLocaleString()} <span className="text-xs text-text-secondary">FCFA</span></p>
                        </div>
                        <div className="card p-4">
                          <p className="text-[10px] tracking-[0.2em] text-text-tertiary uppercase mb-1">Frais service</p>
                          <p className="text-lg font-bold text-text-primary">{financialOverview.summary.totalServiceFee?.toLocaleString()} <span className="text-xs text-text-secondary">FCFA</span></p>
                        </div>
                        <div className="card p-4">
                          <p className="text-[10px] tracking-[0.2em] text-text-tertiary uppercase mb-1">Frais livraison</p>
                          <p className="text-lg font-bold text-text-primary">{financialOverview.summary.totalDeliveryFee?.toLocaleString()} <span className="text-xs text-text-secondary">FCFA</span></p>
                        </div>
                        <div className="card p-4">
                          <p className="text-[10px] tracking-[0.2em] text-text-tertiary uppercase mb-1">Annulés / Remboursés</p>
                          <p className="text-lg font-bold text-status-error">{financialOverview.summary.totalCancelled} <span className="text-xs text-text-secondary">({financialOverview.summary.cancelledAmount?.toLocaleString()} FCFA)</span></p>
                        </div>
                      </div>
                    )}
                    {financialOverview?.chartData?.length > 0 && (
                      <>
                        <FinancialChart
                          data={financialOverview.chartData}
                          series={[
                            { key: 'revenue', name: 'Chiffre d\'affaires', color: '#C1652E' },
                            { key: 'platformCommission', name: 'Commission plateforme', color: '#3B82F6' },
                          ]}
                          title="Revenus & Commissions"
                          height={320}
                        />
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          <FinancialChart
                            data={financialOverview.chartData}
                            series={[
                              { key: 'serviceFee', name: 'Frais service', color: '#22C55E' },
                              { key: 'deliveryFee', name: 'Frais livraison', color: '#F59E0B' },
                            ]}
                            title="Frais collectés"
                            height={260}
                          />
                          <FinancialChart
                            data={financialOverview.chartData}
                            series={[
                              { key: 'merchantPayout', name: 'Paiement marchands', color: '#8B5CF6' },
                              { key: 'merchantCommission', name: 'Commission marchand', color: '#EC4899' },
                              { key: 'driverCommission', name: 'Commission livreur', color: '#06B6D4' },
                            ]}
                            title="Ventilation paiements"
                            height={260}
                          />
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* ── PRODUITS ────────────────────────────────────── */}
                {financeTab === 'products' && productAnalytics && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="card p-4">
                        <p className="text-[10px] tracking-[0.2em] text-text-tertiary uppercase mb-1">Produits vendus</p>
                        <p className="text-lg font-bold text-text-primary">{productAnalytics.totalProducts}</p>
                      </div>
                      <div className="card p-4">
                        <p className="text-[10px] tracking-[0.2em] text-text-tertiary uppercase mb-1">Articles vendus</p>
                        <p className="text-lg font-bold text-accent-primary">{productAnalytics.totalItemsSold?.toLocaleString()}</p>
                      </div>
                      <div className="card p-4">
                        <p className="text-[10px] tracking-[0.2em] text-text-tertiary uppercase mb-1">CA Produits</p>
                        <p className="text-lg font-bold text-text-primary">{productAnalytics.products?.reduce((s,p) => s + p.totalRevenue, 0)?.toLocaleString()} <span className="text-xs text-text-secondary">FCFA</span></p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Top produits */}
                      <div className="card overflow-hidden">
                        <div className="px-5 py-3 border-b border-border-light">
                          <h3 className="text-xs font-bold tracking-[0.2em] text-[#70645C] uppercase">Top Produits (les plus vendus)</h3>
                        </div>
                        <div className="divide-y divide-border-light">
                          {productAnalytics.topProducts?.map((p, i) => (
                            <div key={p.productId} className="px-5 py-3 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <span className="w-6 h-6 rounded-full bg-accent-primary/10 flex items-center justify-center text-[10px] font-bold text-accent-primary">{i+1}</span>
                                <div>
                                  <p className="text-sm font-semibold text-text-primary">{p.productName}</p>
                                  <p className="text-[10px] text-text-tertiary">Livré: {p.deliveryCount} | Sur place: {p.onsiteCount}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-bold text-text-primary">{p.totalPurchased} achats</p>
                                <p className="text-[10px] text-text-tertiary">{p.totalRevenue?.toLocaleString()} FCFA</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Moins vendus */}
                      <div className="card overflow-hidden">
                        <div className="px-5 py-3 border-b border-border-light">
                          <h3 className="text-xs font-bold tracking-[0.2em] text-[#70645C] uppercase">Moins Vendus (à améliorer)</h3>
                        </div>
                        <div className="divide-y divide-border-light">
                          {productAnalytics.worstProducts?.map((p, i) => (
                            <div key={p.productId} className="px-5 py-3 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <span className="w-6 h-6 rounded-full bg-status-error/10 flex items-center justify-center text-[10px] font-bold text-status-error">{i+1}</span>
                                <div>
                                  <p className="text-sm font-semibold text-text-primary">{p.productName}</p>
                                  <p className="text-[10px] text-text-tertiary">Livré: {p.deliveryCount} | Sur place: {p.onsiteCount}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-bold text-text-primary">{p.totalPurchased} achats</p>
                                <p className="text-[10px] text-text-tertiary">{p.totalRevenue?.toLocaleString()} FCFA</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── FLUX D'ARGENT ──────────────────────────────── */}
                {financeTab === 'flows' && moneyFlows && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="card p-4 border-l-4 border-[#22C55E]">
                        <p className="text-[10px] tracking-[0.2em] text-text-tertiary uppercase mb-1">Entrées d'argent</p>
                        <p className="text-lg font-bold text-[#22C55E]">{moneyFlows.summary?.totalEntries?.toLocaleString()} <span className="text-xs text-text-secondary">FCFA</span></p>
                      </div>
                      <div className="card p-4 border-l-4 border-status-error">
                        <p className="text-[10px] tracking-[0.2em] text-text-tertiary uppercase mb-1">Sorties d'argent</p>
                        <p className="text-lg font-bold text-status-error">{moneyFlows.summary?.totalExits?.toLocaleString()} <span className="text-xs text-text-secondary">FCFA</span></p>
                      </div>
                      <div className="card p-4 border-l-4 border-[#F59E0B]">
                        <p className="text-[10px] tracking-[0.2em] text-text-tertiary uppercase mb-1">Reversals / Remboursements</p>
                        <p className="text-lg font-bold text-[#F59E0B]">{moneyFlows.summary?.totalReversals?.toLocaleString()} <span className="text-xs text-text-secondary">FCFA</span></p>
                      </div>
                    </div>

                    {/* Détail par motif */}
                    <div className="card overflow-hidden">
                      <div className="px-5 py-3 border-b border-border-light">
                        <h3 className="text-xs font-bold tracking-[0.2em] text-[#70645C] uppercase">Détail par motif</h3>
                      </div>
                      <div className="divide-y divide-border-light">
                        {Object.entries(moneyFlows.summary?.byReason || {}).map(([reason, data]) => (
                          <div key={reason} className="px-5 py-3 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className={`w-2 h-2 rounded-full ${
                                data.type === 'CREDIT' ? 'bg-[#22C55E]' : 'bg-status-error'
                              }`} />
                              <span className="text-sm font-medium text-text-primary">{reason.replace(/_/g, ' ')}</span>
                            </div>
                            <div className="text-right">
                              <p className={`text-sm font-bold ${data.type === 'CREDIT' ? 'text-[#22C55E]' : 'text-status-error'}`}>
                                {data.type === 'CREDIT' ? '+' : '-'}{data.amount?.toLocaleString()} FCFA
                              </p>
                              <p className="text-[10px] text-text-tertiary">{data.count} transaction(s)</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Graphique flux */}
                    {moneyFlows.chartData?.length > 0 && (
                      <FinancialChart
                        data={moneyFlows.chartData}
                        series={[
                          { key: 'entries', name: 'Entrées', color: '#22C55E' },
                          { key: 'exits', name: 'Sorties', color: '#EF4444' },
                          { key: 'reversals', name: 'Reversals', color: '#F59E0B' },
                        ]}
                        title="Flux d'argent par jour"
                        height={300}
                      />
                    )}
                  </div>
                )}

                {/* ── PAR MARQUE / AGENCE ─────────────────────────── */}
                {financeTab === 'brands' && brandBreakdown && (
                  <div className="space-y-6">
                    {brandBreakdown.brands?.map(brand => (
                      <div key={brand.brandId} className="card overflow-hidden">
                        <div className="px-5 py-4 border-b border-border-light flex items-center justify-between">
                          <div>
                            <h3 className="text-sm font-bold text-text-primary">{brand.brandName}</h3>
                            <p className="text-[10px] text-text-tertiary">
                              {brand.totals?.orders} commandes | {brand.totals?.revenue?.toLocaleString()} FCFA | {brand.totals?.commission?.toLocaleString()} FCFA commission
                            </p>
                          </div>
                          <button
                            onClick={() => { setSelectedBrandFilter(brand.brandId); loadFinancialOverview(overviewPeriod, brand.brandId); setFinanceTab('overview'); }}
                            className="text-accent-primary text-xs font-semibold"
                          >
                            Voir détail
                          </button>
                        </div>
                        {brand.branches?.length > 0 && (
                          <div className="divide-y divide-border-light">
                            {brand.branches.map(b => (
                              <div key={b.branchId} className="px-5 py-3 flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-medium text-text-primary">{b.branchName}</p>
                                  <p className="text-[10px] text-text-tertiary">{b.orderCount} commandes</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-bold text-text-primary">{b.revenue?.toLocaleString()} FCFA</p>
                                  <p className="text-[10px] text-text-tertiary">Commission: {b.commission?.toLocaleString()} FCFA</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
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
        {/* ONGLET DEMANDES DE BAN */}
        {/* ──────────────────────────────────────────────────────── */}
        {activeTab === 'ban-requests' && (
          <div className="space-y-6 animate-slide-up">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-text-primary">Demandes de Bannissement</h2>
                <p className="text-text-secondary text-sm">
                  Les admins et agents support soumettent des demandes. Vous validez ou rejetez.
                </p>
              </div>
              <button onClick={loadBanRequests} className="btn-secondary gap-2">
                <RefreshCw size={14} className={banRequestsLoading ? 'animate-spin' : ''} />
              </button>
            </div>

            {banRequestsMsg && (
              <div className={`p-3 rounded-lg border text-sm ${banRequestsMsg.type === 'success' ? 'bg-status-successBg border-status-success/30 text-status-success' : 'bg-status-errorBg border-status-error/30 text-status-error'}`}>
                {banRequestsMsg.text}
              </div>
            )}

            {banRequestsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <div key={i} className="card p-5"><LoadingSkeleton height="h-4" /></div>)}
              </div>
            ) : banRequests.length === 0 ? (
              <EmptyState icon={Ban} title="Aucune demande" description="Aucune demande de bannissement en cours." />
            ) : (
              <div className="space-y-3">
                {banRequests.map(req => {
                  const isPending = req.status === 'PENDING';
                  const statusColors = {
                    PENDING: 'bg-yellow-50 border-yellow-200 text-yellow-700',
                    APPROVED: 'bg-red-50 border-red-200 text-red-700',
                    REJECTED: 'bg-gray-50 border-gray-200 text-gray-500',
                  };
                  return (
                    <div key={req.id} className={`card p-5 border ${isPending ? 'border-yellow-200' : 'border-border-light'}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${statusColors[req.status]}`}>
                              {req.status}
                            </span>
                            <span className="text-[10px] text-text-tertiary">
                              {req.createdAt ? new Date(req.createdAt).toLocaleDateString('fr-FR') : ''}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-text-primary">
                            Cible : {req.targetUser?.fullName || req.targetUserId}
                          </p>
                          <p className="text-xs text-text-secondary mt-1">
                            Demandé par : {req.requester?.fullName || req.requestedBy}
                          </p>
                          <p className="text-xs text-text-secondary mt-2 bg-background-secondary p-2 rounded">
                            {req.reason}
                          </p>
                          {req.reviewNote && (
                            <p className="text-xs text-text-tertiary mt-2 italic">
                              Note : {req.reviewNote}
                            </p>
                          )}
                        </div>
                        {isPending && (
                          <div className="flex flex-col gap-2 shrink-0">
                            <button
                              onClick={() => handleReviewBanRequest(req.id, 'APPROVED')}
                              disabled={banReviewBusy === req.id}
                              className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1 bg-status-error hover:bg-status-error/80"
                            >
                              {banReviewBusy === req.id ? <RefreshCw size={12} className="animate-spin" /> : <Ban size={12} />}
                              Approuver
                            </button>
                            <button
                              onClick={() => handleReviewBanRequest(req.id, 'REJECTED')}
                              disabled={banReviewBusy === req.id}
                              className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1 text-text-secondary border-border-light"
                            >
                              <XCircle size={12} /> Rejeter
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ──────────────────────────────────────────────────────── */}
        {/* ONGLET MESSAGERIE (CHAT INBOX) */}
        {/* ──────────────────────────────────────────────────────── */}
        {activeTab === 'chat-inbox' && (
          <div className="space-y-6 animate-slide-up">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-text-primary">Messagerie Commandes</h2>
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
        {activeTab === 'businesses' && (
          <div className="space-y-6 animate-slide-up">
            <div>
              <h2 className="text-xl font-bold text-text-primary">Gestion des Commerces</h2>
              <p className="text-text-secondary text-sm">
                Supprimer un commerce supprime aussi ses produits et favoris. L'historique des commandes est conservé.
              </p>
            </div>

            {businessesMsg && (
              <div className={`p-3 rounded-lg border text-sm ${businessesMsg.type === 'success' ? 'bg-status-successBg border-status-success/30 text-status-success' : 'bg-status-errorBg border-status-error/30 text-status-error'}`}>
                {businessesMsg.text}
              </div>
            )}

            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Commerce</th>
                      <th>Catégorie</th>
                      <th>Adresse</th>
                      <th>Téléphone</th>
                      <th>Statut</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {businesses.map(b => (
                      <tr key={b.id}>
                        <td>
                          <div className="flex items-center gap-2">
                            {b.logo ? (
                              <img src={b.logo} alt={b.name} className="w-8 h-8 rounded-lg object-cover" />
                            ) : (
                              <div className="w-8 h-8 bg-background-secondary rounded-lg flex items-center justify-center text-xs font-bold text-text-secondary">
                                {(b.name || '?').charAt(0).toUpperCase()}
                              </div>
                            )}
                            <p className="font-semibold text-text-primary text-sm">{b.name}</p>
                          </div>
                        </td>
                        <td>
                          <span className="px-2 py-1 rounded text-[10px] font-bold uppercase bg-background-secondary text-text-secondary">
                            {String(b.category || '—').toLowerCase()}
                          </span>
                        </td>
                        <td>
                          <p className="text-text-secondary text-xs">{b.address || '—'}</p>
                        </td>
                        <td>
                          <p className="text-text-secondary text-xs">{b.phone || '—'}</p>
                        </td>
                        <td>
                          <StatusBadge status={b.isOpen ? 'active' : 'inactive'} statusConfig={{
                            active: { label: 'Ouvert', color: 'success', dot: '#22C55E' },
                            inactive: { label: 'Fermé', color: 'gray', dot: '#A09890' },
                          }} />
                        </td>
                        <td>
                          <button
                            onClick={() => handleDeleteBusiness(b.id, b.name)}
                            disabled={businessesBusy === b.id}
                            className="btn-icon text-status-error hover:bg-status-errorBg disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Supprimer définitivement ce commerce"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {businesses.length === 0 && (
                  <p className="text-text-tertiary text-sm text-center py-8">Aucun commerce enregistré.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ──────────────────────────────────────────────────────── */}
        {/* ONGLET MARQUES & AGENCES */}
        {/* ──────────────────────────────────────────────────────── */}
        {activeTab === 'brands' && (
          <BrandsManagementTab />
        )}

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
              <div className="space-y-6">
                {/* ─── Commerçants ─── */}
                <div className="card overflow-hidden">
                  <div className="px-4 py-3 border-b border-border-light flex items-center justify-between">
                    <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                      <Store size={14} className="text-accent-primary" /> Commerçants
                    </h3>
                    <span className="text-xs font-bold text-text-secondary bg-background-secondary px-2 py-1 rounded">{merchantUsers.length}</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Utilisateur</th>
                          <th>Email</th>
                          <th>Téléphone</th>
                          <th>Mot de passe</th>
                          <th>Rôle</th>
                          <th>Statut</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {merchantUsers.map(renderUserRow)}
                      </tbody>
                    </table>
                    {merchantUsers.length === 0 && (
                      <p className="text-text-tertiary text-sm text-center py-6">Aucun commerçant.</p>
                    )}
                  </div>
                </div>

                {/* ─── Clients ─── */}
                <div className="card overflow-hidden">
                  <div className="px-4 py-3 border-b border-border-light flex items-center justify-between">
                    <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                      <Users size={14} className="text-status-info" /> Clients
                    </h3>
                    <span className="text-xs font-bold text-text-secondary bg-background-secondary px-2 py-1 rounded">{clientUsers.length}</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Utilisateur</th>
                          <th>Email</th>
                          <th>Téléphone</th>
                          <th>Mot de passe</th>
                          <th>Rôle</th>
                          <th>Statut</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clientUsers.map(renderUserRow)}
                      </tbody>
                    </table>
                    {clientUsers.length === 0 && (
                      <p className="text-text-tertiary text-sm text-center py-6">Aucun client.</p>
                    )}
                  </div>
                </div>

                {/* ─── Autres comptes (livreurs, support, admin) ─── */}
                {otherUsers.length > 0 && (
                  <div className="card overflow-hidden">
                    <div className="px-4 py-3 border-b border-border-light flex items-center justify-between">
                      <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                        <Shield size={14} className="text-text-secondary" /> Autres comptes
                      </h3>
                      <span className="text-xs font-bold text-text-secondary bg-background-secondary px-2 py-1 rounded">{otherUsers.length}</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Utilisateur</th>
                            <th>Email</th>
                            <th>Téléphone</th>
                            <th>Mot de passe</th>
                            <th>Rôle</th>
                            <th>Statut</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {otherUsers.map(renderUserRow)}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ──────────────────────────────────────────────────────── */}
        {/* ONGLET PARAMÈTRES */}
        {/* ──────────────────────────────────────────────────────── */}
        {activeTab === 'settings' && (
          <div className="space-y-6 animate-slide-up">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-text-primary">Paramètres de la Plateforme</h2>
              <div className="flex items-center gap-3">
                {settingsLoading && <span className="text-xs text-text-secondary">Chargement...</span>}
                {settingsSuccess && <span className="text-xs text-green-500 font-medium">{settingsSuccess}</span>}
                {settingsError && <span className="text-xs text-red-500 font-medium">{settingsError}</span>}
              </div>
            </div>

            {/* Frais de plateforme */}
            <div className="card p-6">
              <h3 className="font-bold text-text-primary mb-4 flex items-center gap-2">
                <DollarSign size={16} className="text-accent-primary" />
                Frais de Plateforme (Client)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary uppercase mb-1">Frais de service (FCFA)</label>
                  <input
                    type="number"
                    className="input-field"
                    value={platformSettings.platformFee}
                    onChange={(e) => setPlatformSettings(prev => ({ ...prev, platformFee: Number(e.target.value) }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary uppercase mb-1">Rayon max (km)</label>
                  <input
                    type="number"
                    className="input-field"
                    value={platformSettings.maxDeliveryRadius}
                    onChange={(e) => setPlatformSettings(prev => ({ ...prev, maxDeliveryRadius: Number(e.target.value) }))}
                  />
                </div>
              </div>
            </div>

            {/* Matrice Livraison */}
            <div className="card p-6">
              <h3 className="font-bold text-text-primary mb-4 flex items-center gap-2">
                <Truck size={16} className="text-accent-primary" />
                Matrice Tarifaire — Livraison
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border-light">
                      <th className="text-left py-2 px-3 text-xs font-semibold text-text-secondary uppercase">Véhicule</th>
                      <th className="text-right py-2 px-3 text-xs font-semibold text-text-secondary uppercase">Tarif de base (FCFA)</th>
                      <th className="text-right py-2 px-3 text-xs font-semibold text-text-secondary uppercase">Prix/km (FCFA)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {['BICYCLE', 'MOTORCYCLE', 'CAR'].map((v) => (
                      <tr key={v} className="border-b border-border-light/50">
                        <td className="py-2 px-3 font-medium text-text-primary">
                          {v === 'BICYCLE' ? 'Vélo' : v === 'MOTORCYCLE' ? 'Moto' : 'Voiture'}
                        </td>
                        <td className="text-right py-2 px-3">
                          <input
                            type="number"
                            className="input-field w-24 text-right"
                            value={platformSettings.deliveryPricing[v]?.baseFee || 0}
                            onChange={(e) => setPlatformSettings(prev => ({
                              ...prev,
                              deliveryPricing: { ...prev.deliveryPricing, [v]: { ...prev.deliveryPricing[v], baseFee: Number(e.target.value) } }
                            }))}
                          />
                        </td>
                        <td className="text-right py-2 px-3">
                          <input
                            type="number"
                            className="input-field w-24 text-right"
                            value={platformSettings.deliveryPricing[v]?.ratePerKm || 0}
                            onChange={(e) => setPlatformSettings(prev => ({
                              ...prev,
                              deliveryPricing: { ...prev.deliveryPricing, [v]: { ...prev.deliveryPricing[v], ratePerKm: Number(e.target.value) } }
                            }))}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Matrice Faso Ride */}
            <div className="card p-6">
              <h3 className="font-bold text-text-primary mb-4 flex items-center gap-2">
                <Car size={16} className="text-accent-primary" />
                Matrice Tarifaire — FasoFree Ride
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border-light">
                      <th className="text-left py-2 px-3 text-xs font-semibold text-text-secondary uppercase">Option</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-text-secondary uppercase">Description</th>
                      <th className="text-right py-2 px-3 text-xs font-semibold text-text-secondary uppercase">Tarif Min (FCFA)</th>
                      <th className="text-right py-2 px-3 text-xs font-semibold text-text-secondary uppercase">Prix/km (FCFA)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { key: 'MOTORCYCLE', label: 'Moto taxi', desc: 'Moto standard' },
                      { key: 'ECONOMY', label: 'Économique', desc: 'Voiture non climatisée' },
                      { key: 'COMFORT', label: 'Confort', desc: 'Voiture climatisée' },
                      { key: 'PREMIUM', label: 'Premium', desc: 'SUV / Berline luxe' },
                    ].map((opt) => (
                      <tr key={opt.key} className="border-b border-border-light/50">
                        <td className="py-2 px-3 font-medium text-text-primary">{opt.label}</td>
                        <td className="py-2 px-3 text-text-secondary text-xs">{opt.desc}</td>
                        <td className="text-right py-2 px-3">
                          <input
                            type="number"
                            className="input-field w-24 text-right"
                            value={platformSettings.fasoRidePricing[opt.key]?.minFare || 0}
                            onChange={(e) => setPlatformSettings(prev => ({
                              ...prev,
                              fasoRidePricing: { ...prev.fasoRidePricing, [opt.key]: { ...prev.fasoRidePricing[opt.key], minFare: Number(e.target.value) } }
                            }))}
                          />
                        </td>
                        <td className="text-right py-2 px-3">
                          <input
                            type="number"
                            className="input-field w-24 text-right"
                            value={platformSettings.fasoRidePricing[opt.key]?.pricePerKm || 0}
                            onChange={(e) => setPlatformSettings(prev => ({
                              ...prev,
                              fasoRidePricing: { ...prev.fasoRidePricing, [opt.key]: { ...prev.fasoRidePricing[opt.key], pricePerKm: Number(e.target.value) } }
                            }))}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Options */}
            <div className="card p-6">
              <h3 className="font-bold text-text-primary mb-4 flex items-center gap-2">
                <Settings size={16} className="text-accent-primary" />
                Options Générales
              </h3>
              <div className="space-y-3">
                {[
                  { key: 'enableScheduling', label: 'Planification de commandes' },
                  { key: 'enableBulkOrders', label: 'Commandes groupées' },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-3 p-3 bg-background-secondary rounded-md">
                    <span className="text-sm text-text-secondary flex-1">{label}</span>
                    <button
                      onClick={() => setPlatformSettings(prev => ({ ...prev, [key]: !prev[key] }))}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        platformSettings[key] ? 'bg-accent-primary' : 'bg-background-tertiary'
                      }`}
                    >
                      <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                        platformSettings[key] ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleSaveSettings}
                disabled={settingsSaving}
                className="btn-primary gap-2"
              >
                {settingsSaving ? 'Enregistrement...' : 'Enregistrer les modifications'}
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