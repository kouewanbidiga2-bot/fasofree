/**
 * FasoFree - Admin Manager Dashboard
 *
 * Administration-level dashboard with:
 * - Simplified platform stats (no financial section)
 * - Internal team chat
 * - KYC validation queue
 * - Pending disputes approval
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Layout, Shield, Users, Settings, LogOut,
  TrendingUp, Activity, AlertCircle,
  BadgeCheck, RefreshCw, CheckCircle, XCircle, MessageSquare, Clock
} from 'lucide-react';
import useAuthStore from '../store/authStore';
import { StatCard, StatusBadge, LoadingSkeleton, EmptyState } from './components/StatCard';
import { getPendingDisputes } from '../services/financialService';
import { approveRefund, rejectDispute } from '../services/disputeService';
import { getBusinesses } from '../services/subscriptionService';
import { getUsers, getActiveConversations, getChatHistory } from '../services/usersService';
import { getKycPending, approveKyc, rejectKyc } from '../services/kycService';
import InternalChat from '../components/InternalChat';
import { getChatSocket } from '../services/realtime';

const AdminManagerDashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [activeTab, setActiveTab] = useState('overview');

  const [platformStats, setPlatformStats] = useState({
    totalMerchants: 0,
    totalClients: 0,
    totalDrivers: 0,
    activeMerchants: 0,
  });

  const [pendingDisputes, setPendingDisputes] = useState([]);
  const [processingDispute, setProcessingDispute] = useState(null);

  const [kycPending, setKycPending] = useState([]);
  const [kycBusy, setKycBusy] = useState(null);
  const [kycMsg, setKycMsg] = useState(null);

  const [loading, setLoading] = useState({
    platform: true,
    kyc: true,
    pending: true,
  });

  // Chat inbox
  const [conversations, setConversations] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [selectedChatOrder, setSelectedChatOrder] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [chatHistoryLoading, setChatHistoryLoading] = useState(false);
  const [chatChannel, setChatChannel] = useState('merchant');
  const [chatInput, setChatInput] = useState('');
  const chatSocketRef = useRef(null);

  const loadPlatformStats = useCallback(async () => {
    setLoading(prev => ({ ...prev, platform: true }));
    try {
      const [usersData, businessesData] = await Promise.all([
        getUsers(),
        getBusinesses(),
      ]);
      const list = Array.isArray(usersData) ? usersData : [];
      const merchants = Array.isArray(businessesData) ? businessesData : [];
      const countRole = (r) =>
        list.filter((u) => String(u.role).toLowerCase().replace('-', '_') === r).length;
      setPlatformStats({
        totalMerchants: merchants.length,
        totalClients: countRole('client') + countRole('customer'),
        totalDrivers: countRole('driver') + countRole('courier'),
        activeMerchants: merchants.filter((b) => b.isActive !== false).length,
      });
    } catch (err) {
      // silent
    } finally {
      setLoading(prev => ({ ...prev, platform: false }));
    }
  }, []);

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

  useEffect(() => {
    loadPlatformStats();
    loadPendingDisputes();
    loadKyc();
  }, [loadPlatformStats, loadPendingDisputes, loadKyc]);

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

  const handleApproveDispute = async (disputeId) => {
    setProcessingDispute(disputeId);
    try {
      await approveRefund(disputeId, 'Remboursement approuvé par l\'administration');
      const disputes = await getPendingDisputes('PENDING_ADMIN_APPROVAL');
      setPendingDisputes(Array.isArray(disputes) ? disputes : []);
    } catch (err) {
      // silent
    } finally {
      setProcessingDispute(null);
    }
  };

  const handleRejectDispute = async (disputeId) => {
    setProcessingDispute(disputeId);
    try {
      await rejectDispute(disputeId, 'Litige rejeté par l\'administration');
      const disputes = await getPendingDisputes('PENDING_ADMIN_APPROVAL');
      setPendingDisputes(Array.isArray(disputes) ? disputes : []);
    } catch (err) {
      // silent
    } finally {
      setProcessingDispute(null);
    }
  };

  const kycTypeLabel = (type) =>
    ({
      IDENTITY_CARD: 'Carte d\'identité',
      DRIVER_LICENSE: 'Permis de conduire',
      VEHICLE_REGISTRATION: 'Carte grise du véhicule',
    })[type] || String(type || '').replace(/_/g, ' ');

  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString('fr-FR') : '—';

  const tabs = [
    { id: 'overview', label: 'Vue d\'ensemble', icon: Layout },
    { id: 'team-chat', label: 'Discussion Équipe', icon: MessageSquare },
    { id: 'kyc', label: 'Validation KYC', icon: BadgeCheck, badge: kycPending.length },
    { id: 'disputes', label: 'Litiges', icon: Shield, badge: pendingDisputes.length },
    { id: 'chat-inbox', label: 'Messagerie', icon: MessageSquare },
  ];

  return (
    <div className="min-h-screen bg-background-primary flex">
      {/* ─── SIDEBAR ADMIN ──────────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-64 bg-background-card border-r border-border-light fixed h-full z-20 overflow-y-auto">
        <div className="p-5 border-b border-border-light">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-accent-primary/15">
              <span className="text-accent-primary font-bold text-sm">SF</span>
            </div>
            <div>
              <p className="text-text-primary font-bold text-sm">FasoFree</p>
              <p className="text-accent-primary text-xs font-semibold">
                Administration
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 border-b border-border-light">
          <div className="flex items-center gap-3">
            <div className="avatar w-9 h-9 bg-accent-primary text-white text-sm font-bold flex items-center justify-center rounded-full">
              {(user?.fullName || 'A').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-text-primary text-xs font-semibold truncate">{user?.fullName || 'Admin'}</p>
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
            <BadgeCheck size={18} strokeWidth={1.5} />
            <span className="flex-1 text-left">Candidatures</span>
          </button>

          <button
            onClick={() => navigate('/dashboard/live-orders')}
            className="nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-status-success border border-status-success/30 mt-2 hover:bg-status-successBg"
          >
            <Activity size={18} strokeWidth={1.5} className="animate-pulse" />
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
        <header className="flex items-center justify-between mb-8 pb-4 border-b border-border-light">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Administration</h1>
            <p className="text-text-secondary text-sm">Gestion de la plateforme FasoFree</p>
          </div>
          <span className="px-3 py-1 bg-accent-primary/10 text-accent-primary text-xs font-bold rounded-full">
            Mode Admin
          </span>
        </header>

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
                icon={Users}
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
              <button onClick={loadPendingDisputes} className="btn-secondary gap-2">
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
      </main>
    </div>
  );
};

export default AdminManagerDashboard;
