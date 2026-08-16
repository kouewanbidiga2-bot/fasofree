import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Store,
  Package,
  User,
  Settings,
  LogOut,
  CheckCircle2,
  ShoppingBag,
  Truck,
} from 'lucide-react';
import { api } from '../services/api';
import useAuthStore from '../store/authStore';

const ACCENT = '#C1652E';

const MerchantDashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getProfile()
      .then(setProfile)
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, []);

  const fullName =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
    profile?.fullName ||
    'Marchand';

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-background-primary">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background-primary border-b border-border-light">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/')}
                className="p-2 hover:bg-background-secondary transition-colors"
              >
                <ArrowLeft size={18} className="text-text-primary" strokeWidth={1.5} />
              </button>
              <h1 className="text-lg font-display font-bold text-text-primary">Espace Marchand</h1>
            </div>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border border-border-light text-text-secondary hover:bg-background-secondary transition-colors"
            >
              <LogOut size={14} strokeWidth={1.5} />
              Déconnexion
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome banner */}
        <div
          className="rounded-2xl p-6 mb-8 text-white shadow-subtle"
          style={{ backgroundColor: ACCENT }}
        >
          <div className="flex items-center gap-3 mb-2">
            <Store size={22} strokeWidth={1.5} />
            <p className="text-xs font-medium uppercase tracking-wide opacity-80">Tableau de bord</p>
          </div>
          <h2 className="text-2xl font-display font-bold mb-1">Bonjour, {fullName} 👋</h2>
          <p className="text-sm opacity-90">
            Gérez votre activité FasoFree et suivez vos ventes en temps réel.
          </p>
        </div>

        {/* Profile / account status */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <div className="rounded-lg border border-border-light bg-background-card p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-background-secondary flex items-center justify-center">
                <User size={18} className="text-text-secondary" strokeWidth={1.5} />
              </div>
              <p className="text-sm font-semibold text-text-primary">Mon compte</p>
            </div>
            <p className="text-xs text-text-secondary mb-1">Email</p>
            <p className="text-sm font-medium text-text-primary mb-3 break-all">{profile?.email || user?.email || '—'}</p>
            <p className="text-xs text-text-secondary mb-1">Téléphone</p>
            <p className="text-sm font-medium text-text-primary">{profile?.phone || user?.phone || '—'}</p>
          </div>

          <div className="rounded-lg border border-border-light bg-background-card p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
                <CheckCircle2 size={18} className="text-success" strokeWidth={1.5} />
              </div>
              <p className="text-sm font-semibold text-text-primary">Statut du compte</p>
            </div>
            {loading ? (
              <p className="text-sm text-text-secondary">Chargement…</p>
            ) : (
              <>
                <p className="text-sm font-medium text-success mb-1">Compte actif</p>
                <p className="text-xs text-text-secondary">
                  Votre boutique est disponible sur FasoFree.
                </p>
              </>
            )}
          </div>

          <div className="rounded-lg border border-border-light bg-background-card p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-background-secondary flex items-center justify-center">
                <Settings size={18} className="text-text-secondary" strokeWidth={1.5} />
              </div>
              <p className="text-sm font-semibold text-text-primary">Rôle</p>
            </div>
            <p className="text-sm font-medium text-text-primary mb-1 capitalize">{profile?.role || user?.role || '—'}</p>
            <p className="text-xs text-text-secondary">Marchand partenaire FasoFree</p>
          </div>
        </div>

        {/* Quick actions */}
        <p className="text-xs font-semibold text-text-primary uppercase tracking-wide mb-3">Actions rapides</p>
        <div className="grid md:grid-cols-3 gap-4">
          <button
            onClick={() => navigate('/profile')}
            className="rounded-lg border border-border-light bg-background-card p-5 text-left hover:border-border-dark hover:shadow-subtle transition-all"
          >
            <Package size={20} className="mb-3 text-text-secondary" strokeWidth={1.5} />
            <p className="text-sm font-semibold text-text-primary mb-1">Mes produits</p>
            <p className="text-xs text-text-secondary">Gérer le catalogue de ma boutique</p>
          </button>

          <button
            onClick={() => navigate('/')}
            className="rounded-lg border border-border-light bg-background-card p-5 text-left hover:border-border-dark hover:shadow-subtle transition-all"
          >
            <ShoppingBag size={20} className="mb-3 text-text-secondary" strokeWidth={1.5} />
            <p className="text-sm font-semibold text-text-primary mb-1">Mes commandes</p>
            <p className="text-xs text-text-secondary">Suivre les commandes de mes clients</p>
          </button>

          <button
            onClick={() => navigate('/')}
            className="rounded-lg border border-border-light bg-background-card p-5 text-left hover:border-border-dark hover:shadow-subtle transition-all"
          >
            <Truck size={20} className="mb-3 text-text-secondary" strokeWidth={1.5} />
            <p className="text-sm font-semibold text-text-primary mb-1">Livraisons</p>
            <p className="text-xs text-text-secondary">Suivre les livraisons en cours</p>
          </button>
        </div>
      </div>
    </div>
  );
};

export default MerchantDashboard;
