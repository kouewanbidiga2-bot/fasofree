/**
 * FasoFree — Driver Dashboard
 * 
 * Delivery operations center with:
 * - Online/offline status toggle
 * - Job queue with filtering and acceptance
 * - Delivery workflow management
 * - Earnings tracking and wallet overview
 * - Delivery history with ratings
 * - Real-time location updates
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Layout, MapPin, Clock, DollarSign, Star, LogOut,
  RefreshCw, AlertCircle, CheckCircle, XCircle, Navigation,
  TrendingUp, Wallet, Phone, MessageSquare, Power, PowerOff,
  Calendar, History, Package, Route
} from 'lucide-react';
import useAuthStore from '../store/authStore';
import { StatCard, StatusBadge, LoadingSkeleton, EmptyState } from './components/StatCard';
import { getAvailableOrders, acceptOrder, confirmDelivery, updateDriverLocation } from '../services/orderService';
import { getWallet } from '../services/walletService';
import { DriverStatus } from '../types';

const DriverDashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [activeTab, setActiveTab] = useState('jobs');

  // Driver status
  const [driverStatus, setDriverStatus] = useState(DriverStatus.OFFLINE);
  const [currentLocation, setCurrentLocation] = useState(null);

  // Available jobs
  const [availableJobs, setAvailableJobs] = useState([]);
  const [currentJob, setCurrentJob] = useState(null);
  const [acceptingJob, setAcceptingJob] = useState(null);

  // Earnings and wallet
  const [wallet, setWallet] = useState(null);
  const [earnings, setEarnings] = useState({
    today: 0,
    week: 0,
    month: 0,
    totalDeliveries: 0,
    averageRating: 0,
  });

  // Delivery history
  const [deliveryHistory, setDeliveryHistory] = useState([]);

  // UI states
  const [loading, setLoading] = useState({
    jobs: true,
    wallet: true,
    history: true,
    earnings: true,
  });
  const [errors, setErrors] = useState({});

  const setError = (key, msg) => setErrors(prev => ({ ...prev, [key]: msg }));
  const setLoad = (key, val) => setLoading(prev => ({ ...prev, [key]: val }));

  // ─── Load Available Jobs ─────────────────────────────────────────────
  const loadAvailableJobs = useCallback(async () => {
    if (driverStatus !== DriverStatus.ONLINE) return;
    setLoad('jobs', true);
    try {
      // Mock data - replace with actual API call
      setTimeout(() => {
        setAvailableJobs([
          {
            id: 'JOB-001',
            orderId: 'ORD-1234',
            pickupAddress: 'Maquis Le 20, Patte d\'Oie',
            pickupCoords: { lat: 12.3714, lng: -1.5196 },
            deliveryAddress: 'Quartier Patte d\'Oie, Rue 23',
            deliveryCoords: { lat: 12.3744, lng: -1.5226 },
            customerName: 'Jean Kabore',
            customerPhone: '+226 70 00 00 00',
            businessName: 'Maquis Le 20',
            estimatedTime: 15,
            distance: 2.3,
            deliveryFee: 1500,
            items: ['2x Poulet bicyclette', '1x Riz gras'],
          },
          {
            id: 'JOB-002',
            orderId: 'ORD-1235',
            pickupAddress: 'Pharmacie Centrale, Centre-ville',
            pickupCoords: { lat: 12.3584, lng: -1.5356 },
            deliveryAddress: 'Koulouba, Villa 45',
            deliveryCoords: { lat: 12.3624, lng: -1.5416 },
            customerName: 'Aisha Sanou',
            customerPhone: '+226 76 11 22 33',
            businessName: 'Pharmacie Centrale',
            estimatedTime: 25,
            distance: 4.1,
            deliveryFee: 2200,
            items: ['Médicaments ordonnance'],
          },
        ]);
        setLoad('jobs', false);
      }, 600);
    } catch (err) {
      setError('jobs', err.message);
      setLoad('jobs', false);
    }
  }, [driverStatus]);

  // ─── Load Wallet and Earnings ───────────────────────────────────────
  const loadWallet = useCallback(async () => {
    if (!user?.id) return;
    setLoad('wallet', true);
    try {
      const data = await getWallet('driver', user.id);
      setWallet(data);
      setLoad('wallet', false);
    } catch (err) {
      setError('wallet', err.message);
      setLoad('wallet', false);
    }
  }, [user?.id]);

  const loadEarnings = useCallback(async () => {
    setLoad('earnings', true);
    try {
      // Mock data - replace with actual API call
      setTimeout(() => {
        setEarnings({
          today: 12500,
          week: 67800,
          month: 245000,
          totalDeliveries: 156,
          averageRating: 4.7,
        });
        setLoad('earnings', false);
      }, 500);
    } catch (err) {
      setError('earnings', err.message);
      setLoad('earnings', false);
    }
  }, []);

  // ─── Load Delivery History ───────────────────────────────────────────
  const loadDeliveryHistory = useCallback(async () => {
    setLoad('history', true);
    try {
      // Mock data - replace with actual API call
      setTimeout(() => {
        setDeliveryHistory([
          {
            id: 'DEL-001',
            orderId: 'ORD-1230',
            customerName: 'Paul Zongo',
            deliveryAddress: 'Wendt-Koudi',
            deliveredAt: '2026-08-13T10:30:00Z',
            deliveryFee: 1800,
            tip: 500,
            rating: 5,
            totalEarnings: 2300,
          },
          {
            id: 'DEL-002',
            orderId: 'ORD-1231',
            customerName: 'Marie Compaoré',
            deliveryAddress: 'Zone 1',
            deliveredAt: '2026-08-13T09:15:00Z',
            deliveryFee: 1200,
            tip: 0,
            rating: 4,
            totalEarnings: 1200,
          },
        ]);
        setLoad('history', false);
      }, 700);
    } catch (err) {
      setError('history', err.message);
      setLoad('history', false);
    }
  }, []);

  useEffect(() => {
    loadWallet();
    loadEarnings();
    loadDeliveryHistory();
  }, [loadWallet, loadEarnings, loadDeliveryHistory]);

  useEffect(() => {
    if (driverStatus === DriverStatus.ONLINE) {
      loadAvailableJobs();
      // Refresh jobs every 30 seconds
      const interval = setInterval(loadAvailableJobs, 30000);
      return () => clearInterval(interval);
    }
  }, [driverStatus, loadAvailableJobs]);

  // ─── Actions ─────────────────────────────────────────────────────────
  const toggleDriverStatus = () => {
    const newStatus = driverStatus === DriverStatus.ONLINE ? DriverStatus.OFFLINE : DriverStatus.ONLINE;
    setDriverStatus(newStatus);
    if (newStatus === DriverStatus.OFFLINE) {
      setAvailableJobs([]);
    }
  };

  const handleAcceptJob = async (jobId) => {
    setAcceptingJob(jobId);
    try {
      const job = availableJobs.find(j => j.id === jobId);
      await acceptOrder(job.orderId);
      setCurrentJob(job);
      setAvailableJobs(prev => prev.filter(j => j.id !== jobId));
    } catch (err) {
      setError('jobs', err.message);
    } finally {
      setAcceptingJob(null);
    }
  };

  const handleCompleteDelivery = async () => {
    if (!currentJob) return;
    try {
      await confirmDelivery(currentJob.orderId, {
        proofOfDelivery: 'SIGNATURE',
        notes: 'Livraison effectuée avec succès',
      });
      setDeliveryHistory(prev => [{
        id: `DEL-${Date.now()}`,
        orderId: currentJob.orderId,
        customerName: currentJob.customerName,
        deliveryAddress: currentJob.deliveryAddress,
        deliveredAt: new Date().toISOString(),
        deliveryFee: currentJob.deliveryFee,
        tip: 0,
        rating: 0,
        totalEarnings: currentJob.deliveryFee,
      }, ...prev]);
      setCurrentJob(null);
      loadEarnings();
      loadWallet();
    } catch (err) {
      setError('jobs', err.message);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const tabs = [
    { id: 'jobs', label: 'Courses', icon: Package, badge: availableJobs.length },
    { id: 'earnings', label: 'Gains', icon: DollarSign },
    { id: 'history', label: 'Historique', icon: History },
    { id: 'settings', label: 'Paramètres', icon: Layout },
  ];

  return (
    <div className="min-h-screen bg-background-primary flex">
      {/* ─── SIDEBAR DRIVER ─────────────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-60 bg-background-card border-r border-border-light fixed h-full z-20">
        <div className="p-5 border-b border-border-light">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-accent-primary/15">
              <Navigation size={16} className="text-accent-primary" />
            </div>
            <div>
              <p className="text-text-primary font-bold text-sm">FasoFree</p>
              <p className="text-text-tertiary text-xs">Dashboard Livreur</p>
            </div>
          </div>
        </div>

        <div className="p-4 border-b border-border-light">
          <div className="flex items-center gap-3">
            <div className="avatar w-9 h-9 text-sm flex-shrink-0">
              {(user?.fullName || 'L').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-text-primary text-xs font-semibold truncate">{user?.fullName || 'Livreur'}</p>
              <p className="text-text-tertiary text-xs truncate">{user?.phone || ''}</p>
            </div>
          </div>
        </div>

        {/* Status Toggle */}
        <div className="p-4 border-b border-border-light">
          <button
            onClick={toggleDriverStatus}
            className={`w-full py-3 px-4 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-colors ${
              driverStatus === DriverStatus.ONLINE
                ? 'bg-status-success text-white'
                : 'bg-background-secondary text-text-secondary'
            }`}
          >
            {driverStatus === DriverStatus.ONLINE ? (
              <>
                <Power size={16} /> En ligne
              </>
            ) : (
              <>
                <PowerOff size={16} /> Hors ligne
              </>
            )}
          </button>
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
          <div className="flex items-center gap-2">
            <Navigation size={16} className="text-accent-primary" />
            <p className="text-text-primary font-bold">FasoFree Livreur</p>
          </div>
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
          {/* ONGLET COURSES */}
          {/* ──────────────────────────────────────────────────────── */}
          {activeTab === 'jobs' && (
            <div className="animate-slide-up">
              <div className="flex items-center justify-between mb-6">
                <h1 className="text-xl font-bold text-text-primary">Courses Disponibles</h1>
                <button onClick={loadAvailableJobs} className="btn-secondary gap-2 text-xs">
                  <RefreshCw size={12} className={loading.jobs ? 'animate-spin' : ''} />
                </button>
              </div>

              {/* Current Job */}
              {currentJob && (
                <div className="mb-6 p-4 bg-accent-primary/10 border border-accent-primary/30 rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <Navigation size={16} className="text-accent-primary" />
                    <h2 className="font-bold text-text-primary">Course en cours</h2>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-status-successBg flex items-center justify-center flex-shrink-0">
                        <Package size={14} className="text-status-success" />
                      </div>
                      <div>
                        <p className="text-xs text-text-secondary">Retrait</p>
                        <p className="text-sm font-semibold text-text-primary">{currentJob.pickupAddress}</p>
                        <p className="text-xs text-text-tertiary">{currentJob.businessName}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-accent-primary/10 flex items-center justify-center flex-shrink-0">
                        <MapPin size={14} className="text-accent-primary" />
                      </div>
                      <div>
                        <p className="text-xs text-text-secondary">Livraison</p>
                        <p className="text-sm font-semibold text-text-primary">{currentJob.deliveryAddress}</p>
                        <p className="text-xs text-text-tertiary">{currentJob.customerName}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button className="btn-secondary flex-1 gap-2">
                        <Phone size={14} /> Appeler client
                      </button>
                      <button className="btn-secondary flex-1 gap-2">
                        <MessageSquare size={14} /> Message
                      </button>
                    </div>
                    <button onClick={handleCompleteDelivery} className="btn-primary w-full">
                      Confirmer la livraison
                    </button>
                  </div>
                </div>
              )}

              {/* Available Jobs */}
              {driverStatus === DriverStatus.OFFLINE ? (
                <div className="card p-8 text-center">
                  <PowerOff size={48} className="mx-auto text-text-tertiary mb-4" />
                  <h3 className="text-base font-bold text-text-primary mb-2">Vous êtes hors ligne</h3>
                  <p className="text-text-secondary text-sm max-w-md mx-auto mb-4">
                    Passez en ligne pour recevoir des courses disponibles dans votre zone.
                  </p>
                  <button onClick={toggleDriverStatus} className="btn-primary">
                    Passer en ligne
                  </button>
                </div>
              ) : loading.jobs ? (
                <div className="space-y-3">
                  {[1,2].map(i => (
                    <div key={i} className="card p-5">
                      <LoadingSkeleton height="h-4" className="mb-2" />
                      <LoadingSkeleton height="h-3" width="w-2/3" />
                    </div>
                  ))}
                </div>
              ) : availableJobs.length === 0 ? (
                <EmptyState
                  icon={Package}
                  title="Aucune course disponible"
                  description="Les courses disponibles apparaîtront ici. Soyez patient!"
                />
              ) : (
                <div className="space-y-3">
                  {availableJobs.map(job => (
                    <div key={job.id} className="card p-5">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 rounded-full bg-status-successBg flex items-center justify-center">
                              <Package size={14} className="text-status-success" />
                            </div>
                            <div>
                              <p className="text-xs text-text-secondary">Retrait</p>
                              <p className="text-sm font-semibold text-text-primary">{job.pickupAddress}</p>
                              <p className="text-xs text-text-tertiary">{job.businessName}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-accent-primary/10 flex items-center justify-center">
                              <MapPin size={14} className="text-accent-primary" />
                            </div>
                            <div>
                              <p className="text-xs text-text-secondary">Livraison</p>
                              <p className="text-sm font-semibold text-text-primary">{job.deliveryAddress}</p>
                              <p className="text-xs text-text-tertiary">{job.customerName}</p>
                            </div>
                          </div>
                        </div>
                        <div className="text-right ml-4">
                          <p className="text-lg font-bold text-accent-primary">{job.deliveryFee.toLocaleString()} FCFA</p>
                          <div className="flex items-center gap-1 text-xs text-text-secondary mt-1">
                            <Clock size={12} />
                            {job.estimatedTime} min
                          </div>
                          <div className="flex items-center gap-1 text-xs text-text-secondary">
                            <Route size={12} />
                            {job.distance} km
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAcceptJob(job.id)}
                          disabled={acceptingJob === job.id}
                          className="btn-primary flex-1"
                        >
                          {acceptingJob === job.id ? '...' : 'Accepter'}
                        </button>
                        <button className="btn-secondary flex-1 gap-2">
                          <Navigation size={14} /> Voir l'itinéraire
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ──────────────────────────────────────────────────────── */}
          {/* ONGLET GAINS */}
          {/* ──────────────────────────────────────────────────────── */}
          {activeTab === 'earnings' && (
            <div className="animate-slide-up">
              <div className="flex items-center justify-between mb-6">
                <h1 className="text-xl font-bold text-text-primary">Vos Gains</h1>
                <button onClick={loadEarnings} className="btn-secondary gap-2 text-xs">
                  <RefreshCw size={12} className={loading.earnings ? 'animate-spin' : ''} />
                </button>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <StatCard
                  label="Aujourd'hui"
                  value={`${earnings.today.toLocaleString()} FCFA`}
                  icon={Calendar}
                  color="#3B82F6"
                  loading={loading.earnings}
                />
                <StatCard
                  label="Cette semaine"
                  value={`${earnings.week.toLocaleString()} FCFA`}
                  icon={TrendingUp}
                  color="#22C55E"
                  loading={loading.earnings}
                />
                <StatCard
                  label="Ce mois"
                  value={`${earnings.month.toLocaleString()} FCFA`}
                  icon={DollarSign}
                  color="#C1652E"
                  loading={loading.earnings}
                />
                <StatCard
                  label="Livraisons"
                  value={earnings.totalDeliveries}
                  icon={Package}
                  color="#F59E0B"
                  loading={loading.earnings}
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="card p-5">
                  <h3 className="font-bold text-text-primary mb-2 flex items-center gap-2">
                    <Star size={16} className="text-yellow-500" />
                    Note moyenne
                  </h3>
                  <p className="text-3xl font-bold text-text-primary">{earnings.averageRating.toFixed(1)}/5.0</p>
                  <p className="text-xs text-text-secondary mt-1">Basée sur {earnings.totalDeliveries} livraisons</p>
                </div>
                <div className="card p-5">
                  <h3 className="font-bold text-text-primary mb-2 flex items-center gap-2">
                    <Wallet size={16} className="text-accent-primary" />
                    Solde disponible
                  </h3>
                  <p className="text-3xl font-bold text-text-primary">{(wallet?.balance || 0).toLocaleString()} FCFA</p>
                  <p className="text-xs text-text-secondary mt-1">Portefeuille FasoFree</p>
                </div>
              </div>
            </div>
          )}

          {/* ──────────────────────────────────────────────────────── */}
          {/* ONGLET HISTORIQUE */}
          {/* ──────────────────────────────────────────────────────── */}
          {activeTab === 'history' && (
            <div className="animate-slide-up">
              <div className="flex items-center justify-between mb-6">
                <h1 className="text-xl font-bold text-text-primary">Historique des Livraisons</h1>
                <button onClick={loadDeliveryHistory} className="btn-secondary gap-2 text-xs">
                  <RefreshCw size={12} className={loading.history ? 'animate-spin' : ''} />
                </button>
              </div>

              {loading.history ? (
                <div className="space-y-3">
                  {[1,2,3].map(i => (
                    <div key={i} className="card p-5">
                      <LoadingSkeleton height="h-4" className="mb-2" />
                      <LoadingSkeleton height="h-3" width="w-2/3" />
                    </div>
                  ))}
                </div>
              ) : deliveryHistory.length === 0 ? (
                <EmptyState
                  icon={History}
                  title="Aucune livraison effectuée"
                  description="Votre historique de livraisons apparaîtra ici."
                />
              ) : (
                <div className="space-y-3">
                  {deliveryHistory.map(delivery => (
                    <div key={delivery.id} className="card p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-bold text-text-primary text-sm">{delivery.customerName}</h3>
                          <p className="text-xs text-text-secondary">{delivery.deliveryAddress}</p>
                          <p className="text-xs text-text-tertiary mt-1">
                            {new Date(delivery.deliveredAt).toLocaleDateString('fr-FR')} à {new Date(delivery.deliveredAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-accent-primary">{delivery.totalEarnings.toLocaleString()} FCFA</p>
                          {delivery.rating > 0 && (
                            <div className="flex items-center gap-1 mt-1">
                              <Star size={12} className="text-yellow-500 fill-yellow-500" />
                              <span className="text-xs font-semibold text-text-primary">{delivery.rating}/5</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-text-secondary">
                        <span>Frais: {delivery.deliveryFee.toLocaleString()} FCFA</span>
                        {delivery.tip > 0 && <span>Pourboire: {delivery.tip.toLocaleString()} FCFA</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ──────────────────────────────────────────────────────── */}
          {/* ONGLET PARAMÈTRES */}
          {/* ──────────────────────────────────────────────────────── */}
          {activeTab === 'settings' && (
            <div className="animate-slide-up">
              <h1 className="text-xl font-bold text-text-primary mb-6">Paramètres du Livreur</h1>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="card p-5">
                  <h3 className="font-bold text-text-primary mb-2">Profil</h3>
                  <p className="text-text-secondary text-xs mb-4">Modifiez vos informations personnelles.</p>
                  <button disabled className="btn-secondary w-full opacity-50">Modifier</button>
                </div>
                <div className="card p-5">
                  <h3 className="font-bold text-text-primary mb-2">Véhicule</h3>
                  <p className="text-text-secondary text-xs mb-4">Type de véhicule et informations.</p>
                  <button disabled className="btn-secondary w-full opacity-50">Modifier</button>
                </div>
                <div className="card p-5">
                  <h3 className="font-bold text-text-primary mb-2">Préférences de livraison</h3>
                  <p className="text-text-secondary text-xs mb-4">Zones de livraison et horaires.</p>
                  <button disabled className="btn-secondary w-full opacity-50">Configurer</button>
                </div>
                <div className="card p-5">
                  <h3 className="font-bold text-text-primary mb-2">Notifications</h3>
                  <p className="text-text-secondary text-xs mb-4">Gérez vos préférences de notification.</p>
                  <button disabled className="btn-secondary w-full opacity-50">Configurer</button>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
};

export default DriverDashboard;