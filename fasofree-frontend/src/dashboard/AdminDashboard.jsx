/**
 * FasoFree — Admin Dashboard
 * Vue d'ensemble pour super_admin, admin, support_admin
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Users, LifeBuoy, Settings, LogOut, 
  TrendingUp, Activity, DollarSign, RefreshCw, 
  AlertCircle, Shield, ShoppingCart
} from 'lucide-react';
import useAuthStore from '../store/authStore';
import { getAllUsers } from '../services/authService';
import { getFinancialDashboard } from '../services/walletService';

const Skeleton = ({ className = '' }) => (
  <div className={`skeleton rounded-md ${className}`} />
);

const StatCard = ({ label, value, icon: Icon, color, loading }) => (
  <div className="stat-card animate-slide-up">
    <div className="flex items-center gap-2 mb-3">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color}20`, border: `1px solid ${color}30` }}>
        <Icon size={16} style={{ color }} strokeWidth={2} />
      </div>
      <p className="text-text-secondary text-xs font-bold uppercase tracking-wider">{label}</p>
    </div>
    {loading ? (
      <Skeleton className="h-8 w-24 mt-1" />
    ) : (
      <p className="text-2xl font-bold text-text-primary">{value ?? '—'}</p>
    )}
  </div>
);

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [activeTab, setActiveTab] = useState('overview');

  // Données
  const [finance, setFinance] = useState(null);
  const [usersList, setUsersList] = useState([]);
  
  // États
  const [loading, setLoading] = useState({ finance: true, users: true });
  const [errors, setErrors] = useState({});
  const [roleFilter, setRoleFilter] = useState('ALL');

  const isSuperAdmin = user?.role === 'super_admin';
  const isSupport = user?.role === 'support_admin';

  // Navigation dynamique
  const tabs = [
    { id: 'overview', label: 'Vue d\'ensemble', icon: LayoutDashboard, show: true },
    { id: 'users', label: 'Utilisateurs', icon: Users, show: isSuperAdmin || user?.role === 'admin' },
    { id: 'support', label: 'Support & Tickets', icon: LifeBuoy, show: isSupport || isSuperAdmin },
    { id: 'settings', label: 'Paramètres système', icon: Settings, show: isSuperAdmin },
  ].filter(t => t.show);

  useEffect(() => {
    // Activer le premier onglet disponible si 'overview' n'est pas dispo (bien que 'overview' soit toujours dispo)
    if (!tabs.find(t => t.id === activeTab)) {
      setActiveTab(tabs[0]?.id || 'overview');
    }
  }, [tabs, activeTab]);

  const loadFinance = useCallback(async () => {
    setLoading(p => ({ ...p, finance: true }));
    try {
      const data = await getFinancialDashboard();
      setFinance(data);
    } catch (err) {
      setErrors(p => ({ ...p, finance: err.message }));
    } finally {
      setLoading(p => ({ ...p, finance: false }));
    }
  }, []);

  const loadUsers = useCallback(async () => {
    setLoading(p => ({ ...p, users: true }));
    try {
      const data = await getAllUsers();
      setUsersList(Array.isArray(data) ? data : []);
    } catch (err) {
      setErrors(p => ({ ...p, users: err.message }));
    } finally {
      setLoading(p => ({ ...p, users: false }));
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'overview') loadFinance();
    if (activeTab === 'users' && usersList.length === 0) loadUsers();
  }, [activeTab, loadFinance, loadUsers, usersList.length]);

  const filteredUsers = roleFilter === 'ALL' 
    ? usersList 
    : usersList.filter(u => u.role === roleFilter);

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-background-primary flex">
      {/* ─── SIDEBAR ─────────────────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-60 bg-background-card border-r border-border-light fixed h-full z-20">
        <div className="p-5 border-b border-border-light">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-accent-primary text-white shadow-glow-sm">
              <Shield size={16} />
            </div>
            <div>
              <p className="text-text-primary font-bold text-sm leading-tight">FasoFree</p>
              <p className="text-accent-primary text-[10px] font-bold uppercase tracking-wider">Administration</p>
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
              </button>
            );
          })}
        </div>

        <div className="p-4 sm:p-6 lg:p-8">
          
          {/* ──────────────────────────────────────────────────────── */}
          {/* ONGLET VUE D'ENSEMBLE                                    */}
          {/* ──────────────────────────────────────────────────────── */}
          {activeTab === 'overview' && (
            <div className="animate-slide-up">
              <div className="flex items-center justify-between mb-6">
                <h1 className="text-xl font-bold text-text-primary">Vue d'ensemble Financière</h1>
                <button onClick={loadFinance} className="btn-secondary gap-2 text-xs">
                  <RefreshCw size={12} className={loading.finance ? 'animate-spin' : ''} /> Actualiser
                </button>
              </div>

              {errors.finance && (
                <div className="mb-6 p-3 bg-status-errorBg border border-status-error/30 rounded-md text-status-error text-sm flex items-center gap-2">
                  <AlertCircle size={14} /> {errors.finance}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <StatCard
                  label="Volume Global (GMV)"
                  value={`${(finance?.totalGMV || 0).toLocaleString()} FCFA`}
                  icon={TrendingUp}
                  color="#3B82F6"
                  loading={loading.finance}
                />
                <StatCard
                  label="Revenus Plateforme"
                  value={`${(finance?.platformRevenue || 0).toLocaleString()} FCFA`}
                  icon={DollarSign}
                  color="#C1652E"
                  loading={loading.finance}
                />
                <StatCard
                  label="Transactions réussies"
                  value={finance?.successfulTransactions || 0}
                  icon={Activity}
                  color="#22C55E"
                  loading={loading.finance}
                />
              </div>

              <div className="card p-6">
                <h2 className="text-sm font-bold text-text-primary mb-4 flex items-center gap-2">
                  <Activity size={16} className="text-accent-primary" /> Activité récente
                </h2>
                <div className="text-center py-10">
                  <p className="text-text-secondary text-sm">Graphiques et statistiques détaillées à venir.</p>
                </div>
              </div>
            </div>
          )}

          {/* ──────────────────────────────────────────────────────── */}
          {/* ONGLET UTILISATEURS                                      */}
          {/* ──────────────────────────────────────────────────────── */}
          {activeTab === 'users' && (
            <div className="animate-slide-up">
              <div className="flex flex-wrap gap-4 items-center justify-between mb-6">
                <h1 className="text-xl font-bold text-text-primary">Gestion des utilisateurs</h1>
                <div className="flex gap-2">
                  <select 
                    className="input-field py-1.5 text-xs"
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                  >
                    <option value="ALL">Tous les rôles</option>
                    <option value="client">Clients</option>
                    <option value="driver">Livreurs</option>
                    <option value="business_admin">Commerçants</option>
                    <option value="super_admin">Super Admins</option>
                  </select>
                  <button onClick={loadUsers} className="btn-secondary gap-2 text-xs">
                    <RefreshCw size={12} className={loading.users ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>

              {errors.users && (
                <div className="mb-6 p-3 bg-status-errorBg border border-status-error/30 rounded-md text-status-error text-sm flex items-center gap-2">
                  <AlertCircle size={14} /> {errors.users}
                </div>
              )}

              <div className="card overflow-hidden">
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Utilisateur</th>
                        <th>Contact</th>
                        <th>Rôle</th>
                        <th>Date d'inscription</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading.users ? (
                        [1,2,3,4].map(i => (
                          <tr key={i}>
                            <td colSpan="4"><Skeleton className="h-8 w-full" /></td>
                          </tr>
                        ))
                      ) : filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan="4" className="text-center py-8 text-text-secondary">Aucun utilisateur trouvé</td>
                        </tr>
                      ) : (
                        filteredUsers.map(u => (
                          <tr key={u.id}>
                            <td>
                              <p className="font-bold text-text-primary text-sm">{u.fullName}</p>
                              <p className="text-text-tertiary text-xs font-mono">{u.id?.slice(0,8)}...</p>
                            </td>
                            <td>
                              <p className="text-text-secondary text-xs">{u.email}</p>
                              <p className="text-text-secondary text-xs">{u.phone || '—'}</p>
                            </td>
                            <td>
                              <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                                u.role === 'super_admin' ? 'bg-status-errorBg text-status-error' :
                                u.role === 'business_admin' ? 'bg-status-infoBg text-status-info' :
                                u.role === 'driver' ? 'bg-status-warningBg text-status-warning' :
                                'bg-background-secondary text-text-secondary'
                              }`}>
                                {u.role}
                              </span>
                            </td>
                            <td>
                              <span className="text-text-tertiary text-xs">
                                {u.createdAt ? new Date(u.createdAt).toLocaleDateString('fr-FR') : '—'}
                              </span>
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
          {/* ONGLET SUPPORT                                           */}
          {/* ──────────────────────────────────────────────────────── */}
          {activeTab === 'support' && (
            <div className="animate-slide-up">
              <h1 className="text-xl font-bold text-text-primary mb-6">Support & Supervision</h1>
              <div className="card p-8 text-center border-dashed border-2 border-border-medium bg-background-secondary/50">
                <LifeBuoy size={48} className="mx-auto text-text-tertiary mb-4" strokeWidth={1} />
                <h3 className="text-base font-bold text-text-primary mb-2">Module de Support (Bientôt)</h3>
                <p className="text-text-secondary text-sm max-w-md mx-auto">
                  Cette section permettra de voir les tickets clients, les commandes signalées et de prendre la main sur les assignations de coursiers.
                </p>
              </div>
            </div>
          )}

          {/* ──────────────────────────────────────────────────────── */}
          {/* ONGLET PARAMÈTRES                                        */}
          {/* ──────────────────────────────────────────────────────── */}
          {activeTab === 'settings' && (
            <div className="animate-slide-up">
              <h1 className="text-xl font-bold text-text-primary mb-6">Paramètres système</h1>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="card p-5">
                  <h3 className="font-bold text-text-primary mb-2">Configuration Stripe / API</h3>
                  <p className="text-text-secondary text-xs mb-4">Gérez les clés d'API partenaires (Wave, LigdiCash, Maps).</p>
                  <button disabled className="btn-secondary w-full opacity-50">Accéder aux clés</button>
                </div>
                <div className="card p-5">
                  <h3 className="font-bold text-text-primary mb-2">Frais & Commissions</h3>
                  <p className="text-text-secondary text-xs mb-4">Ajustez le % de commission pris sur chaque commande.</p>
                  <button disabled className="btn-secondary w-full opacity-50">Modifier les taux</button>
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
