/**
 * FasoFree - Support Dashboard
 *
 * Operational dashboard for SUPPORT role with:
 * - Platform overview (no financial data)
 * - Internal team chat
 * - KYC validation queue
 * - Dispute management
 * - Ban request management
 * - Order chat inbox (read-only)
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getChatSocket } from '../services/realtime';
import {
  Layout, Shield, Users, Settings, LogOut,
  TrendingUp, Activity, AlertCircle,
  BadgeCheck, Radio, Ban, MessageSquare, RefreshCw,
  CheckCircle, XCircle, Clock, ShoppingBag, Eye,
  Building2, Link2, CreditCard, Gavel
} from 'lucide-react';
import useAuthStore from '../store/authStore';
import { StatCard, StatusBadge, LoadingSkeleton, EmptyState } from './components/StatCard';
import PageHero from './components/PageHero';
import { getPendingDisputes } from '../services/financialService';
import { getPlatformStats, getBanRequests, createBanRequest, reviewBanRequest, getBanRequestPendingCount, getUsers } from '../services/usersService';
import { getKycPending, approveKyc, rejectKyc, getKycDocumentUrl } from '../services/kycService';
import { getBusinesses } from '../services/subscriptionService';
import { getActiveConversations, getChatHistory } from '../services/usersService';
import InternalChat from '../components/InternalChat';
import NotificationBell from '../components/NotificationBell';
import DisputesTab from './components/DisputesTab';
import UsersBackofficeTab from './components/UsersBackofficeTab';
import AgenciesTab from './components/AgenciesTab';
import AffiliateTab from './components/AffiliateTab';
import PaymentReconciliationTab from './components/PaymentReconciliationTab';
import DeliveryQualityTab from './components/DeliveryQualityTab';

const SupportDashboard = () => {
  const navigate = useNavigate();
  const user = useAuthStore(state => state.user);
  const logout = useAuthStore(state => state.logout);
  const [activeTab, setActiveTab] = useState('overview');

  // Platform stats
  const [platformStats, setPlatformStats] = useState({
    totalMerchants: 0,
    totalClients: 0,
    totalDrivers: 0,
    activeMerchants: 0,
    pendingMerchants: 0,
    agencies: 0,
    totalUsers: 0,
    bannedUsers: 0,
    onlineUsers: 0,
  });

  // Compteur de demandes de bannissement en attente.
  // `null` = indisponible (endpoint non autorisé ou erreur réseau).
  const [pendingBanCount, setPendingBanCount] = useState(null);

  // La décision de bannir/débannir est strictement SUPER_ADMIN côté backend
  // (`POST /ban-requests/:id/review`). Le Support, en lecture seule, ne doit
  // donc pas afficher de boutons de décision qui échoueraient en 403.
  const canReviewBanRequests = user?.role === 'SUPER_ADMIN';

  // Incrémenté pour forcer le rafraîchissement de la liste des comptes.
  const [usersRefreshTick, setUsersRefreshTick] = useState(0);

  const refreshUsersTab = useCallback(() => {
    setUsersRefreshTick((t) => t + 1);
  }, []);

  const loadPendingBanCount = useCallback(async () => {
    setPendingBanCount(await getBanRequestPendingCount());
  }, []);

  // Pending disputes (badge de l'onglet)
  const [pendingDisputes, setPendingDisputes] = useState([]);

  // KYC validation queue
  const [kycPending, setKycPending] = useState([]);
  const [kycBusy, setKycBusy] = useState(null);
  const [kycMsg, setKycMsg] = useState(null);
  const [kycPreview, setKycPreview] = useState(null);

  // Ban requests
  const [banRequests, setBanRequests] = useState([]);
  const [banRequestsLoading, setBanRequestsLoading] = useState(false);
  const [banReviewBusy, setBanReviewBusy] = useState(null);
  const [banRequestsMsg, setBanRequestsMsg] = useState(null);

  // ─── Création d'une demande de bannissement (Support / Admin) ───
  // Le support SOUMET, le Super Admin DÉCIDE. La création est ouverte à
  // ADMIN / SUPPORT / SUPER_ADMIN côté backend (`POST /ban-requests`).
  const [showBanForm, setShowBanForm] = useState(false);
  const [banTargetQuery, setBanTargetQuery] = useState('');
  const [banTargets, setBanTargets] = useState([]);
  const [banTargetsLoading, setBanTargetsLoading] = useState(false);
  const [banTargetId, setBanTargetId] = useState('');
  const [banReason, setBanReason] = useState('');
  const [banSubmitBusy, setBanSubmitBusy] = useState(false);
  const [banFormError, setBanFormError] = useState('');
  const [banFormMsg, setBanFormMsg] = useState(null);

  const searchBanTargets = useCallback(async () => {
    const q = banTargetQuery.trim();
    if (q.length < 2) {
      setBanTargets([]);
      return;
    }
    setBanTargetsLoading(true);
    try {
      const res = await getUsers({ search: q, limit: 20 });
      const list = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
      // On ne propose que des comptes actifs et bannissables : on ne peut pas
      // se bannir soi-même ni cibler un Super Admin (validé côté backend).
      setBanTargets(
        list.filter(
          (u) =>
            u.isActive !== false &&
            u.role !== 'SUPER_ADMIN' &&
            u.role !== 'SUPPORT' &&
            u.role !== 'ADMIN' &&
            u.id !== user?.id,
        ),
      );
    } catch {
      setBanTargets([]);
    } finally {
      setBanTargetsLoading(false);
    }
  }, [banTargetQuery, user?.id]);

  const submitBanRequest = async () => {
    setBanFormError('');
    if (!banTargetId) {
      setBanFormError('Sélectionnez le compte à signaler.');
      return;
    }
    if (banReason.trim().length < 10) {
      setBanFormError('Le motif doit contenir au moins 10 caractères.');
      return;
    }
    setBanSubmitBusy(true);
    try {
      await createBanRequest({ targetUserId: banTargetId, reason: banReason.trim() });
      setBanFormMsg({
        type: 'success',
        text: 'Demande transmise — le Super Admin doit maintenant la valider.',
      });
      setShowBanForm(false);
      setBanTargetId('');
      setBanReason('');
      setBanTargetQuery('');
      setBanTargets([]);
      await loadBanRequests();
      await loadPendingBanCount();
      refreshUsersTab();
    } catch (err) {
      setBanFormError(err?.response?.data?.message || err.message || 'Envoi impossible.');
    } finally {
      setBanSubmitBusy(false);
    }
  };

  // Chat inbox
  const [conversations, setConversations] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [selectedChatOrder, setSelectedChatOrder] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [chatHistoryLoading, setChatHistoryLoading] = useState(false);
  const [chatChannel, setChatChannel] = useState('merchant');
  const [chatInput, setChatInput] = useState('');
  const chatSocketRef = useRef(null);

  // UI states
  const [loading, setLoading] = useState({
    financial: true,
    platform: true,
    kyc: true,
    pending: true,
  });

  // ─── Data Loading ───────────────────────────────────────────

  const loadPlatformStats = useCallback(async () => {
    setLoading(prev => ({ ...prev, platform: true }));
    try {
      const stats = await getPlatformStats();
      setPlatformStats({
        totalMerchants: stats.merchants ?? 0,
        totalClients: stats.clients ?? 0,
        totalDrivers: stats.drivers ?? 0,
        activeMerchants: stats.approvedMerchants ?? 0,
        pendingMerchants: stats.pendingMerchants ?? 0,
        agencies: stats.agencies ?? 0,
        totalUsers: stats.totalUsers ?? 0,
        bannedUsers: stats.bannedUsers ?? 0,
        onlineUsers: stats.onlineUsers ?? 0,
      });
    } catch (err) {
      // Silent fail : on conserve les derniers compteurs connus
    } finally {
      setLoading(prev => ({ ...prev, platform: false }));
    }
  }, []);

  // 🔄 Polling : rafraîchir les stats ET la liste des comptes toutes les
  // 30 secondes pour refléter les inscriptions / bannissements / présences.
  // NB : la liste des comptes a son propre polling dans UsersBackofficeTab ;
  // on ne la sollicite donc pas ici pour éviter une double requête.
  useEffect(() => {
    const interval = setInterval(() => {
      loadPlatformStats();
      loadPendingBanCount();
    }, 30_000);
    return () => clearInterval(interval);
  }, [loadPlatformStats, loadPendingBanCount]);

  const loadPendingDisputes = useCallback(async () => {
    setLoading(prev => ({ ...prev, pending: true }));
    try {
      const disputes = await getPendingDisputes('PENDING_ADMIN_APPROVAL');
      setPendingDisputes(Array.isArray(disputes) ? disputes : []);
    } catch (err) {
      setPendingDisputes([]);
    } finally {
      setLoading(prev => ({ ...prev, pending: false }));
    }
  }, []);

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
    loadPlatformStats();
    loadPendingDisputes();
    loadKyc();
    loadBanRequests();
    loadPendingBanCount();
    loadConversations();
  }, [loadPlatformStats, loadPendingDisputes, loadKyc, loadBanRequests, loadPendingBanCount, loadConversations]);

  // 👁️ Retour sur l'onglet : rattrapage immédiat des compteurs et de la
  // liste des comptes (l'intervalle peut avoir été suspendu en arrière-plan).
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      loadPlatformStats();
      loadBanRequests();
      loadPendingBanCount();
      refreshUsersTab();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [loadPlatformStats, loadBanRequests, loadPendingBanCount, refreshUsersTab]);

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

  // ─── Handlers ───────────────────────────────────────────────

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

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
      // Le bannissement vient de changer le « mouvement des comptes » :
      // on resynchronise stats + badge + liste des comptes.
      await Promise.all([
        loadPlatformStats(),
        loadPendingBanCount(),
      ]);
      refreshUsersTab();
    } catch (err) {
      setBanRequestsMsg({ type: 'error', text: err.message });
    } finally {
      setBanReviewBusy(null);
    }
  };

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
    if (!socket.connected) socket.connect();

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

  // ─── Helpers ────────────────────────────────────────────────

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

  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString('fr-FR') : '—';

  // ─── Tabs ───────────────────────────────────────────────────

  const tabs = [
    { id: 'overview', label: 'Vue d\'ensemble', icon: Layout },
    { id: 'team-chat', label: 'Discussion Équipe', icon: MessageSquare },
    { id: 'kyc', label: 'Validation KYC', icon: BadgeCheck, badge: kycPending.length },
    { id: 'disputes', label: 'Litiges', icon: Shield, badge: pendingDisputes.length },
    { id: 'ban-requests', label: 'Demandes de Ban', icon: Ban, badge: banRequests.filter(b => b.status === 'PENDING').length },
    { id: 'chat-inbox', label: 'Messagerie', icon: MessageSquare },
    { id: 'users-backoffice', label: 'Comptes', icon: Users },
    { id: 'agencies', label: 'Agences', icon: Building2 },
    { id: 'quality', label: 'Qualité livraisons', icon: Gavel },
    { id: 'affiliate', label: 'Affiliation', icon: Link2 },
    { id: 'payments-reconcile', label: 'Paiements', icon: CreditCard },
  ];

  return (
    <div className="min-h-screen bg-background-primary flex">
      {/* ─── SIDEBAR SUPPORT ─────────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-64 bg-background-card border-r border-border-light fixed h-full z-20 overflow-y-auto">
        <div className="p-5 border-b border-border-light">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-accent-primary">
              <span className="text-white font-bold text-sm">SF</span>
            </div>
            <div>
              <p className="text-text-primary font-bold text-sm">FasoFree</p>
              <p className="text-text-tertiary text-xs font-semibold">
                Espace Support
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
              <p className="text-text-primary text-xs font-semibold truncate">{user?.fullName || 'Support'}</p>
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
                  activeTab === tab.id ? 'bg-background-tertiary text-text-primary font-semibold' : 'text-text-secondary hover:bg-background-secondary'
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
            <ShoppingBag size={18} strokeWidth={1.5} />
            <span className="flex-1 text-left">Candidatures</span>
          </button>

          <button
            onClick={() => navigate('/dashboard/live-orders')}
            className="nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-status-success border border-status-success/30 mt-2 hover:bg-status-successBg"
          >
            <Radio size={18} strokeWidth={1.5} />
            <span className="flex-1 text-left">Live Orders</span>
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
        <PageHero
          name={String(user?.fullName || '').trim().split(' ')[0] || 'Support'}
          subtitle="Gestion des validations, litiges et support"
          right={
            <div className="flex items-center gap-3">
              <NotificationBell />
              <span className="px-3 py-1 bg-[#F0E9DD] text-text-secondary text-xs font-bold rounded-full">
                Mode Support
              </span>
            </div>
          }
        />

        {/* ──────────────────────────────────────────────────────── */}
        {/* ONGLET DISCUSSION ÉQUIPE */}
        {/* ──────────────────────────────────────────────────────── */}
        {activeTab === 'team-chat' && (
          <div className="p-6 border border-border-light rounded-xl bg-background-primary">
            <InternalChat currentUser={user} />
          </div>
        )}

        {/* ──────────────────────────────────────────────────────── */}
        {/* ONGLET VUE D'ENSEMBLE */}
        {/* ──────────────────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-slide-up">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                label="Commerçants Actifs"
                value={platformStats.activeMerchants}
                icon={TrendingUp}
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

            {/* Mouvement des comptes : inscrits / présents / bannis */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                label="Utilisateurs Inscrits"
                value={platformStats.totalUsers}
                icon={Users}
                color="#6366F1"
                loading={loading.platform}
              />
              <StatCard
                label="Présents en ligne"
                value={platformStats.onlineUsers}
                icon={Activity}
                color="#22C55E"
                loading={loading.platform}
              />
              <StatCard
                label="Comptes Bannis"
                value={platformStats.bannedUsers}
                icon={Shield}
                color="#EF4444"
                loading={loading.platform}
              />
              <StatCard
                label="Demandes de bannissement"
                value={pendingBanCount ?? '—'}
                icon={Clock}
                color="#F59E0B"
                loading={false}
              />
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
                  Vous soumettez une demande ; le Super Admin décide de bannir ou non.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setShowBanForm((v) => !v);
                    setBanFormError('');
                  }}
                  className="btn-primary gap-2"
                >
                  <Ban size={14} />
                  Demander un bannissement
                </button>
                <button onClick={loadBanRequests} className="btn-secondary gap-2">
                  <RefreshCw size={14} className={banRequestsLoading ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            {/* ─── Formulaire de soumission ─── */}
            {showBanForm && (
              <div className="card p-5 border border-border-light space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-text-primary mb-1">
                    Nouvelle demande de bannissement
                  </h3>
                  <p className="text-xs text-text-secondary">
                    Cette action ne bannit personne : elle soumet une demande qui devra être
                    approuvée par le Super Admin.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">
                    Rechercher le compte concerné
                  </label>
                  <input
                    value={banTargetQuery}
                    onChange={(e) => setBanTargetQuery(e.target.value)}
                    onBlur={searchBanTargets}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); searchBanTargets(); } }}
                    placeholder="Nom, email ou téléphone (2 caractères minimum)"
                    className="w-full px-3 py-2 rounded-lg bg-background-secondary border border-border-light text-sm"
                  />
                  {banTargetsLoading && (
                    <p className="text-xs text-text-tertiary mt-1">Recherche…</p>
                  )}
                  {banTargets.length > 0 && (
                    <ul className="mt-2 max-h-56 overflow-auto border border-border-light rounded-lg divide-y divide-border-light">
                      {banTargets.map((u) => (
                        <li key={u.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setBanTargetId(u.id);
                              setBanTargets([]);
                              setBanTargetQuery(
                                `${u.fullName || '—'} · ${u.email}`,
                              );
                            }}
                            className={`w-full text-left px-3 py-2 text-xs hover:bg-background-secondary ${
                              banTargetId === u.id ? 'bg-background-secondary' : ''
                            }`}
                          >
                            <span className="font-semibold text-text-primary">
                              {u.fullName || '—'}
                            </span>
                            <span className="text-text-secondary"> · {u.email}</span>
                            <span className="ml-1 text-text-tertiary">({u.role})</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {banTargetId && (
                    <p className="text-xs text-status-success mt-1">Compte sélectionné.</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">
                    Motif (10 caractères minimum)
                  </label>
                  <textarea
                    value={banReason}
                    onChange={(e) => setBanReason(e.target.value)}
                    rows={3}
                    placeholder="Ex. : comportement abusif répété envers les livreurs et les clients."
                    className="w-full px-3 py-2 rounded-lg bg-background-secondary border border-border-light text-sm"
                  />
                  <p className="text-xs text-text-tertiary mt-1">
                    {banReason.trim().length}/10 caractères minimum
                  </p>
                </div>

                {banFormError && (
                  <p className="text-xs text-status-error">{banFormError}</p>
                )}

                <div className="flex items-center gap-2">
                  <button
                    onClick={submitBanRequest}
                    disabled={banSubmitBusy}
                    className="btn-primary gap-2"
                  >
                    {banSubmitBusy ? <RefreshCw size={14} className="animate-spin" /> : <Ban size={14} />}
                    Transmettre au Super Admin
                  </button>
                  <button
                    onClick={() => { setShowBanForm(false); setBanFormError(''); }}
                    className="btn-secondary"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}

            {banFormMsg && (
              <div className="bg-status-successBg border border-status-success/30 text-status-success rounded-lg p-3 text-sm">
                {banFormMsg.text}
              </div>
            )}

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
                        {isPending && canReviewBanRequests && (
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
                        {isPending && !canReviewBanRequests && (
                          <div className="shrink-0 text-[10px] text-text-tertiary text-right max-w-[130px] leading-tight border border-border-light rounded px-2 py-1">
                            Décision réservée au Super Admin
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

        {activeTab === 'users-backoffice' && (
          <div className="animate-slide-up">
            <UsersBackofficeTab
              autoRefresh
              refreshIntervalMs={30_000}
              refreshTick={usersRefreshTick}
            />
          </div>
        )}

        {activeTab === 'agencies' && (
          <div className="animate-slide-up">
            <AgenciesTab canManage />
          </div>
        )}

        {activeTab === 'affiliate' && (
          <div className="animate-slide-up">
            <AffiliateTab />
          </div>
        )}

        {activeTab === 'quality' && <DeliveryQualityTab />}

        {activeTab === 'payments-reconcile' && (
          <div className="animate-slide-up">
            <PaymentReconciliationTab />
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
      </main>
    </div>
  );
};

export default SupportDashboard;
