import React, { useState, useEffect } from 'react';
// ✅ CORRECT
import { useNavigate, useLocation, useParams, Link } from 'react-router-dom';
import {
  LayoutDashboard, ShieldAlert, Users, Store, Settings, LogOut,
  TrendingUp, Wallet, CheckCircle, XCircle, RefreshCw, AlertCircle, Plus, Trash2
} from 'lucide-react';
import useAuthStore from '../store/authStore';

const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [activeTab, setActiveTab] = useState('overview');

  // États des données Super Admin
  const [globalStats, setGlobalStats] = useState({
    totalRevenue: 12500000,
    totalMerchants: 42,
    totalClients: 1280,
    totalDrivers: 85,
  });
  const [pendingMerchants, setPendingMerchants] = useState([
    { id: '1', name: 'Maquis Le 20', owner: 'Mamadou Ouédraogo', category: 'Restauration', phone: '+226 70 00 00 01' },
    { id: '2', name: 'Faso Grillades', owner: 'Aicha Kaboré', category: 'Fast-Food', phone: '+226 76 11 22 33' },
  ]);
  const [loading, setLoading] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  const handleValidateMerchant = (id, accept) => {
    // Action de validation ou rejet
    setPendingMerchants(prev => prev.filter(m => m.id !== id));
  };

  const tabs = [
    { id: 'overview', label: 'Vue Globale', icon: LayoutDashboard },
    { id: 'merchants', label: 'Validation Commerçants', icon: Store, badge: pendingMerchants.length },
    { id: 'admins', label: 'Gestion Admins', icon: Users },
    { id: 'settings', label: 'Paramètres Système', icon: Settings },
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

        {/* Profil Super Admin */}
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

        {/* Navigation */}
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

        {/* Déconnexion */}
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

        {/* ONGLET VUE GLOBALE */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-slide-up">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="card p-5">
                <p className="text-text-secondary text-xs uppercase font-semibold">Chiffre d'affaires Global</p>
                <p className="text-2xl font-bold text-accent-primary mt-2">{globalStats.totalRevenue.toLocaleString()} FCFA</p>
              </div>
              <div className="card p-5">
                <p className="text-text-secondary text-xs uppercase font-semibold">Commerçants Actifs</p>
                <p className="text-2xl font-bold text-text-primary mt-2">{globalStats.totalMerchants}</p>
              </div>
              <div className="card p-5">
                <p className="text-text-secondary text-xs uppercase font-semibold">Clients Inscrits</p>
                <p className="text-2xl font-bold text-text-primary mt-2">{globalStats.totalClients}</p>
              </div>
              <div className="card p-5">
                <p className="text-text-secondary text-xs uppercase font-semibold">Livreurs Partenaires</p>
                <p className="text-2xl font-bold text-text-primary mt-2">{globalStats.totalDrivers}</p>
              </div>
            </div>

            <div className="card p-6">
              <h2 className="text-base font-bold text-text-primary mb-4">Sécurité & Système</h2>
              <div className="p-4 bg-status-successBg border border-status-success/30 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-status-success rounded-full animate-ping" />
                  <span className="text-sm font-semibold text-text-primary">Tous les services NestJS et bases de données fonctionnent normalement.</span>
                </div>
                <span className="text-xs text-text-secondary">Uptime: 99.9%</span>
              </div>
            </div>
          </div>
        )}

        {/* ONGLET VALIDATION DES COMMERÇANTS */}
        {activeTab === 'merchants' && (
          <div className="space-y-6 animate-slide-up">
            <h2 className="text-xl font-bold text-text-primary">Commerçants en attente de validation</h2>
            {pendingMerchants.length === 0 ? (
              <div className="card p-12 text-center text-text-secondary">
                Aucun commerçant en attente de validation pour le moment.
              </div>
            ) : (
              <div className="space-y-3">
                {pendingMerchants.map(merchant => (
                  <div key={merchant.id} className="card p-5 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-text-primary">{merchant.name}</h3>
                      <p className="text-xs text-text-secondary">Responsable : {merchant.owner} | Tél : {merchant.phone}</p>
                      <span className="inline-block mt-2 px-2 py-0.5 bg-background-secondary text-text-tertiary text-xs rounded">
                        {merchant.category}
                      </span>
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

        {/* ONGLET GESTION ADMINS */}
        {activeTab === 'admins' && (
          <div className="space-y-6 animate-slide-up">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-text-primary">Gestion des Administrateurs</h2>
              <button className="btn-primary text-xs flex items-center gap-1">
                <Plus size={14} /> Ajouter un Admin
              </button>
            </div>
            <div className="card p-6 text-sm text-text-secondary">
              Interface de gestion des rôles administrateurs secondaires de la plateforme.
            </div>
          </div>
        )}

        {/* ONGLET PARAMÈTRES SYSTÈME */}
        {activeTab === 'settings' && (
          <div className="space-y-6 animate-slide-up">
            <h2 className="text-xl font-bold text-text-primary">Paramètres de la plateforme</h2>
            <div className="card p-6 space-y-4 max-w-xl">
              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase mb-1">Commission de la plateforme (%)</label>
                <input type="number" className="input-field" defaultValue={15} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase mb-1">Frais de livraison de base (FCFA)</label>
                <input type="number" className="input-field" defaultValue={500} />
              </div>
              <button className="btn-primary mt-2">Enregistrer les modifications</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default SuperAdminDashboard;