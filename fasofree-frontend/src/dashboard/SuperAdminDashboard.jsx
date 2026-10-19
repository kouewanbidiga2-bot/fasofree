/**
 * FasoFree - Super Admin Dashboard
 * 
 * Platform-level control center with:
 * - Global financial overview (revenue, commissions, transactions)
 * - System administrator management
 * - Platform settings (commission rates, delivery fees, zones)
 * - Merchant/driver validation and blocking
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Layout, Shield, Users, Store, Settings,
  TrendingUp, Wallet, CheckCircle, XCircle, RefreshCw, AlertCircle,
  Plus, CreditCard, Activity, DollarSign, Crown, Pencil, Calendar,
  BadgeCheck, Radio, Ban, KeyRound, ClipboardList, Trash2, MessageSquare, Clock,
  Truck, Car, Eye, Building2, ScrollText, Megaphone, Send, Bell, BarChart2,
  Gavel, Link2, ExternalLink, ShoppingBag, Menu, Search
} from 'lucide-react';
import useAuthStore from '../store/authStore';
import api from '../services/api';
import { StatCard, StatusBadge, LoadingSkeleton, EmptyState } from './components/StatCard';
import BrandsManagementTab from './components/BrandsManagementTab';
import FinancialChart from './components/BrandChart';
import DisputesTab from './components/DisputesTab';
import TraceabilityTab from './TraceabilityTab';
import DeliveryQualityTab from './components/DeliveryQualityTab';
import WalletAdminCreditCard from './components/WalletAdminCreditCard';
import { getFinancialDashboard, getFinancialOverview, getProductAnalytics, getMoneyFlows, getBrandBreakdown, getPendingDisputes, getSystemHealth } from '../services/financialService';
import { getAgencies, createAgency, updateAgency } from '../services/agencyService';
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
  getBanRequestPendingCount,
  getPlatformStats,
} from '../services/usersService';
import { getKycPending, approveKyc, rejectKyc, getKycDocumentUrl } from '../services/kycService';
import { getAdminOrders } from '../services/ordersService';
import { pushCampaignService } from '../services/pushCampaignService';
import InternalChat from '../components/InternalChat';
import PWAInstallButton from '../components/PWAInstallButton';
import NotificationBell from '../components/NotificationBell';
import AppSidebar from './components/AppSidebar';
import PageHero from './components/PageHero';
import { getActiveConversations, getChatHistory } from '../services/usersService';
import { getChatSocket, getDispatchSocket } from '../services/realtime';

// Badges de statut de « Dernières commandes » (vue globale).
const ORDER_STATUS_CONFIG = {
  PENDING: { label: 'En attente', color: 'warning', dot: '#F59E0B' },
  PAID: { label: 'Payée', color: 'info', dot: '#3B82F6' },
  IN_PREPARATION: { label: 'Préparation', color: 'info', dot: '#3B82F6' },
  ACCEPTED: { label: 'Acceptée', color: 'info', dot: '#3B82F6' },
  IN_TRANSIT: { label: 'En route', color: 'warning', dot: '#F59E0B' },
  COMPLETED: { label: 'Terminée', color: 'success', dot: '#22C55E' },
  DELIVERED: { label: 'Livrée', color: 'success', dot: '#22C55E' },
  CANCELLED: { label: 'Annulée', color: 'gray', dot: '#A09890' },
};

// Widget « santé float » du hero : financialStats.floatHealth → libellé + point.
const FLOAT_HEALTH_META = {
  healthy: { label: 'Float sain', dot: '#22C55E' },
  warning: { label: 'Float attention', dot: '#F59E0B' },
  critical: { label: 'Float critique', dot: '#EF4444' },
  unknown: { label: 'Float inconnu', dot: '#9B9286' },
};

// Compteur live « Session active depuis » (HH:MM:SS) de la carte Santé du Système.
const formatSession = (s) =>
  [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map((n) => String(n).padStart(2, '0')).join(':');

const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  const user = useAuthStore(state => state.user);
  const logout = useAuthStore(state => state.logout);
  const [activeTab, setActiveTab] = useState('overview');

  // ── Sidebar : tiroir mobile + repli desktop (persisté) ──
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('ff-sidebar-collapsed') === '1'; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem('ff-sidebar-collapsed', sidebarCollapsed ? '1' : '0'); } catch { /* stockage indisponible */ }
  }, [sidebarCollapsed]);

  // ── Recherche globale (header) + compteur live de session ──
  const [globalQuery, setGlobalQuery] = useState('');
  const [sessionSeconds, setSessionSeconds] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSessionSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Métriques système réelles : latence mesurée sur /health + uptime du
  // process backend (un redéploiement le remet à zéro → « dernier démarrage »).
  const [apiLatency, setApiLatency] = useState(null);
  const [backendStartedAt, setBackendStartedAt] = useState(null);

  const userRole = String(user?.role || '').toLowerCase().replace('-', '_');
  const isSuperAdmin = ['super_admin', 'superadmin'].includes(userRole);

  // 🛡️ Garde-fou : rediriger si le rôle n'est pas autorisé
  if (user && !isSuperAdmin) {
    navigate('/unauthorized', { replace: true });
    return null;
  }

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

  // Aperçu « dernières commandes » de la vue globale (pas de poll : simple aperçu).
  const [recentOrders, setRecentOrders] = useState([]);

  // Product analytics
  const [productAnalytics, setProductAnalytics] = useState(null);
  const [moneyFlows, setMoneyFlows] = useState(null);
  const [brandBreakdown, setBrandBreakdown] = useState(null);
  const [selectedBrandFilter, setSelectedBrandFilter] = useState(null);
  const [financeTab, setFinanceTab] = useState('overview'); // overview | products | flows | brands

  // 🏢 Agences partenaires (Niveau 2 du dispatch)
  const [agencies, setAgencies] = useState([]);
  const [agenciesLoading, setAgenciesLoading] = useState(false);
  const [agencyForm, setAgencyForm] = useState({ name: '', phone: '', email: '', zones: '', commissionPct: 10, maxConcurrentDeliveries: 0 });
  const [agencyMsg, setAgencyMsg] = useState(null);

  // Platform stats
  const [platformStats, setPlatformStats] = useState({
    totalMerchants: 0,
    totalClients: 0,
    totalDrivers: 0,
    activeMerchants: 0,
    pendingMerchants: 0,
    suspendedAccounts: 0,
    bannedUsers: 0,
    onlineUsers: 0,
    totalUsers: 0,
  });

  // Pending validations
  const [pendingDisputes, setPendingDisputes] = useState([]);
  const [processingDisputes, setProcessingDisputes] = useState(new Set());

  // KYC validation queue (commerçants & livreurs)
  const [kycPending, setKycPending] = useState([]);
  const [kycBusy, setKycBusy] = useState(null);
  const [kycMsg, setKycMsg] = useState(null);
  const [kycPreview, setKycPreview] = useState(null);

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
  // Compteur dédié de demandes en attente (endpoint léger `/pending-count`).
  const [pendingBanCount, setPendingBanCount] = useState(null);

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

  // Push Campaigns
  const [pushCampaigns, setPushCampaigns] = useState([]);
  const [pushCampaignsLoading, setPushCampaignsLoading] = useState(false);
  const [pushCampaignsError, setPushCampaignsError] = useState(null);
  const [showCreateCampaignModal, setShowCreateCampaignModal] = useState(false);
  const [createCampaignForm, setCreateCampaignForm] = useState({
    title: '',
    body: '',
    target: 'ALL',
    scheduledAt: '',
  });
  const [createCampaignBusy, setCreateCampaignBusy] = useState(false);

  // Affiliate Global Stats
  const [affiliateGlobalStats, setAffiliateGlobalStats] = useState(null);
  const [affiliateLoading, setAffiliateLoading] = useState(false);
  const [affiliateError, setAffiliateError] = useState(null);

  // Platform settings
  const [platformSettings, setPlatformSettings] = useState({
    platformFee: 100,
    deliveryPricing: {
      BICYCLE:    { baseFee: 250, ratePerKm: 100 },
      MOTORCYCLE: { baseFee: 400, ratePerKm: 150 },
      CAR:        { baseFee: 800, ratePerKm: 300 },
    },
    deliveryTiers: [
      { minKm: 0,  maxKm: 15, price: 1750, label: '0-15 km' },
      { minKm: 16, maxKm: 20, price: 2250, label: '16-20 km' },
      { minKm: 21, maxKm: 25, price: 2750, label: '21-25 km' },
      { minKm: 26, maxKm: 30, price: 3250, label: '26-30 km' },
      { minKm: 31, maxKm: null, price: 3750, label: '31+ km' },
    ],
    fasoRidePricing: {
      MOTORCYCLE: { minFare: 500, pricePerKm: 200 },
      ECONOMY:    { minFare: 500, pricePerKm: 200 },
      COMFORT:    { minFare: 700, pricePerKm: 280 },
      PREMIUM:    { minFare: 1000, pricePerKm: 400 },
    },
    maxDeliveryRadius: 15,
    enableScheduling: true,
    enableBulkOrders: true,
    storiesPassEnabled: false,
    enabledBusinessCategories: [],
    // 💳 Tarifs des campagnes push auto-service (FCFA PAR ENVOI), par audience.
    // ALL_CLIENTS (toute la base) reste volontairement bien au-dessus des
    // audiences de proximité : c'est l'anti-spam économique.
    pushCampaignPricing: {
      OWN_CLIENTS: 100,
      OWN_DRIVERS: 100,
      ALL_CLIENTS: 2500,
    },
  });
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState('');
  const [settingsError, setSettingsError] = useState('');

  // 🎛️ Catalogue COMPLET des verticales de commerces (pour les interrupteurs)
  const [businessCategoryOptions, setBusinessCategoryOptions] = useState([]);

  // 🏷️ F-bis — taguage de masse des sous-catégories (niveau 2).
  // Un commerce sans `subCategory` reste invisible dans les filtres du
  // client : cet écran recense les manquants et permet de les traiter en
  // lot (5 verticales sur 6 résolubles automatiquement, le reste au choix).
  const [tagging, setTagging] = useState(null);
  const [taggingLoading, setTaggingLoading] = useState(false);
  const [tagSelection, setTagSelection] = useState([]);
  const [tagTarget, setTagTarget] = useState('');
  const [tagMsg, setTagMsg] = useState(null);
  const [tagBusy, setTagBusy] = useState(false);

  // UI states
  const [loading, setLoading] = useState({
    financial: true,
    platform: true,
    pending: true,
    kyc: true,
    users: true,
    pushCampaigns: true,
    affiliate: true,
  });
  const [errors, setErrors] = useState({});
  const setError = (key, msg) => setErrors(prev => ({ ...prev, [key]: msg }));
  const setLoad = (key, val) => setLoading(prev => ({ ...prev, [key]: val }));

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
        deliveryTiers: data.deliveryTiers || [
          { minKm: 0,  maxKm: 15, price: 1750, label: '0-15 km' },
          { minKm: 16, maxKm: 20, price: 2250, label: '16-20 km' },
          { minKm: 21, maxKm: 25, price: 2750, label: '21-25 km' },
          { minKm: 26, maxKm: 30, price: 3250, label: '26-30 km' },
          { minKm: 31, maxKm: null, price: 3750, label: '31+ km' },
        ],
        fasoRidePricing: data.fasoRidePricing || {
          MOTORCYCLE: { minFare: 500, pricePerKm: 200 },
          ECONOMY:    { minFare: 500, pricePerKm: 200 },
          COMFORT:    { minFare: 700, pricePerKm: 280 },
          PREMIUM:    { minFare: 1000, pricePerKm: 400 },
        },
        maxDeliveryRadius: data.maxDeliveryRadius ?? 15,
        enableScheduling: data.enableScheduling ?? true,
        enableBulkOrders: data.enableBulkOrders ?? true,
        storiesPassEnabled: data.storiesPassEnabled ?? false,
        enabledBusinessCategories: data.enabledBusinessCategories ?? [],
        pushCampaignPricing: {
          OWN_CLIENTS: data.pushCampaignPricing?.OWN_CLIENTS ?? 100,
          OWN_DRIVERS: data.pushCampaignPricing?.OWN_DRIVERS ?? 100,
          ALL_CLIENTS: data.pushCampaignPricing?.ALL_CLIENTS ?? 2500,
        },
      });
    } catch {
      // Keep defaults on error
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  // 🎛️ Catalogue complet des verticales + état actif réel.
  // On utilise l'endpoint admin (et non /businesses/categories, public) car
  // celui-ci n'expose QUE les verticales actives : une verticale éteinte
  // disparaîtrait de sa propre interface, impossible à rallumer.
  useEffect(() => {
    api
      .get('/admin/settings/business-categories')
      .then((r) => {
        const cats = r.data?.categories || [];
        setBusinessCategoryOptions(cats);
        // Réglage jamais enregistré → on initialise les interrupteurs sur
        // l'état réellement actif côté serveur (défauts du catalogue).
        setPlatformSettings((prev) =>
          prev.enabledBusinessCategories && prev.enabledBusinessCategories.length > 0
            ? prev
            : { ...prev, enabledBusinessCategories: r.data?.enabled || [] },
        );
      })
      .catch(() => setBusinessCategoryOptions([]));
  }, []);

  // 🏷️ F-bis — état du taguage des sous-catégories
  const loadTagging = useCallback(async () => {
    setTaggingLoading(true);
    try {
      const { data } = await api.get('/businesses/admin/subcategory-tagging');
      setTagging(data);
      setTagSelection([]);
      setTagMsg(null);
    } catch (err) {
      setTagMsg({
        type: 'error',
        text: err.response?.data?.message || err.message,
      });
    } finally {
      setTaggingLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTagging();
  }, [loadTagging]);

  // ⚡ Résolution automatique — sûr et idempotent (ne touche jamais un
  // commerce déjà tagué, ni RESTAURANT qui demande un choix humain).
  const handleAutoTag = async () => {
    setTagBusy(true);
    try {
      const { data } = await api.patch(
        '/businesses/admin/subcategory-tagging/auto',
      );
      setTagMsg({
        type: 'success',
        text: `${data.updated} commerce(s) complété(s) automatiquement.`,
      });
      await loadTagging();
    } catch (err) {
      setTagMsg({
        type: 'error',
        text: err.response?.data?.message || err.message,
      });
    } finally {
      setTagBusy(false);
    }
  };

  // 🎯 Affectation explicite : le backend ignore (avec motif) tout commerce
  // dont la verticale ne correspond pas à la sous-catégorie choisie.
  const handleBulkTag = async () => {
    if (!tagSelection.length || !tagTarget) return;
    setTagBusy(true);
    try {
      const { data } = await api.patch(
        '/businesses/admin/subcategory-tagging',
        { businessIds: tagSelection, subCategory: tagTarget },
      );
      const skipped = data.skipped?.length || 0;
      setTagMsg({
        type: skipped ? 'warning' : 'success',
        text: `${data.updated} commerce(s) tagué(s)${
          skipped ? ` — ${skipped} ignoré(s) (verticale incompatible)` : ''
        }.`,
      });
      await loadTagging();
    } catch (err) {
      setTagMsg({
        type: 'error',
        text: err.response?.data?.message || err.message,
      });
    } finally {
      setTagBusy(false);
    }
  };

  // Sous-catégories proposées = celles des verticales où il reste du travail
  // (proposer « Pizzas » alors qu'aucun restaurant n'est à taguer serait du bruit).
  const taggingSubCategoryOptions = useMemo(() => {
    const seen = new Set();
    (tagging?.groups || []).forEach((g) => {
      if (g.count > 0) g.subCategories.forEach((s) => seen.add(s));
    });
    return Array.from(seen).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [tagging]);

  // Load financial statistics
  // 🏢 Agences partenaires (Niveau 2 du dispatch)
  const loadAgencies = useCallback(async () => {
    setAgenciesLoading(true);
    try {
      const data = await getAgencies();
      setAgencies(data || []);
      setAgencyMsg(null);
    } catch (err) {
      setAgencyMsg({ type: 'error', text: err.message });
    } finally {
      setAgenciesLoading(false);
    }
  }, []);

  const handleCreateAgency = async (e) => {
    e.preventDefault();
    try {
      await createAgency({
        name: agencyForm.name,
        phone: agencyForm.phone || undefined,
        email: agencyForm.email || undefined,
        zones: agencyForm.zones
          ? agencyForm.zones.split(',').map((z) => z.trim()).filter(Boolean)
          : undefined,
        commissionPct: Number(agencyForm.commissionPct) || 10,
        maxConcurrentDeliveries: Number(agencyForm.maxConcurrentDeliveries) || 0,
      });
      setAgencyForm({ name: '', phone: '', email: '', zones: '', commissionPct: 10, maxConcurrentDeliveries: 0 });
      setAgencyMsg({ type: 'success', text: 'Agence créée avec succès' });
      await loadAgencies();
    } catch (err) {
      setAgencyMsg({ type: 'error', text: err.message });
    }
  };

  const handleToggleAgency = async (agency) => {
    try {
      await updateAgency(agency.id, { isActive: !agency.isActive });
      await loadAgencies();
    } catch (err) {
      setAgencyMsg({ type: 'error', text: err.message });
    }
  };

  const handleUpdateCommission = async (agency, commissionPct) => {
    try {
      await updateAgency(agency.id, { commissionPct: Number(commissionPct) });
      await loadAgencies();
    } catch (err) {
      setAgencyMsg({ type: 'error', text: err.message });
    }
  };

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

  // Statistiques plateforme (vue globale) — chargées INDÉPENDAMMENT de la liste
  // des utilisateurs : une erreur sur l'une ne doit jamais mettre l'autre à 0.
  const loadPlatformStats = useCallback(async () => {
    setLoading(prev => ({ ...prev, platform: true }));
    try {
      const stats = await getPlatformStats();
      setPlatformStats(prev => ({
        ...prev,
        totalMerchants: stats.merchants ?? prev.totalMerchants,
        totalClients: stats.clients ?? prev.totalClients,
        totalDrivers: stats.drivers ?? prev.totalDrivers,
        activeMerchants: stats.approvedMerchants ?? prev.activeMerchants,
        pendingMerchants: stats.pendingMerchants ?? prev.pendingMerchants,
        bannedUsers: stats.bannedUsers ?? prev.bannedUsers,
        onlineUsers: stats.onlineUsers ?? prev.onlineUsers,
        totalUsers: stats.totalUsers ?? prev.totalUsers,
      }));
    } catch {
      // Silencieux : on conserve les dernières valeurs connues.
    } finally {
      setLoading(prev => ({ ...prev, platform: false }));
    }
  }, []);

  // Utilisateurs + commerces (données réelles). On charge large (1000) pour que
  // le SUPER_ADMIN voie TOUS les comptes, pas seulement les 200 plus récents.
  const loadUsers = useCallback(async () => {
    setLoading(prev => ({ ...prev, users: true }));
    try {
      const [usersData, businessesData, statsData] = await Promise.all([
        getUsers({ limit: 1000 }),
        getBusinesses(),
        getPlatformStats(),
      ]);
      const list = Array.isArray(usersData)
        ? usersData
        : Array.isArray(usersData?.items)
          ? usersData.items
          : [];
      const merchants = Array.isArray(businessesData) ? businessesData : [];
      setUsers(list);
      setBusinesses(merchants);
      setPlatformStats(prev => ({
        ...prev,
        suspendedAccounts: list.filter((u) => u.isActive === false).length,
        bannedUsers: statsData?.bannedUsers ?? (prev.bannedUsers ?? list.filter((u) => (u.isActive === false) || u.bannedAt).length),
        onlineUsers: statsData?.onlineUsers ?? (prev.onlineUsers ?? list.filter((u) => u.isActive !== false && u.isOnline).length),
        totalUsers: statsData?.totalUsers ?? (prev.totalUsers ?? list.length),
      }));
      setUsersMsg(null);
    } catch (err) {
      setUsersMsg({ type: 'error', text: err.message });
    } finally {
      setLoading(prev => ({ ...prev, users: false }));
    }
  }, []);

  // ─── Push Campaigns ───
  const loadPushCampaigns = useCallback(async () => {
    setLoad('pushCampaigns', true);
    setPushCampaignsError(null);
    try {
      const data = await pushCampaignService.listCampaigns(50);
      setPushCampaigns(Array.isArray(data) ? data : []);
    } catch (err) {
      setPushCampaignsError(err.message);
    } finally {
      setLoad('pushCampaigns', false);
    }
  }, []);

  const handleCreateCampaign = async (e) => {
    e.preventDefault();
    setCreateCampaignBusy(true);
    try {
      await pushCampaignService.createCampaign({
        title: createCampaignForm.title,
        body: createCampaignForm.body,
        target: createCampaignForm.target,
        // Champ vide = envoi immédiat. Sinon on envoie l'ISO au backend.
        ...(createCampaignForm.scheduledAt
          ? { scheduledAt: new Date(createCampaignForm.scheduledAt).toISOString() }
          : {}),
      });
      setShowCreateCampaignModal(false);
      setCreateCampaignForm({ title: '', body: '', target: 'ALL', scheduledAt: '' });
      await loadPushCampaigns();
    } catch (err) {
      setPushCampaignsError(err.message);
    } finally {
      setCreateCampaignBusy(false);
    }
  };

  // ─── Affiliate Global Stats ───
  const loadAffiliateGlobal = useCallback(async () => {
    setLoad('affiliate', true);
    setAffiliateError(null);
    try {
      const data = await api.get('/affiliate/admin/stats').then(r => r.data);
      setAffiliateGlobalStats(data);
    } catch (err) {
      setAffiliateError(err.message);
    } finally {
      setLoad('affiliate', false);
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

  // Compteur dédié de demandes en attente (endpoint léger, SUPER_ADMIN).
  const loadPendingBanCount = useCallback(async () => {
    setPendingBanCount(await getBanRequestPendingCount());
  }, []);

  // Dernières commandes (aperçu de la vue globale) : 6 plus récentes suffisent.
  const loadRecentOrders = useCallback(async () => {
    try {
      const data = await getAdminOrders();
      const list = Array.isArray(data) ? data : data?.data || [];
      setRecentOrders(list.slice(0, 6));
    } catch {
      setRecentOrders([]);
    }
  }, []);

  // Sonde /health : latence réellement mesurée + uptime process NestJS.
  const probeHealth = useCallback(async () => {
    const t0 = performance.now();
    try {
      const data = await getSystemHealth();
      setApiLatency(Math.round(performance.now() - t0));
      const secs = data?.details?.uptime?.seconds ?? data?.info?.uptime?.seconds;
      if (Number.isFinite(Number(secs))) {
        setBackendStartedAt(new Date(Date.now() - Number(secs) * 1000));
      }
    } catch {
      setApiLatency(null);
    }
  }, []);

  // 🔄 Polling : rafraîchir la vue globale, les utilisateurs et les demandes
  // de bannissement toutes les 30 s. (déclaré APRÈS les callbacks ci-dessus
  // pour éviter toute référence avant initialisation.)
  useEffect(() => {
    const interval = setInterval(() => {
      loadPlatformStats();
      loadUsers();
      loadBanRequests();
      loadPendingBanCount();
      probeHealth();
    }, 30_000);
    return () => clearInterval(interval);
  }, [loadPlatformStats, loadUsers, loadBanRequests, loadPendingBanCount, probeHealth]);

  // Load conversations
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
    loadFinancialStats();
    loadFinancialOverview();
    loadPendingValidations();
    loadKyc();
    loadUsers();
    loadPlatformStats();
    loadBanRequests();
    loadPendingBanCount();
    loadSettings();
    loadConversations();
    loadPushCampaigns();
    loadAffiliateGlobal();
    loadRecentOrders();
    probeHealth();
  }, [loadFinancialStats, loadFinancialOverview, loadPendingValidations, loadKyc, loadUsers, loadPlatformStats, loadBanRequests, loadPendingBanCount, loadSettings, loadConversations, loadPushCampaigns, loadAffiliateGlobal, loadRecentOrders, probeHealth]);

  // 🏢 Charger les agences quand l'onglet est ouvert
  useEffect(() => {
    if (activeTab === 'agencies') {
      loadAgencies();
    }
  }, [activeTab, loadAgencies]);

  // 📡 Dispatch socket : mise à jour temps réel des statuts de commande
  useEffect(() => {
    const socket = getDispatchSocket();
    if (!socket.connected) socket.connect();
    const onStatusChanged = () => {
      loadFinancialStats();
      loadFinancialOverview();
      loadUsers();
      loadPlatformStats();
      loadBanRequests();
      loadPendingBanCount();
    };
    socket.on('orderStatusChanged', onStatusChanged);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (!socket.connected) socket.connect();
        loadFinancialStats();
        loadFinancialOverview();
        loadUsers();
        loadPlatformStats();
        loadBanRequests();
        loadPendingBanCount();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      socket.off('orderStatusChanged', onStatusChanged);
    };
  }, [loadFinancialStats, loadFinancialOverview, loadUsers, loadPlatformStats, loadBanRequests, loadPendingBanCount]);

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
  const handleViewChatHistory = async (orderId, channel = chatChannel) => {
    setSelectedChatOrder(orderId);
    setChatHistoryLoading(true);
    try {
      const data = await getChatHistory(orderId, channel);
      setChatHistory(data?.history || data || []);
    } catch {
      setChatHistory([]);
    } finally {
      setChatHistoryLoading(false);
    }

    if (chatSocketRef.current && selectedChatOrder) {
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
      // Le bannissement vient de changer le mouvement des comptes :
      // on resynchronise les compteurs et le badge dédié.
      await Promise.all([loadPlatformStats(), loadPendingBanCount()]);
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
        deliveryTiers: platformSettings.deliveryTiers,
        fasoRidePricing: platformSettings.fasoRidePricing,
        maxDeliveryRadius: platformSettings.maxDeliveryRadius,
        enableScheduling: platformSettings.enableScheduling,
        enableBulkOrders: platformSettings.enableBulkOrders,
        storiesPassEnabled: platformSettings.storiesPassEnabled,
        enabledBusinessCategories: platformSettings.enabledBusinessCategories,
        pushCampaignPricing: platformSettings.pushCampaignPricing,
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
      commissionRate: plan.commissionRate != null ? Number(plan.commissionRate) : null,
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
    setProcessingDisputes(prev => new Set([...prev, disputeId]));
    try {
      await approveRefund(disputeId, 'Remboursement approuvé par l\'administration');
      // Reload disputes
      const disputes = await getPendingDisputes('PENDING_ADMIN_APPROVAL');
      setPendingDisputes(Array.isArray(disputes) ? disputes : []);
    } catch (err) {
      setError('disputes', err.message);
    } finally {
      setProcessingDisputes(prev => {
        const next = new Set(prev);
        next.delete(disputeId);
        return next;
      });
    }
  };

  // Handle dispute rejection
  const handleRejectDispute = async (disputeId) => {
    setProcessingDisputes(prev => new Set([...prev, disputeId]));
    try {
      await rejectDispute(disputeId, 'Litige rejeté par l\'administration');
      // Reload disputes
      const disputes = await getPendingDisputes('PENDING_ADMIN_APPROVAL');
      setPendingDisputes(Array.isArray(disputes) ? disputes : []);
    } catch (err) {
      setError('disputes', err.message);
    } finally {
      setProcessingDisputes(prev => {
        const next = new Set(prev);
        next.delete(disputeId);
        return next;
      });
    }
  };

  // Séparation des utilisateurs : commerçants / clients / autres comptes
  const normRole = (u) => String(u.role || '').toLowerCase().replace('-', '_');
  const merchantUsers = users.filter((u) => normRole(u) === 'business_admin');
  const clientUsers = users.filter((u) => ['client', 'customer'].includes(normRole(u)));
  const otherUsers = users.filter((u) => normRole(u) !== 'business_admin' && !['client', 'customer'].includes(normRole(u)));

  // ── Widgets KPI uniques (vue globale) : données dérivées ──────────────────
  // Sparkline du CA : 14 derniers points de la série réelle (revenue/jour).
  const caSparkline = useMemo(() => {
    const rows = (financialOverview?.chartData || []).slice(-14);
    const vals = rows.map((d) => Number(d.revenue) || 0);
    if (vals.length < 2 || !vals.some((v) => v > 0)) return null;
    const max = Math.max(...vals);
    const min = Math.min(...vals);
    const W = 400;
    const H = 46;
    const pts = vals.map((v, i) => [
      (i / (vals.length - 1)) * W,
      H - 4 - ((v - min) / (max - min || 1)) * (H - 12),
    ]);
    const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
    return { line, area: `${line} L${W} ${H} L0 ${H} Z`, W, H };
  }, [financialOverview]);

  // Histogramme des commandes : 7 derniers jours réels (orderCount/jour).
  const orderBars = useMemo(() => {
    const rows = (financialOverview?.chartData || []).slice(-7);
    return rows.map((d) => Number(d.orderCount) || 0);
  }, [financialOverview]);

  // Part du CA transformée en commission (anneau du widget Commissions).
  const commissionRatio = financialStats.totalRevenue > 0
    ? Math.min(financialStats.totalCommission / financialStats.totalRevenue, 1)
    : 0;
  // Part des commissions encore non réglées (barre segmentée des paiements).
  const pendingShare = financialStats.totalCommission > 0
    ? Math.min(financialStats.pendingPayouts / financialStats.totalCommission, 1)
    : 0;
  // Litiges ouverts depuis plus de 48 h (calculés sur la liste détaillée).
  const oldDisputes = pendingDisputes.filter((d) => (
    d.createdAt && Date.now() - new Date(d.createdAt).getTime() > 48 * 3600 * 1000
  )).length;
  // Commandes cumulées de la période (résumé API, repli sur la série quotidienne).
  const periodOrders = financialOverview?.summary?.totalOrders
    ?? orderBars.reduce((sum, v) => sum + v, 0);
  // Panier moyen formaté compact (K / M FCFA).
  const avgOrderLabel = financialStats.averageOrderValue >= 1000000
    ? `${(financialStats.averageOrderValue / 1000000).toFixed(1)}M FCFA`
    : `${Math.round(financialStats.averageOrderValue / 1000)}K FCFA`;

  const renderUserRow = (u) => {
    const isSelf = u.id === user?.id;
    const isSuperAdminTarget = normRole(u) === 'super_admin';
    const isProtected = isSuperAdminTarget;
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
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border-light bg-background-secondary px-2.5 py-1 text-[11.5px] font-semibold text-text-secondary">
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
              className="select-field !w-auto !rounded-lg !py-1.5 !pl-3 !pr-8 !text-xs"
              value={u.role}
              disabled={usersBusy === u.id || isSelf || isProtected}
              onChange={(e) => handleChangeUserRole(u.id, e.target.value)}
            >
              {['client', 'business_admin', 'driver', 'support', 'admin', 'super_admin'].map(r => (
                <option key={r} value={r}>{roleLabel(r)}</option>
              ))}
            </select>
            {/* Ban/réactivation : réversible → ambre/vert ; suppression : définitif → rouge */}
            <button
              onClick={() => handleToggleUserStatus(u.id, !u.isActive)}
              disabled={usersBusy === u.id || isSelf || isProtected}
              className={`btn-icon ${u.isActive
                ? 'border-status-warning/30 text-status-warning hover:bg-status-warningBg hover:border-status-warning/50'
                : 'border-status-success/30 text-status-success hover:bg-status-successBg hover:border-status-success/50'}`}
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
              className="btn-icon border-status-error/30 text-status-error hover:bg-status-errorBg hover:border-status-error/50"
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

  // Structure en sections de la sidebar (refonte) : les 21 entrées historiques
  // sont toutes conservées, simplement regroupées par thème.
  const sidebarSections = [
    {
      label: 'Pilotage',
      items: [
        { id: 'overview', label: 'Vue globale', icon: Layout },
        { id: 'financial', label: 'Finance', icon: DollarSign },
        { id: 'traceability', label: 'Traçabilité', icon: ScrollText },
        { id: 'subscriptions', label: 'Abonnements', icon: Crown },
      ],
    },
    {
      label: 'Opérations',
      items: [
        { id: 'businesses', label: 'Commerces', icon: Store },
        { id: 'brands', label: 'Marques & Agences', icon: Store },
        { id: 'kyc', label: 'Validation KYC', icon: BadgeCheck, badge: kycPending.length },
        { id: 'disputes', label: 'Litiges', icon: Shield, badge: pendingDisputes.length },
        { id: 'ban-requests', label: 'Demandes de Ban', icon: Ban, badge: banRequests.filter(b => b.status === 'PENDING').length },
        { id: 'quality', label: 'Qualité livraisons', icon: Gavel },
        { id: 'agencies', label: 'Agences Livraison', icon: Building2 },
        { id: 'push-campaigns', label: 'Campagnes Push', icon: Megaphone },
      ],
    },
    {
      label: 'Équipe & gestion',
      items: [
        { id: 'team-chat', label: 'Discussion Équipe', icon: MessageSquare },
        { id: 'chat-inbox', label: 'Messagerie', icon: MessageSquare },
        { id: 'users', label: 'Gestion Utilisateurs', icon: Users },
        { id: 'affiliate', label: 'Affiliation Globale', icon: BarChart2 },
      ],
    },
    {
      label: 'Accès & système',
      items: [
        { id: 'applications', label: 'Candidatures (Onboarding)', icon: ClipboardList, badge: kycPending.length, onClick: () => navigate('/dashboard/applications') },
        { id: 'live-orders', label: 'Tour de contrôle (Live)', icon: Radio, dot: true, onClick: () => navigate('/dashboard/live-orders') },
        { id: 'settings', label: 'Paramètres', icon: Settings },
        { id: 'espace-admin', label: 'Espace Admin', icon: Layout, onClick: () => navigate('/admin/manager') },
        { id: 'espace-support', label: 'Espace Support', icon: MessageSquare, onClick: () => navigate('/admin/support') },
      ],
    },
  ];

  // Alertes récentes de la vue globale (sources déjà chargées, sans nouvel appel).
  const alertItems = [
    kycPending.length > 0 && {
      key: 'kyc', icon: BadgeCheck, color: '#F59E0B',
      title: 'KYC à valider',
      desc: `${kycPending.length} document(s) en attente de vérification`,
      count: kycPending.length, tab: 'kyc',
    },
    pendingDisputes.length > 0 && {
      key: 'disputes', icon: Shield, color: '#EF4444',
      title: 'Litiges ouverts',
      desc: `${pendingDisputes.length} litige(s) en attente d'arbitrage`,
      count: pendingDisputes.length, tab: 'disputes',
    },
    (pendingBanCount ?? 0) > 0 && {
      key: 'bans', icon: Ban, color: '#8B5CF6',
      title: 'Demandes de bannissement',
      desc: `${pendingBanCount} demande(s) à examiner`,
      count: pendingBanCount, tab: 'ban-requests',
    },
  ].filter(Boolean);

  // Actions rapides de la vue globale.
  const quickActions = [
    { label: 'Valider KYC', icon: BadgeCheck, color: '#F59E0B', onClick: () => setActiveTab('kyc') },
    { label: 'Nouvelle campagne', icon: Megaphone, color: '#C1652E', onClick: () => setActiveTab('push-campaigns') },
    { label: 'Litiges', icon: Shield, color: '#EF4444', onClick: () => setActiveTab('disputes') },
    { label: 'Utilisateurs', icon: Users, color: '#3B82F6', onClick: () => setActiveTab('users') },
  ];

  // Recherche globale locale (≥2 caractères) sur utilisateurs, commerces,
  // KYC et commandes déjà chargés — pas d'appel API supplémentaire.
  const globalResults = useMemo(() => {
    const q = globalQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    const out = [];
    users
      .filter((u) =>
        (u.fullName || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.phone || '').includes(q))
      .slice(0, 3)
      .forEach((u) => out.push({
        key: `u-${u.id}`, icon: Users, label: u.fullName || u.email || 'Utilisateur',
        sub: `${roleLabel(u.role)}${u.email ? ` · ${u.email}` : ''}`, tab: 'users',
      }));
    businesses
      .filter((b) =>
        (b.businessName || b.name || '').toLowerCase().includes(q))
      .slice(0, 3)
      .forEach((b) => out.push({
        key: `b-${b.id}`, icon: Store, label: b.businessName || b.name || 'Commerce',
        sub: 'Commerce', tab: 'businesses',
      }));
    kycPending
      .filter((k) =>
        (k.businessName || k.fullName || k.applicationData?.businessName || k.user?.fullName || '').toLowerCase().includes(q))
      .slice(0, 2)
      .forEach((k) => out.push({
        key: `k-${k.id}`, icon: BadgeCheck,
        label: k.businessName || k.fullName || k.applicationData?.businessName || k.user?.fullName || 'Dossier KYC',
        sub: 'Dossier KYC en attente', tab: 'kyc',
      }));
    recentOrders
      .filter((o) => String(o.id).toLowerCase().includes(q))
      .slice(0, 2)
      .forEach((o) => out.push({
        key: `o-${o.id}`, icon: ShoppingBag, label: `Commande #${String(o.id).slice(0, 8)}`,
        sub: `${Number(o.totalAmount || 0).toLocaleString('fr-FR')} FCFA · ${o.status || 'PENDING'}`, nav: '/dashboard/live-orders',
      }));
    return out.slice(0, 8);
  }, [globalQuery, users, businesses, kycPending, recentOrders]);

  const openSearchResult = (r) => {
    setGlobalQuery('');
    if (r.nav) navigate(r.nav);
    else if (r.tab) setActiveTab(r.tab);
  };

  return (
    <div className="min-h-screen bg-background-primary flex">
      {/* ─── SIDEBAR SUPER ADMIN (refonte : sections + identité) ─── */}
      <AppSidebar
        sections={sidebarSections}
        user={user}
        roleLabel={isSuperAdmin ? 'Super Administration' : 'Administration'}
        onSelect={setActiveTab}
        onLogout={handleLogout}
        open={sidebarOpen}
        onOpenChange={setSidebarOpen}
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
      />

      {/* ─── MAIN CONTENT ────────────────────────────────────────── */}
      <main className={`flex-1 min-h-screen p-6 lg:p-8 ${sidebarCollapsed ? 'lg:ml-[76px]' : 'lg:ml-64'}`}>
        {/* Hero d'accueil (uniquement sur la vue globale) */}
        {activeTab === 'overview' && (
          <PageHero
            name={String(user?.fullName || '').trim().split(' ')[0] || 'Admin'}
            subtitle="Voici l’état de la plateforme"
            widgets={[
              { value: (platformStats.onlineUsers ?? 0).toLocaleString('fr-FR'), label: 'utilisateurs en ligne', dot: '#22C55E' },
              { value: `${kycPending.length} KYC`, label: 'à valider aujourd’hui', dot: '#F59E0B' },
              { value: `${(financialStats.totalRevenue / 1000000).toFixed(1)} M FCFA`, label: 'revenus cumulés', delta: financialStats.revenueGrowth },
              { value: (platformStats.totalUsers ?? 0).toLocaleString('fr-FR'), label: 'utilisateurs inscrits' },
              {
                value: FLOAT_HEALTH_META[financialStats.floatHealth]?.label || FLOAT_HEALTH_META.unknown.label,
                label: 'Santé float du système',
                dot: FLOAT_HEALTH_META[financialStats.floatHealth]?.dot || FLOAT_HEALTH_META.unknown.dot,
              },
            ]}
            actions={[
              { label: 'Nouvelle campagne', onClick: () => setActiveTab('push-campaigns') },
              { label: 'Voir les litiges', onClick: () => setActiveTab('disputes'), variant: 'secondary' },
            ]}
          />
        )}

        <header className="mb-6 flex items-center gap-4 pb-4 border-b border-border-light">
          <div className="flex min-w-0 items-center gap-3 lg:w-[28%]">
            <button
              onClick={() => setSidebarOpen(true)}
              aria-label="Ouvrir le menu"
              className="rounded-lg border border-border-light bg-background-card p-2 text-text-secondary transition-colors hover:bg-background-secondary lg:hidden"
            >
              <Menu size={18} />
            </button>
            {activeTab !== 'overview' && (
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-bold text-text-primary">Centre de Contrôle Global</h1>
                <p className="truncate text-sm text-text-secondary">Gestion globale de la plateforme FasoFree</p>
              </div>
            )}
          </div>

          {/* Recherche globale centrée (façon contrôle qualité logistique) */}
          <div className="flex flex-1 justify-center">
            <div className="relative hidden w-full max-w-xl md:block">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
              <input
                value={globalQuery}
                onChange={(e) => setGlobalQuery(e.target.value)}
                placeholder="Rechercher commande, client, commerce…"
                aria-label="Recherche globale"
                className="w-full rounded-lg border border-border-light bg-background-card py-2.5 pl-9 pr-3 text-[13px] text-text-primary placeholder:text-text-tertiary focus:border-accent-primary/40 focus:outline-none"
              />
              <span className="absolute left-[2px] top-1/2 h-5 w-[2px] -translate-y-1/2 rounded bg-accent-primary" />
              {globalQuery.trim().length >= 2 && (
                <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-border-light bg-background-card shadow-xl">
                  {globalResults.length === 0 ? (
                    <p className="px-4 py-3 text-xs text-text-tertiary">Aucun résultat pour « {globalQuery} »</p>
                  ) : (
                    globalResults.map((r) => (
                      <button
                        key={r.key}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => openSearchResult(r)}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-background-secondary"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background-tertiary">
                          <r.icon size={15} className="text-text-secondary" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-bold text-text-primary">{r.label}</span>
                          <span className="block truncate text-xs text-text-tertiary">{r.sub}</span>
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 lg:w-[28%]">
            <PWAInstallButton className="hidden sm:inline-flex" />
            <NotificationBell />
            <span className="rounded-full bg-background-tertiary px-3 py-1 text-xs font-bold text-text-secondary">
              Mode {isSuperAdmin ? 'Super Admin' : roleLabel(userRole)}
            </span>
          </div>
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
            {/* Bandeau KPI : blocs type Hanpiz — pastille encre, titre à
                côté, valeur XXL, sous-métriques à filets dans la même carte */}
            <div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
                {/* 1 · Chiffre d'affaires (2 col) : valeur XXL, accent encre
                    total (sparkline + delta), bandeau Transactions/Commandes */}
                <div className="rounded-card border border-border-light bg-background-card p-5 sm:col-span-2">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#241F1B]">
                      <TrendingUp size={17} strokeWidth={2} className="text-white" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-bold text-text-primary">Chiffre d'affaires</p>
                      <p className="text-[11.5px] text-text-tertiary">30 derniers jours</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-4">
                    <div>
                      <div className="flex items-end gap-2">
                        <span className="text-[44px] font-extrabold leading-none tracking-tight text-text-primary">
                          {loading.financial ? '—' : `${(financialStats.totalRevenue / 1000000).toFixed(1)}M`}
                        </span>
                        <span className="pb-1 text-sm font-semibold text-text-secondary">FCFA</span>
                      </div>
                      <p className="mt-2.5 text-[13px] font-bold text-text-primary">
                        {financialStats.revenueGrowth >= 0 ? '+' : '−'}{Math.abs(financialStats.revenueGrowth)}%
                        <span className="ml-1.5 font-normal text-text-secondary">vs mois dernier</span>
                      </p>
                    </div>
                    {caSparkline && (
                      <svg
                        viewBox={`0 0 ${caSparkline.W} ${caSparkline.H}`}
                        preserveAspectRatio="none"
                        className="h-14 w-[46%] max-w-[240px] shrink-0"
                        aria-hidden="true"
                      >
                        <path d={caSparkline.area} fill="rgba(36,31,27,0.06)" />
                        <path
                          d={caSparkline.line}
                          fill="none"
                          stroke="#241F1B"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          vectorEffect="non-scaling-stroke"
                        />
                      </svg>
                    )}
                  </div>
                  <div className="mt-4 grid grid-cols-3 border-t border-[#EFE8DC]">
                    <div className="pr-3 pt-3">
                      <p className="text-[11.5px] text-text-tertiary">Transactions</p>
                      <p className="mt-1 text-[15.5px] font-bold text-text-primary">{financialStats.totalTransactions.toLocaleString('fr-FR')}</p>
                    </div>
                    <div className="border-l border-[#EFE8DC] px-3 pt-3">
                      <p className="text-[11.5px] text-text-tertiary">Commandes</p>
                      <p className="mt-1 text-[15.5px] font-bold text-text-primary">{periodOrders.toLocaleString('fr-FR')}</p>
                    </div>
                    <div className="border-l border-[#EFE8DC] pl-3 pt-3">
                      <p className="text-[11.5px] text-text-tertiary">Panier moyen</p>
                      <p className="mt-1 text-[15.5px] font-bold text-text-primary">{avgOrderLabel}</p>
                    </div>
                  </div>
                </div>

                {/* 2 · Plateforme : grille 3×3 à filets (remplace la ligne de
                    compteurs-type-template) */}
                <div className="rounded-card border border-border-light bg-background-card p-5 sm:col-span-2 xl:col-span-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-baseline gap-2">
                      <p className="text-[13.5px] font-bold text-text-primary">Plateforme</p>
                      <p className="text-[11.5px] text-text-tertiary">aujourd'hui</p>
                    </div>
                    <button
                      onClick={() => { loadFinancialStats(); loadPlatformStats(); }}
                      className="flex items-center gap-1.5 text-xs font-semibold text-accent-primary hover:underline"
                    >
                      <RefreshCw size={12} className={loading.financial || loading.platform ? 'animate-spin' : ''} />
                      Actualiser
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-3">
                    {[
                      ['Commerces', platformStats.totalMerchants],
                      ['Clients', platformStats.totalClients],
                      ['Livreurs', platformStats.totalDrivers],
                      ['Utilisateurs', platformStats.totalUsers],
                      ['En ligne', platformStats.onlineUsers],
                      ['Suspendus', platformStats.suspendedAccounts],
                      ['Bannis', platformStats.bannedUsers],
                      ['KYC à valider', kycPending.length],
                      ['Demandes de ban', pendingBanCount ?? '—'],
                    ].map(([label, value], i) => (
                      <div
                        key={label}
                        className={`px-4 py-3 ${i % 3 !== 0 ? 'border-l border-[#EFE8DC]' : ''} ${i > 2 ? 'border-t border-[#EFE8DC]' : ''}`}
                      >
                        <p className="text-[11.5px] text-text-tertiary">{label}</p>
                        <p className="mt-1 text-[17px] font-extrabold tracking-tight text-text-primary">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3 · Commissions : anneau terracotta (part du CA) + montant */}
                <div className="rounded-card border border-border-light bg-background-card p-5 sm:col-span-2 xl:col-span-2">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#241F1B]">
                      <Wallet size={17} strokeWidth={2} className="text-white" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-bold text-text-primary">Commissions</p>
                      <p className="text-[11.5px] text-text-tertiary">Part de la plateforme</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-4">
                    <svg width="84" height="84" viewBox="0 0 84 84" className="shrink-0" aria-hidden="true">
                      <circle cx="42" cy="42" r="34" fill="none" stroke="#EFE8DC" strokeWidth="9" />
                      <circle
                        cx="42"
                        cy="42"
                        r="34"
                        fill="none"
                        stroke="#C1652E"
                        strokeWidth="9"
                        strokeLinecap="round"
                        strokeDasharray={`${(2 * Math.PI * 34 * commissionRatio).toFixed(1)} ${(2 * Math.PI * 34).toFixed(1)}`}
                        transform="rotate(-90 42 42)"
                      />
                      <text x="42" y="41" textAnchor="middle" fontSize="15" fontWeight="800" fill="#29231E">{Math.round(commissionRatio * 100)}%</text>
                      <text x="42" y="54" textAnchor="middle" fontSize="7" fontWeight="700" fill="#9B9286" letterSpacing="0.6">DU CA</text>
                    </svg>
                    <div>
                      <p className="text-[30px] font-extrabold leading-none tracking-tight text-text-primary">
                        {(financialStats.totalCommission / 1000000).toFixed(1)}M
                      </p>
                      <p className="mt-1.5 text-xs font-semibold text-text-secondary">FCFA encaissés</p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 border-t border-[#EFE8DC]">
                    <div className="pr-3 pt-3">
                      <p className="text-[11.5px] text-text-tertiary">À régler</p>
                      <p className="mt-1 text-[15.5px] font-bold text-text-primary">{(financialStats.pendingPayouts / 1000000).toFixed(1)}M FCFA</p>
                    </div>
                    <div className="border-l border-[#EFE8DC] pl-3 pt-3">
                      <p className="text-[11.5px] text-text-tertiary">Déjà réglé</p>
                      <p className="mt-1 text-[15.5px] font-bold text-text-primary">{(Math.max(financialStats.totalCommission - financialStats.pendingPayouts, 0) / 1000000).toFixed(1)}M FCFA</p>
                    </div>
                  </div>
                </div>

                {/* 4 · Paiements en attente : barre segmentée (part non réglée) */}
                <div className="rounded-card border border-border-light bg-background-card p-5 sm:col-span-2 xl:col-span-2">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#241F1B]">
                      <CreditCard size={17} strokeWidth={2} className="text-white" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-bold text-text-primary">Paiements en attente</p>
                      <p className="text-[11.5px] text-text-tertiary">Part des commissions non réglées</p>
                    </div>
                  </div>
                  <p className="mt-4 text-[44px] font-extrabold leading-none tracking-tight text-text-primary">
                    {loading.financial ? '—' : `${(financialStats.pendingPayouts / 1000000).toFixed(1)}`}
                    <span className="ml-2 text-sm font-semibold text-text-secondary">M FCFA</span>
                  </p>
                  <div className="mt-4 flex h-2.5 w-full overflow-hidden rounded-full bg-border-light">
                    <span className="h-full rounded-l-full bg-status-warning" style={{ width: `${Math.round(pendingShare * 100)}%` }} />
                    <span className="h-full rounded-r-full bg-status-warning/40" style={{ width: `${Math.round(Math.max((1 - pendingShare) * 0.3, 0.12) * 100)}%` }} />
                  </div>
                  <p className="mt-2 text-[11.5px] text-text-tertiary">Soit {Math.round(pendingShare * 100)}% des commissions à régler</p>
                </div>

                {/* 5 · Litiges : carte blanche, chiffre XXL encre, alerte >48 h */}
                <div className="flex flex-col rounded-card border border-border-light bg-background-card p-5 sm:col-span-2 xl:col-span-2">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#241F1B]">
                      <AlertCircle size={17} strokeWidth={2} className="text-white" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-bold text-text-primary">Litiges ouverts</p>
                      <p className="text-[11.5px] text-text-tertiary">En attente d'arbitrage</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-3">
                    <p className="text-[44px] font-extrabold leading-none tracking-tight text-text-primary">
                      {loading.financial ? '—' : financialStats.pendingDisputes}
                    </p>
                    {oldDisputes > 0 ? (
                      <span className="rounded-full border border-status-error/25 bg-status-errorBg px-2.5 py-1 text-[11.5px] font-semibold text-status-error">
                        {oldDisputes} depuis 48 h
                      </span>
                    ) : (
                      <span className="rounded-full border border-status-success/25 bg-status-successBg px-2.5 py-1 text-[11.5px] font-semibold text-status-success">
                        Rien d'ancien
                      </span>
                    )}
                  </div>
                  <div className="mt-auto flex items-center gap-2 border-t border-[#EFE8DC] pt-3 text-[11.5px] text-text-secondary">
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${oldDisputes > 0 ? 'bg-status-error' : 'bg-status-success'}`} />
                    {oldDisputes > 0
                      ? `${oldDisputes} dossier${oldDisputes > 1 ? 's' : ''} ouvert${oldDisputes > 1 ? 's' : ''} depuis plus de 48 h`
                      : 'Aucun litige de plus de 48 h'}
                    <span className="ml-auto text-text-tertiary">{pendingDisputes.length} à traiter</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Grille asymétrique : activité (gauche) + système & actions (droite) */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              <div className="lg:col-span-3 space-y-6">
                <FinancialChart
                  data={financialOverview?.chartData || []}
                  series={[
                    { key: 'revenue', name: 'Chiffre d\'affaires', color: '#C1652E' },
                    { key: 'platformCommission', name: 'Commission plateforme', color: '#241F1B' },
                  ]}
                  title="Revenus & commissions"
                  height={300}
                />

                {/* Tableau des dernières commandes */}
                <div className="card overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-border-light">
                    <h2 className="text-sm font-bold text-text-primary">Dernières commandes</h2>
                    <button
                      onClick={() => navigate('/dashboard/live-orders')}
                      className="text-accent-primary text-xs font-semibold hover:underline"
                    >
                      Tour de contrôle →
                    </button>
                  </div>
                  {recentOrders.length === 0 ? (
                    <EmptyState
                      icon={ShoppingBag}
                      title="Aucune commande"
                      description="Les commandes apparaîtront ici dès la première activité."
                    />
                  ) : (
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-border-light">
                          {['Commande', 'Client', 'Commerce', 'Statut', 'Montant', 'Heure'].map((h) => (
                            <th
                              key={h}
                              className="px-5 py-2.5 text-[11.5px] font-semibold text-text-secondary"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-light">
                        {recentOrders.map((o) => (
                          <tr key={o.id} className="transition-colors hover:bg-background-secondary">
                            <td className="px-5 py-3 font-mono text-xs font-bold text-text-primary">#{String(o.id).slice(0, 8)}</td>
                            <td className="px-5 py-3 text-[13px] text-text-primary">{o.customerName || o.clientName || '—'}</td>
                            <td className="px-5 py-3 text-[13px] text-text-secondary">{o.businessName || o.business?.name || '—'}</td>
                            <td className="px-5 py-3">
                              <StatusBadge status={o.status || 'PENDING'} statusConfig={ORDER_STATUS_CONFIG} />
                            </td>
                            <td className="px-5 py-3 text-[13px] font-bold text-text-primary">
                              {Number(o.totalAmount || 0).toLocaleString('fr-FR')} F
                            </td>
                            <td className="px-5 py-3 font-mono text-xs text-text-tertiary">
                              {o.createdAt
                                ? new Date(o.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                                : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              <div className="lg:col-span-2 space-y-6">
                {/* Carte Système : float + session live + latence mesurée + uptime backend */}
                <div className="card p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-sm font-bold text-text-primary">Système</h2>
                    <span
                      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10.5px] font-bold tracking-wide ${
                        apiLatency != null ? 'bg-status-successBg text-status-success' : 'bg-status-errorBg text-status-error'
                      }`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {apiLatency != null ? 'OPÉRATIONNEL' : 'HORS LIGNE'}
                    </span>
                  </div>
                  <dl className="space-y-3 text-[13px]">
                    <div className="flex items-center justify-between">
                      <dt className="text-text-secondary">Float Mobile Money</dt>
                      <dd
                        className="flex items-center gap-2 font-semibold"
                        style={{ color: FLOAT_HEALTH_META[financialStats.floatHealth]?.dot || FLOAT_HEALTH_META.unknown.dot }}
                      >
                        {FLOAT_HEALTH_META[financialStats.floatHealth]?.label || FLOAT_HEALTH_META.unknown.label}
                        <span
                          aria-hidden="true"
                          title="Indicateur d'état"
                          className={`inline-flex h-5 w-9 items-center rounded-full px-0.5 ${
                            financialStats.floatHealth === 'healthy'
                              ? 'bg-status-success'
                              : financialStats.floatHealth === 'warning'
                                ? 'bg-status-warning'
                                : financialStats.floatHealth === 'critical'
                                  ? 'bg-status-error'
                                  : 'bg-border-light'
                          }`}
                        >
                          <span
                            className={`h-4 w-4 rounded-full bg-white shadow ${
                              financialStats.floatHealth === 'critical' || financialStats.floatHealth === 'unknown' ? '' : 'ml-auto'
                            }`}
                          />
                        </span>
                      </dd>
                    </div>
                    <div className="flex items-center justify-between border-t border-border-light pt-3">
                      <dt className="text-text-secondary">Session active depuis</dt>
                      <dd className="font-mono text-sm font-bold text-text-primary">{formatSession(sessionSeconds)}</dd>
                    </div>
                    <div className="flex items-center justify-between border-t border-border-light pt-3">
                      <dt className="text-text-secondary">Latence API</dt>
                      <dd className="font-mono text-sm font-bold text-text-primary">
                        {apiLatency != null ? `${apiLatency} ms` : '—'}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between border-t border-border-light pt-3">
                      <dt className="text-text-secondary">Backend démarré le</dt>
                      <dd className="font-semibold text-text-primary">
                        {backendStartedAt
                          ? backendStartedAt.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                          : '—'}
                      </dd>
                    </div>
                  </dl>
                </div>

                {/* Alertes récentes */}
                <div className="card overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-border-light">
                    <h2 className="text-sm font-bold text-text-primary">Alertes récentes</h2>
                    <span className="text-xs text-text-tertiary">{alertItems.length} à traiter</span>
                  </div>
                  <div className="divide-y divide-border-light">
                    {alertItems.length === 0 ? (
                      <EmptyState
                        icon={CheckCircle}
                        title="Tout est calme"
                        description="Aucune alerte en attente : KYC, litiges et bannissements sont à jour."
                      />
                    ) : (
                      alertItems.map((a) => (
                        <button
                          key={a.key}
                          onClick={() => setActiveTab(a.tab)}
                          className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-background-secondary"
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#F0E9DD]">
                            <a.icon size={16} className="text-[#241F1B]" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[13px] font-bold text-text-primary">{a.title}</span>
                            <span className="block truncate text-xs text-text-secondary">{a.desc}</span>
                          </span>
                          <span className="shrink-0 rounded-full bg-[#F0E9DD] px-2.5 py-1 text-[11.5px] font-bold text-text-primary">
                            {a.count}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>

                {/* Actions rapides */}
                <div className="card p-5">
                  <h2 className="mb-3 text-sm font-bold text-text-primary">Actions rapides</h2>
                  <div className="grid grid-cols-2 gap-3">
                    {quickActions.map((a) => (
                      <button
                        key={a.label}
                        onClick={a.onClick}
                        className="flex flex-col items-center gap-2.5 rounded-xl border border-[#EFE8DC] bg-[#F7F3EB] px-3 py-4 transition-colors hover:border-border-medium hover:bg-background-secondary"
                      >
                        <a.icon size={18} className="text-[#241F1B]" strokeWidth={2} />
                        <span className="text-center text-[13px] font-semibold text-text-primary">{a.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ──────────────────────────────────────────────────────── */}
        {activeTab === 'traceability' && (
          <div className="animate-slide-up">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-xl font-bold text-text-primary">
                  Traçabilité &amp; Traçabilité financière
                </h2>
                <p className="text-sm text-text-secondary">
                  Exports CSV automatiques, journal des actions d&apos;administration et
                  blocages anti-fraude.
                </p>
              </div>
            </div>
            <TraceabilityTab />
          </div>
        )}

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
                      ? 'border-[#241F1B] text-[#241F1B]'
                      : 'border-transparent text-text-tertiary hover:text-text-primary'
                  }`}
                >
                  {t.l}
                </button>
              ))}
            </div>

            {/* 💰 Outil d'exploitation : créditer un portefeuille à la main
                (l'agent support y a recours quand la recharge en ligne échoue). */}
            <WalletAdminCreditCard />

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
                          <p className="text-[11.5px] text-text-tertiary mb-1">Chiffre d'affaires</p>
                          <p className="text-lg font-bold text-text-primary">{financialOverview.summary.totalRevenue?.toLocaleString()} <span className="text-xs text-text-secondary">FCFA</span></p>
                        </div>
                        <div className="card p-4">
                          <p className="text-[11.5px] text-text-tertiary mb-1">Commission plateforme</p>
                          <p className="text-lg font-bold text-text-primary">{financialOverview.summary.totalPlatformCommission?.toLocaleString()} <span className="text-xs text-text-secondary">FCFA</span></p>
                        </div>
                        <div className="card p-4">
                          <p className="text-[11.5px] text-text-tertiary mb-1">Frais service</p>
                          <p className="text-lg font-bold text-text-primary">{financialOverview.summary.totalServiceFee?.toLocaleString()} <span className="text-xs text-text-secondary">FCFA</span></p>
                        </div>
                        <div className="card p-4">
                          <p className="text-[11.5px] text-text-tertiary mb-1">Frais livraison</p>
                          <p className="text-lg font-bold text-text-primary">{financialOverview.summary.totalDeliveryFee?.toLocaleString()} <span className="text-xs text-text-secondary">FCFA</span></p>
                        </div>
                        <div className="card p-4">
                          <p className="text-[11.5px] text-text-tertiary mb-1">Annulés / Remboursés</p>
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
                            { key: 'platformCommission', name: 'Commission plateforme', color: '#241F1B' },
                          ]}
                          title="Revenus & Commissions"
                          height={320}
                        />
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          <FinancialChart
                            data={financialOverview.chartData}
                            series={[
                              { key: 'serviceFee', name: 'Frais service', color: '#A08B6F' },
                              { key: 'deliveryFee', name: 'Frais livraison', color: '#D9C6A8' },
                            ]}
                            title="Frais collectés"
                            height={260}
                          />
                          <FinancialChart
                            data={financialOverview.chartData}
                            series={[
                              { key: 'merchantPayout', name: 'Paiement marchands', color: '#6E6559' },
                              { key: 'merchantCommission', name: 'Commission marchand', color: '#8A5A3B' },
                              { key: 'driverCommission', name: 'Commission livreur', color: '#3F3831' },
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
                        <p className="text-[11.5px] text-text-tertiary mb-1">Produits vendus</p>
                        <p className="text-lg font-bold text-text-primary">{productAnalytics.totalProducts}</p>
                      </div>
                      <div className="card p-4">
                        <p className="text-[11.5px] text-text-tertiary mb-1">Articles vendus</p>
                        <p className="text-lg font-bold text-text-primary">{productAnalytics.totalItemsSold?.toLocaleString()}</p>
                      </div>
                      <div className="card p-4">
                        <p className="text-[11.5px] text-text-tertiary mb-1">CA Produits</p>
                        <p className="text-lg font-bold text-text-primary">{productAnalytics.products?.reduce((s,p) => s + p.totalRevenue, 0)?.toLocaleString()} <span className="text-xs text-text-secondary">FCFA</span></p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Top produits */}
                      <div className="card overflow-hidden">
                        <div className="px-5 py-3 border-b border-border-light">
                          <h3 className="text-[13.5px] font-bold text-text-primary">Top Produits (les plus vendus)</h3>
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
                          <h3 className="text-[13.5px] font-bold text-text-primary">Moins Vendus (à améliorer)</h3>
                        </div>
                        <div className="divide-y divide-border-light">
                          {productAnalytics.worstProducts?.map((p, i) => (
                            <div key={p.productId} className="px-5 py-3 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <span className="w-6 h-6 rounded-full bg-[#F0E9DD] flex items-center justify-center text-[10px] font-bold text-text-secondary">{i+1}</span>
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
                      <div className="card p-4 border-l-4 border-[#C1652E]">
                        <p className="text-[11.5px] text-text-tertiary mb-1">Entrées d'argent</p>
                        <p className="text-lg font-bold text-text-primary">{moneyFlows.summary?.totalEntries?.toLocaleString()} <span className="text-xs text-text-secondary">FCFA</span></p>
                      </div>
                      <div className="card p-4 border-l-4 border-[#241F1B]">
                        <p className="text-[11.5px] text-text-tertiary mb-1">Sorties d'argent</p>
                        <p className="text-lg font-bold text-text-primary">{moneyFlows.summary?.totalExits?.toLocaleString()} <span className="text-xs text-text-secondary">FCFA</span></p>
                      </div>
                      <div className="card p-4 border-l-4 border-[#A08B6F]">
                        <p className="text-[11.5px] text-text-tertiary mb-1">Reversals / Remboursements</p>
                        <p className="text-lg font-bold text-text-primary">{moneyFlows.summary?.totalReversals?.toLocaleString()} <span className="text-xs text-text-secondary">FCFA</span></p>
                      </div>
                    </div>

                    {/* Détail par motif */}
                    <div className="card overflow-hidden">
                      <div className="px-5 py-3 border-b border-border-light">
                        <h3 className="text-[13.5px] font-bold text-text-primary">Détail par motif</h3>
                      </div>
                      <div className="divide-y divide-border-light">
                        {Object.entries(moneyFlows.summary?.byReason || {}).map(([reason, data]) => (
                          <div key={reason} className="px-5 py-3 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className={`w-2 h-2 rounded-full ${
                                data.type === 'CREDIT' ? 'bg-[#C1652E]' : 'bg-[#241F1B]'
                              }`} />
                              <span className="text-sm font-medium text-text-primary">{reason.replace(/_/g, ' ')}</span>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-text-primary">
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
                            { key: 'entries', name: 'Entrées', color: '#C1652E' },
                            { key: 'exits', name: 'Sorties', color: '#241F1B' },
                            { key: 'reversals', name: 'Reversals', color: '#A08B6F' },
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
        {/* ONGLET AGENCES DE LIVRAISON (Niveau 2 du dispatch) */}
        {/* ──────────────────────────────────────────────────────── */}
        {activeTab === 'agencies' && (
          <div className="space-y-6 animate-slide-up">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-text-primary">Agences de Livraison</h2>
                <p className="text-text-secondary text-sm">
                  Flottes partenaires qui prennent le relais quand aucun livreur interne n'est disponible.
                </p>
              </div>
              <button onClick={loadAgencies} className="btn-secondary gap-2">
                <RefreshCw size={14} className={agenciesLoading ? 'animate-spin' : ''} />
                Actualiser
              </button>
            </div>

            {agencyMsg && (
              <div className={`p-3 rounded-lg border text-sm ${agencyMsg.type === 'success' ? 'bg-status-successBg border-status-success/30 text-status-success' : 'bg-status-errorBg border-status-error/30 text-status-error'}`}>
                {agencyMsg.text}
              </div>
            )}

            {/* ── Création ─────────────────────────────────── */}
            <form onSubmit={handleCreateAgency} className="card p-5 space-y-4">
              <h3 className="text-[13.5px] font-bold text-text-primary">Nouvelle agence</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <input
                  className="input"
                  placeholder="Nom de l'agence *"
                  value={agencyForm.name}
                  onChange={(e) => setAgencyForm({ ...agencyForm, name: e.target.value })}
                  required
                />
                <input
                  className="input"
                  placeholder="Téléphone"
                  value={agencyForm.phone}
                  onChange={(e) => setAgencyForm({ ...agencyForm, phone: e.target.value })}
                />
                <input
                  className="input"
                  placeholder="Email"
                  type="email"
                  value={agencyForm.email}
                  onChange={(e) => setAgencyForm({ ...agencyForm, email: e.target.value })}
                />
                <input
                  className="input"
                  placeholder="Zones (ex. Ouagadougou, Bobo-Dioulasso)"
                  value={agencyForm.zones}
                  onChange={(e) => setAgencyForm({ ...agencyForm, zones: e.target.value })}
                />
                <input
                  className="input"
                  placeholder="Commission % (défaut 10)"
                  type="number"
                  min="0"
                  max="100"
                  value={agencyForm.commissionPct}
                  onChange={(e) => setAgencyForm({ ...agencyForm, commissionPct: e.target.value })}
                />
                <input
                  className="input"
                  placeholder="Capacité max (0 = illimité)"
                  type="number"
                  min="0"
                  value={agencyForm.maxConcurrentDeliveries}
                  onChange={(e) => setAgencyForm({ ...agencyForm, maxConcurrentDeliveries: e.target.value })}
                />
              </div>
              <button type="submit" className="btn-primary gap-2">
                <Plus size={14} />
                Créer l'agence
              </button>
            </form>

            {/* ── Liste des agences ────────────────────────── */}
            <div className="card overflow-hidden">
              <div className="px-5 py-3 border-b border-border-light">
                <h3 className="text-[13.5px] font-bold text-text-primary">
                  Agences partenaires ({agencies.length})
                </h3>
              </div>
              {agenciesLoading ? (
                <div className="p-8 text-center text-text-tertiary text-sm">Chargement…</div>
              ) : agencies.length === 0 ? (
                <div className="p-8 text-center text-text-tertiary text-sm">
                  Aucune agence enregistrée. Créez-en une pour activer le Niveau 2 du dispatch.
                </div>
              ) : (
                <div className="divide-y divide-border-light">
                  {agencies.map((agency) => (
                    <div key={agency.id} className="px-5 py-4 flex flex-col lg:flex-row lg:items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-semibold text-text-primary">{agency.name}</p>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${agency.isActive ? 'bg-status-successBg text-status-success' : 'bg-status-errorBg text-status-error'}`}>
                            {agency.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <p className="text-xs text-text-tertiary">
                          {agency.phone || '—'} · {agency.email || '—'} · Zones : {(agency.zones || []).join(', ') || 'National'} · Capacité : {Number(agency.maxConcurrentDeliveries) > 0 ? agency.maxConcurrentDeliveries : 'illimitée'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <input
                            className="input w-24 text-sm"
                            type="number"
                            min="0"
                            max="100"
                            defaultValue={agency.commissionPct}
                            onBlur={(e) => {
                              if (Number(e.target.value) !== Number(agency.commissionPct)) {
                                handleUpdateCommission(agency, e.target.value);
                              }
                            }}
                          />
                          <span className="text-xs text-text-tertiary">%</span>
                        </div>
                        <button
                          onClick={() => handleToggleAgency(agency)}
                          className="btn-secondary text-xs"
                        >
                          {agency.isActive ? 'Désactiver' : 'Activer'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ──────────────────────────────────────────────────────── */}
        {/* ONGLET CAMPAGNES PUSH */}
        {/* ──────────────────────────────────────────────────────── */}
        {activeTab === 'quality' && <DeliveryQualityTab />}

        {activeTab === 'push-campaigns' && (
          <div className="space-y-6 animate-slide-up">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-text-primary">Campagnes Push Promotionnelles</h2>
                <p className="text-text-secondary text-sm">
                  Envoyez une notification ciblée à tous les utilisateurs, clients, livreurs ou commerçants.
                </p>
              </div>
              <button
                onClick={() => setShowCreateCampaignModal(true)}
                className="btn-primary gap-2"
              >
                <Plus size={14} />
                Nouvelle campagne
              </button>
            </div>

            {pushCampaignsError && (
              <div className="card p-4 border-border-error/20 bg-status-error/5">
                <p className="text-status-error text-sm">{pushCampaignsError}</p>
              </div>
            )}

            {/* ── Création ─────────────────────────────────── */}
            <form onSubmit={handleCreateCampaign} className="card p-5 space-y-4">
              <h3 className="text-[13.5px] font-bold text-text-primary">Nouvelle campagne</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <input
                  className="input"
                  placeholder="Titre (3-200 caractères) *"
                  value={createCampaignForm.title}
                  onChange={(e) => setCreateCampaignForm({ ...createCampaignForm, title: e.target.value })}
                  required
                  maxLength={200}
                />
                <select
                  className="input"
                  value={createCampaignForm.target}
                  onChange={(e) => setCreateCampaignForm({ ...createCampaignForm, target: e.target.value })}
                >
                  <option value="ALL">Tous les utilisateurs</option>
                  <option value="CLIENT">Clients uniquement</option>
                  <option value="DRIVER">Livreurs uniquement</option>
                  <option value="MERCHANT">Commerçants uniquement</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-2">
                  Programmer l'envoi (optionnel)
                </label>
                <input
                  type="datetime-local"
                  className="input"
                  value={createCampaignForm.scheduledAt}
                  onChange={(e) => setCreateCampaignForm({ ...createCampaignForm, scheduledAt: e.target.value })}
                />
                <p className="text-[11px] text-text-tertiary mt-1">
                  Laissez vide pour envoyer immédiatement. Sinon la campagne part
                  automatiquement à l'heure indiquée.
                </p>
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-2">Message *</label>
                <textarea
                  className="input min-h-[100px] resize-y"
                  placeholder="Corps du message (3-1000 caractères) *"
                  value={createCampaignForm.body}
                  onChange={(e) => setCreateCampaignForm({ ...createCampaignForm, body: e.target.value })}
                  required
                  maxLength={1000}
                />
              </div>
              <button type="submit" className="btn-primary gap-2" disabled={createCampaignBusy}>
                <Megaphone size={14} />
                {createCampaignBusy
                  ? 'Envoi en cours…'
                  : createCampaignForm.scheduledAt
                    ? 'Programmer la campagne'
                    : 'Créer et envoyer'}
              </button>
            </form>

            {/* ── Liste des campagnes ────────────────────────── */}
            <div className="card overflow-hidden">
              <div className="px-5 py-3 border-b border-border-light">
                <h3 className="text-[13.5px] font-bold text-text-primary">
                  Historique des campagnes ({pushCampaigns.length})
                </h3>
              </div>
              {pushCampaignsLoading ? (
                <div className="p-8 text-center text-text-tertiary text-sm">Chargement…</div>
              ) : pushCampaigns.length === 0 ? (
                <div className="p-8 text-center text-text-tertiary text-sm">
                  Aucune campagne envoyée. Créez votre première campagne promotionnelle.
                </div>
              ) : (
                <div className="divide-y divide-border-light">
                  {pushCampaigns.map((campaign) => (
                    <div key={campaign.id} className="px-5 py-4 flex flex-col lg:flex-row lg:items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-text-primary truncate">{campaign.title}</p>
                        <p className="text-xs text-text-tertiary truncate">{campaign.body}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-text-tertiary">
                          <span className="flex items-center gap-1">
                            <Bell size={10} />
                            Cible : {campaign.target}
                          </span>
                          <span className="flex items-center gap-1">
                            {campaign.status === 'SCHEDULED' ? (
                              <>
                                <Clock size={10} />
                                Programmée le{' '}
                                {new Date(campaign.scheduledAt).toLocaleString('fr-FR')}
                              </>
                            ) : (
                              <>
                                <Users size={10} />
                                Ciblés : {campaign.targetedCount ?? 0} · Livrés :{' '}
                                {campaign.recipientCount || 0}
                              </>
                            )}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock size={10} />
                            {new Date(campaign.createdAt).toLocaleString('fr-FR')}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ──────────────────────────────────────────────────────── */}
        {/* ONGLET AFFILIATION GLOBALE */}
        {/* ──────────────────────────────────────────────────────── */}
        {activeTab === 'affiliate' && (
          <div className="space-y-6 animate-slide-up">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-text-primary">Affiliation Globale</h2>
                <p className="text-text-secondary text-sm">
                  Vue d'ensemble du programme d'affiliation marchand (clics → inscriptions → commandes).
                </p>
              </div>
              <button onClick={loadAffiliateGlobal} className="btn-secondary gap-2">
                <RefreshCw size={14} className={affiliateLoading ? 'animate-spin' : ''} />
                Actualiser
              </button>
            </div>

            {affiliateError && (
              <div className="card p-4 border-border-error/20 bg-status-error/5">
                <p className="text-status-error text-sm">{affiliateError}</p>
              </div>
            )}

            {affiliateLoading ? (
              <div className="card p-8 text-center">
                <div className="w-8 h-8 border-4 border-accent-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-text-secondary text-sm">Chargement des stats d'affiliation…</p>
              </div>
            ) : affiliateGlobalStats ? (
              <>
                {/* KPIs principaux */}
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                  <StatCard label="Liens créés" value={affiliateGlobalStats.totalLinks || 0} icon={Link2} trend="neutral" />
                  <StatCard label="Total Clics" value={affiliateGlobalStats.totalClicks || 0} icon={ExternalLink} trend={affiliateGlobalStats.totalClicks > 0 ? 'up' : 'neutral'} />
                  <StatCard label="Inscriptions" value={affiliateGlobalStats.totalSignups || 0} icon={Users} trend={affiliateGlobalStats.totalSignups > 0 ? 'up' : 'neutral'} />
                  <StatCard label="Commandes" value={affiliateGlobalStats.totalOrders || 0} icon={ShoppingBag} trend={affiliateGlobalStats.totalOrders > 0 ? 'up' : 'neutral'} />
                  <StatCard label="Revenus totaux" value={`${(affiliateGlobalStats.totalRevenue || 0).toLocaleString()} FCFA`} icon={DollarSign} trend={affiliateGlobalStats.totalRevenue > 0 ? 'up' : 'neutral'} />
                  <StatCard label="Taux conv. global" value={`${(affiliateGlobalStats.totalClicks > 0 ? ((affiliateGlobalStats.totalOrders / affiliateGlobalStats.totalClicks) * 100).toFixed(1) : 0)}%`} icon={BarChart2} trend="neutral" />
                </div>

                {/* Top commerces */}
                <div className="card overflow-hidden">
                  <div className="px-5 py-3 border-b border-border-light">
                    <h3 className="text-[13.5px] font-bold text-text-primary">
                      Top 10 commerces par commandes
                    </h3>
                  </div>
                  {affiliateGlobalStats.topBusinesses && affiliateGlobalStats.topBusinesses.length > 0 ? (
                    <div className="divide-y divide-border-light">
                      {affiliateGlobalStats.topBusinesses.map((biz, idx) => (
                        <div key={biz.businessId} className="px-5 py-4 flex flex-col lg:flex-row lg:items-center gap-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="w-7 h-7 rounded-full bg-accent-primary/15 flex items-center justify-center text-xs font-bold text-accent-primary">
                              {idx + 1}
                            </span>
                            <div>
                              <p className="text-sm font-semibold text-text-primary truncate">{biz.businessName}</p>
                              <p className="text-xs text-text-tertiary">Code : {biz.code || '—'}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-text-tertiary flex-wrap">
                            <span><ExternalLink size={10} /> {biz.clicks || 0} clics</span>
                            <span><Users size={10} /> {biz.signups || 0} inscrits</span>
                            <span><ShoppingBag size={10} /> {biz.orders || 0} commandes</span>
                            <span><DollarSign size={10} /> {biz.revenue || 0} FCFA</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-text-tertiary text-sm">
                      Aucun commerce avec liens d'affiliation pour le moment.
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="card p-12 text-center">
                <BarChart2 size={40} className="mx-auto text-text-tertiary mb-4" strokeWidth={1} />
                <p className="text-text-secondary text-sm font-medium">Aucune donnée d'affiliation</p>
                <p className="text-text-tertiary text-xs mt-1">Les stats apparaîtront dès que des commerçants génèrent des liens.</p>
              </div>
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
                          <span className="px-2.5 py-0.5 rounded-full text-[11.5px] font-semibold bg-background-secondary text-text-secondary">
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
                              onClick={async () => {
                                setKycMsg({ type: 'success', text: 'Chargement du document…' });
                                try {
                                  const url = await getKycDocumentUrl(doc.id);
                                  if (!url) throw new Error('URL vide');
                                  setKycPreview({ url, doc });
                                  setKycMsg(null);
                                } catch (err) {
                                  setKycPreview(null);
                                  setKycMsg({ type: 'error', text: `Impossible d'ouvrir le document : ${err.message}` });
                                }
                              }}
                              className="btn-icon text-accent-primary hover:bg-accent-primary/10"
                              title="Voir le document"
                            >
                              <Eye size={14} />
                            </button>
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
        {/* ONGLET LITIGES (composant partagé, chat support inclus) */}
        {/* ──────────────────────────────────────────────────────── */}
        {activeTab === 'disputes' && <DisputesTab />}

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
                            <span className={`px-2.5 py-0.5 rounded-full text-[11.5px] font-semibold ${statusColors[req.status]}`}>
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
                        onClick={() => { setChatChannel(ch); handleViewChatHistory(selectedChatOrder, ch); }}
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
                          <span className="text-[11px] font-semibold text-text-secondary">{msg.senderRole || 'system'}</span>
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
                  <Crown size={16} className="text-[#241F1B]" /> Catalogue des forfaits
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
                            <span className="px-2.5 py-0.5 rounded-full text-[11.5px] font-semibold bg-background-secondary text-text-secondary">
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
                <Calendar size={16} className="text-[#241F1B]" /> Assigner / Renouveler un abonnement
              </h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[12px] font-semibold text-text-secondary mb-1.5">Sujet</label>
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
                    <label className="block text-[12px] font-semibold text-text-secondary mb-1.5">Commerce</label>
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
                    <label className="block text-[12px] font-semibold text-text-secondary mb-1.5">ID Client (UUID)</label>
                    <input
                      className="input-field"
                      placeholder="UUID du client"
                      value={assignForm.subjectId}
                      onChange={(e) => setAssignForm(prev => ({ ...prev, subjectId: e.target.value }))}
                    />
                  </div>
                )}
                <div>
                  <label className="block text-[12px] font-semibold text-text-secondary mb-1.5">Forfait</label>
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
                  <label className="block text-[12px] font-semibold text-text-secondary mb-1.5">Durée (jours, optionnel)</label>
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
                            <span className="px-2.5 py-0.5 rounded-full text-[11.5px] font-semibold bg-background-secondary text-text-secondary">
                              {sub.subjectType}
                            </span>
                          </td>
                          <td>
                            <p className="font-mono text-text-secondary text-xs">{sub.subjectId}</p>
                          </td>
                          <td>
                            <span className="px-2.5 py-0.5 rounded-full text-[11.5px] font-semibold bg-accent-primary/10 text-accent-primary">
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
                          <span className="px-2.5 py-0.5 rounded-full text-[11.5px] font-semibold bg-background-secondary text-text-secondary">
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
                      <Users size={14} className="text-accent-primary" /> Clients
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
                {settingsSuccess && <span className="text-xs text-status-success font-medium">{settingsSuccess}</span>}
                {settingsError && <span className="text-xs text-status-error font-medium">{settingsError}</span>}
              </div>
            </div>

            {/* Frais de plateforme */}
            <div className="card p-6">
              <h3 className="font-bold text-text-primary mb-4 flex items-center gap-2">
                <DollarSign size={16} className="text-[#241F1B]" />
                Frais de Plateforme (Client)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                <div>
                  <label className="block text-[12px] font-semibold text-text-secondary mb-1.5">Frais de service (FCFA)</label>
                  <input
                    type="number"
                    className="input-field"
                    value={platformSettings.platformFee}
                    onChange={(e) => setPlatformSettings(prev => ({ ...prev, platformFee: Number(e.target.value) }))}
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-text-secondary mb-1.5">Rayon max (km)</label>
                  <input
                    type="number"
                    className="input-field"
                    value={platformSettings.maxDeliveryRadius}
                    onChange={(e) => setPlatformSettings(prev => ({ ...prev, maxDeliveryRadius: Number(e.target.value) }))}
                  />
                </div>
              </div>
            </div>

            {/* Fonctionnalités (Suspendues / Activables) */}
            <div className="card p-6">
              <h3 className="font-bold text-text-primary mb-4">Fonctionnalités</h3>
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-semibold text-text-primary">Pass Stories (5 000 FCFA / 30 j)</p>
                  <p className="text-xs text-text-secondary">Active l'abonnement Pass Stories des commerces. Désactivé = la feature est suspendue.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPlatformSettings(prev => ({ ...prev, storiesPassEnabled: !prev.storiesPassEnabled }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${platformSettings.storiesPassEnabled ? 'bg-accent-primary' : 'bg-border-light'}`}
                  aria-pressed={platformSettings.storiesPassEnabled}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${platformSettings.storiesPassEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>

            {/* 💳 Tarifs des campagnes push auto-service (Lot 3.1) */}
            <div className="card p-6">
              <h3 className="font-bold text-text-primary mb-1 flex items-center gap-2">
                <Megaphone size={16} className="text-[#241F1B]" />
                Tarifs des campagnes push
              </h3>
              <p className="text-xs text-text-secondary mb-4">
                Prix par campagne ENVOYÉE (jamais par destinataire) pour les
                marchands et les agences. « Tous les clients » vise toute la base
                FasoFree : gardez-le nettement plus cher pour décourager le spam.
                Appliqué dès le prochain envoi, y compris aux campagnes
                récurrentes.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[12px] font-semibold text-text-secondary mb-1.5">Mes clients (FCFA)</label>
                  <input
                    type="number"
                    min={0}
                    className="input-field"
                    value={platformSettings.pushCampaignPricing?.OWN_CLIENTS ?? 0}
                    onChange={(e) => setPlatformSettings(prev => ({
                      ...prev,
                      pushCampaignPricing: { ...prev.pushCampaignPricing, OWN_CLIENTS: Number(e.target.value) },
                    }))}
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-text-secondary mb-1.5">Mes livreurs (FCFA)</label>
                  <input
                    type="number"
                    min={0}
                    className="input-field"
                    value={platformSettings.pushCampaignPricing?.OWN_DRIVERS ?? 0}
                    onChange={(e) => setPlatformSettings(prev => ({
                      ...prev,
                      pushCampaignPricing: { ...prev.pushCampaignPricing, OWN_DRIVERS: Number(e.target.value) },
                    }))}
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-text-secondary mb-1.5">Tous les clients (FCFA)</label>
                  <input
                    type="number"
                    min={0}
                    className="input-field"
                    value={platformSettings.pushCampaignPricing?.ALL_CLIENTS ?? 0}
                    onChange={(e) => setPlatformSettings(prev => ({
                      ...prev,
                      pushCampaignPricing: { ...prev.pushCampaignPricing, ALL_CLIENTS: Number(e.target.value) },
                    }))}
                  />
                </div>
              </div>
            </div>

            {/* 🏷️ Catégories de commerces (verticales) — interrupteurs d'activation */}
            <div className="card p-6">
              <h3 className="font-bold text-text-primary mb-1">Catégories de commerces</h3>
              <p className="text-xs text-text-secondary mb-4">
                Activez ou éteignez une verticale. Éteinte, elle disparaît partout
                (filtres du client, formulaires marchand) sans redéploiement. La
                pharmacie est livrée éteinte : activez-la quand vous serez prêt.
              </p>
              <div className="divide-y divide-border-light">
                {businessCategoryOptions.map((cat) => {
                  const isOn = (platformSettings.enabledBusinessCategories || []).includes(cat.value);
                  return (
                    <div key={cat.value} className="flex items-center justify-between py-3">
                      <div className="pr-4">
                        <p className="text-sm font-semibold text-text-primary">{cat.label}</p>
                        <p className="text-xs text-text-secondary">{cat.value}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPlatformSettings(prev => {
                          const current = prev.enabledBusinessCategories || [];
                          const next = current.includes(cat.value)
                            ? current.filter(v => v !== cat.value)
                            : [...current, cat.value];
                          return { ...prev, enabledBusinessCategories: next };
                        })}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isOn ? 'bg-accent-primary' : 'bg-border-light'}`}
                        aria-pressed={isOn}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isOn ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </div>
                  );
                })}
                {businessCategoryOptions.length === 0 && (
                  <p className="py-3 text-xs text-text-secondary">Catalogue indisponible.</p>
                )}
              </div>
            </div>

            {/* 🏷️ F-bis — Sous-catégories manquantes (niveau 2).
                Un commerce sans sous-catégorie est absent des filtres du
                client : ces commerces ont été créés avant le catalogue à
                deux niveaux. */}
            <div className="card p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-text-primary">Sous-catégories des commerces</h3>
                  <p className="text-xs text-text-secondary mt-1 max-w-2xl">
                    Un commerce sans sous-catégorie (niveau 2) est invisible dans les
                    filtres du client. Cinq verticales n'ont qu'une seule valeur
                    possible — elles se complètent en un clic. Un restaurant, lui,
                    demande un choix humain (Fast-Food, Pizzas, Grillades…).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={loadTagging}
                  disabled={taggingLoading}
                  className="btn-secondary gap-2 text-sm"
                >
                  <RefreshCw size={14} className={taggingLoading ? 'animate-spin' : ''} />
                  Rafraîchir
                </button>
              </div>

              {tagMsg && (
                <p
                  className={`mt-3 text-xs font-medium ${
                    tagMsg.type === 'error'
                      ? 'text-status-error'
                      : tagMsg.type === 'warning'
                        ? 'text-status-warning'
                        : 'text-status-success'
                  }`}
                >
                  {tagMsg.text}
                </p>
              )}

              {taggingLoading && !tagging ? (
                <p className="py-4 text-xs text-text-secondary">Chargement…</p>
              ) : !tagging ? (
                <p className="py-4 text-xs text-text-secondary">Données indisponibles.</p>
              ) : tagging.untaggedCount === 0 ? (
                <div className="mt-4 flex items-center gap-2 text-sm text-status-success">
                  <CheckCircle size={16} />
                  Tous les commerces ont une sous-catégorie.
                </div>
              ) : (
                <>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <span className="text-sm font-semibold text-text-primary">
                      {tagging.untaggedCount} commerce(s) sans sous-catégorie
                    </span>
                    {tagging.autoCompletableCount > 0 && (
                      <button
                        type="button"
                        onClick={handleAutoTag}
                        disabled={tagBusy}
                        className="btn-secondary gap-2 text-sm disabled:opacity-50"
                      >
                        ⚡ Compléter automatiquement ({tagging.autoCompletableCount})
                      </button>
                    )}
                    {tagging.truncated && (
                      <span className="text-xs text-text-secondary">
                        (liste bornée à l'affichage — les compteurs sont exacts)
                      </span>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-border-light p-3">
                    <select
                      className="input-field w-64"
                      value={tagTarget}
                      onChange={(e) => setTagTarget(e.target.value)}
                    >
                      <option value="">Choisir la sous-catégorie…</option>
                      {taggingSubCategoryOptions.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleBulkTag}
                      disabled={!tagSelection.length || !tagTarget || tagBusy}
                      className="btn-primary gap-2 text-sm disabled:opacity-50"
                    >
                      Appliquer à la sélection ({tagSelection.length})
                    </button>
                    {tagSelection.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setTagSelection([])}
                        className="text-xs text-text-secondary underline"
                      >
                        Vider la sélection
                      </button>
                    )}
                  </div>

                  <div className="mt-2 divide-y divide-border-light">
                    {tagging.groups
                      .filter((g) => g.count > 0)
                      .map((g) => {
                        const ids = g.businesses.map((b) => b.id);
                        const allSelected =
                          ids.length > 0 && ids.every((id) => tagSelection.includes(id));
                        return (
                          <div key={g.category} className="py-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold text-text-primary">{g.label}</p>
                                <span className="text-xs text-text-secondary">
                                  {g.count} sans sous-catégorie
                                </span>
                                {g.autoCompletable && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent-primary/10 text-accent-primary">
                                    auto
                                  </span>
                                )}
                                {!g.enabled && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-border-light text-text-secondary">
                                    verticale éteinte
                                  </span>
                                )}
                              </div>
                              {ids.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setTagSelection((prev) =>
                                      allSelected
                                        ? prev.filter((id) => !ids.includes(id))
                                        : Array.from(new Set([...prev, ...ids])),
                                    )
                                  }
                                  className="text-xs text-accent-primary font-medium"
                                >
                                  {allSelected ? 'Désélectionner' : 'Tout sélectionner'}
                                </button>
                              )}
                            </div>
                            <p className="mt-1 text-xs text-text-secondary">
                              Sous-catégories valides : {g.subCategories.join(' · ')}
                            </p>
                            <div className="mt-2 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                              {g.businesses.slice(0, 60).map((b) => (
                                <label
                                  key={b.id}
                                  className="flex items-start gap-2 text-xs text-text-secondary"
                                >
                                  <input
                                    type="checkbox"
                                    className="mt-0.5"
                                    checked={tagSelection.includes(b.id)}
                                    onChange={(e) =>
                                      setTagSelection((prev) =>
                                        e.target.checked
                                          ? Array.from(new Set([...prev, b.id]))
                                          : prev.filter((id) => id !== b.id),
                                      )
                                    }
                                  />
                                  <span className="truncate">{b.name}</span>
                                </label>
                              ))}
                            </div>
                            {g.count > Math.min(g.businesses.length, 60) && (
                              <p className="mt-2 text-xs text-text-secondary">
                                Seuls les 60 plus récents sont affichés (sur {g.count}).
                              </p>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </>
              )}
            </div>

            {/* Tranches Tarifaires Livraison */}
            <div className="card p-6">
              <h3 className="font-bold text-text-primary mb-2 flex items-center gap-2">
                <Truck size={16} className="text-[#241F1B]" />
                Tranches Tarifaires — Livraison
              </h3>
              <p className="text-xs text-text-secondary mb-4">
                Prix fixe par palier de distance. La distance est calculée automatiquement entre le restaurant et le point de livraison.
                Surcharge nuit automatique (+500 FCFA) de 21h à 06h.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border-light">
                      <th className="text-left py-2 px-3 text-xs font-semibold text-text-secondary">Palier</th>
                      <th className="text-right py-2 px-3 text-xs font-semibold text-text-secondary">Distance min (km)</th>
                      <th className="text-right py-2 px-3 text-xs font-semibold text-text-secondary">Distance max (km)</th>
                      <th className="text-right py-2 px-3 text-xs font-semibold text-text-secondary">Prix (FCFA)</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(platformSettings.deliveryTiers || []).map((tier, idx) => (
                      <tr key={idx} className="border-b border-border-light/50">
                        <td className="py-2 px-3 font-medium text-text-primary">{tier.label || `Palier ${idx + 1}`}</td>
                        <td className="text-right py-2 px-3">
                          <input
                            type="number"
                            className="input-field w-20 text-right"
                            value={tier.minKm}
                            onChange={(e) => {
                              const newTiers = [...platformSettings.deliveryTiers];
                              newTiers[idx] = { ...newTiers[idx], minKm: Number(e.target.value) };
                              setPlatformSettings(prev => ({ ...prev, deliveryTiers: newTiers }));
                            }}
                          />
                        </td>
                        <td className="text-right py-2 px-3">
                          <input
                            type="number"
                            className="input-field w-20 text-right"
                            placeholder="∞"
                            value={tier.maxKm ?? ''}
                            onChange={(e) => {
                              const newTiers = [...platformSettings.deliveryTiers];
                              newTiers[idx] = { ...newTiers[idx], maxKm: e.target.value === '' ? null : Number(e.target.value) };
                              setPlatformSettings(prev => ({ ...prev, deliveryTiers: newTiers }));
                            }}
                          />
                        </td>
                        <td className="text-right py-2 px-3">
                          <input
                            type="number"
                            className="input-field w-24 text-right"
                            value={tier.price}
                            onChange={(e) => {
                              const newTiers = [...platformSettings.deliveryTiers];
                              newTiers[idx] = { ...newTiers[idx], price: Number(e.target.value) };
                              setPlatformSettings(prev => ({ ...prev, deliveryTiers: newTiers }));
                            }}
                          />
                        </td>
                        <td className="py-2 px-1">
                          <button
                            onClick={() => {
                              const newTiers = platformSettings.deliveryTiers.filter((_, i) => i !== idx);
                              setPlatformSettings(prev => ({ ...prev, deliveryTiers: newTiers }));
                            }}
                            className="text-status-error/60 hover:text-status-error p-1"
                            title="Supprimer"
                          >
                            <XCircle size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                onClick={() => {
                  const lastTier = platformSettings.deliveryTiers[platformSettings.deliveryTiers.length - 1];
                  const newMin = lastTier ? (lastTier.maxKm != null ? lastTier.maxKm + 1 : (lastTier.minKm || 30) + 1) : 0;
                  setPlatformSettings(prev => ({
                    ...prev,
                    deliveryTiers: [
                      ...prev.deliveryTiers,
                      { minKm: newMin, maxKm: null, price: 3750, label: `${newMin}+ km` },
                    ],
                  }));
                }}
                className="mt-3 text-xs text-accent-primary hover:underline flex items-center gap-1"
              >
                + Ajouter un palier
              </button>
            </div>

            {/* Matrice Faso Ride */}
            <div className="card p-6">
              <h3 className="font-bold text-text-primary mb-4 flex items-center gap-2">
                <Car size={16} className="text-[#241F1B]" />
                Matrice Tarifaire — FasoFree Ride
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border-light">
                      <th className="text-left py-2 px-3 text-xs font-semibold text-text-secondary">Option</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-text-secondary">Description</th>
                      <th className="text-right py-2 px-3 text-xs font-semibold text-text-secondary">Tarif Min (FCFA)</th>
                      <th className="text-right py-2 px-3 text-xs font-semibold text-text-secondary">Prix/km (FCFA)</th>
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
                <Settings size={16} className="text-[#241F1B]" />
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
                <KeyRound size={16} className="text-[#241F1B]" /> Créer un compte
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
                <label className="block text-[12px] font-semibold text-text-secondary mb-1.5">Nom complet</label>
                <input
                  className="input-field"
                  placeholder="Ex : Awa Diallo"
                  value={userForm.fullName}
                  onChange={(e) => setUserForm(prev => ({ ...prev, fullName: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-semibold text-text-secondary mb-1.5">Email</label>
                  <input
                    className="input-field"
                    type="email"
                    placeholder="awa@fasofree.bf"
                    value={userForm.email}
                    onChange={(e) => setUserForm(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-text-secondary mb-1.5">Téléphone</label>
                  <input
                    className="input-field"
                    placeholder="+22670000000"
                    value={userForm.phone}
                    onChange={(e) => setUserForm(prev => ({ ...prev, phone: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-text-secondary mb-1.5">Mot de passe (min. 8 caractères)</label>
                <input
                  className="input-field"
                  type="password"
                  placeholder="MotDePasseFort123!"
                  value={userForm.password}
                  onChange={(e) => setUserForm(prev => ({ ...prev, password: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-text-secondary mb-1.5">Rôle</label>
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
                  <label className="block text-[12px] font-semibold text-text-secondary mb-1.5">Code</label>
                  <input
                    className="input-field"
                    value={planForm.code}
                    disabled={!!editingPlan}
                    placeholder="VIP"
                    onChange={(e) => setPlanForm(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-text-secondary mb-1.5">Nom</label>
                  <input
                    className="input-field"
                    value={planForm.name}
                    placeholder="FasoFree Pass VIP"
                    onChange={(e) => setPlanForm(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-text-secondary mb-1.5">Description</label>
                <textarea
                  className="input-field"
                  rows={2}
                  value={planForm.description}
                  onChange={(e) => setPlanForm(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-semibold text-text-secondary mb-1.5">Type de sujet</label>
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
                  <label className="block text-[12px] font-semibold text-text-secondary mb-1.5">Prix (FCFA)</label>
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
                  <label className="block text-[12px] font-semibold text-text-secondary mb-1.5">Durée (jours)</label>
                  <input
                    type="number"
                    className="input-field"
                    value={planForm.durationDays}
                    onChange={(e) => setPlanForm(prev => ({ ...prev, durationDays: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-text-secondary mb-1.5">
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

      {/* Modal Preview KYC */}
      {kycPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setKycPreview(null)}>
          <div className="bg-background-card rounded-xl shadow-lg max-w-2xl w-full max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-border-light flex items-center justify-between">
              <div>
                <h3 className="font-bold text-text-primary">
                  {kycPreview.doc?.type === 'IDENTITY_CARD' ? "Pièce d'identité" : kycPreview.doc?.type === 'DRIVER_LICENSE' ? 'Permis de conduire' : kycPreview.doc?.type === 'VEHICLE_REGISTRATION' ? 'Carte grise du véhicule' : 'Document KYC'}
                </h3>
                <p className="text-xs text-text-secondary">{kycPreview.doc?.ownerName || kycPreview.doc?.ownerEmail || ''}</p>
              </div>
              <button onClick={() => setKycPreview(null)} className="p-1 rounded-lg hover:bg-background-secondary">
                <XCircle size={18} className="text-text-secondary" />
              </button>
            </div>
            <div className="p-4 flex flex-col items-center justify-center bg-black/10" style={{ minHeight: '300px' }}>
              {kycPreview.url ? (
                kycPreview.doc?.mimeType?.startsWith('image/') ? (
                  <img
                    src={kycPreview.url}
                    alt="Document KYC"
                    className="max-w-full max-h-[70vh] object-contain rounded"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      const err = document.createElement('p');
                      err.className = 'text-status-error text-sm';
                      err.textContent = 'Image introuvable ou URL expirée. Réessayez.';
                      e.target.parentElement?.appendChild(err);
                    }}
                  />
                ) : (
                  <iframe src={kycPreview.url} className="w-full h-[70vh] rounded bg-white" title="Document KYC" />
                )
              ) : (
                <p className="text-text-secondary">Chargement…</p>
              )}
            </div>
            <div className="p-4 border-t border-border-light flex gap-3 justify-end">
              <button
                onClick={() => { handleRejectKyc(kycPreview.doc.id); setKycPreview(null); }}
                className="btn-danger text-sm"
              >
                Rejeter
              </button>
              <button
                onClick={() => { handleApproveKyc(kycPreview.doc.id); setKycPreview(null); }}
                className="btn-primary text-sm"
              >
                Approuver
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminDashboard;