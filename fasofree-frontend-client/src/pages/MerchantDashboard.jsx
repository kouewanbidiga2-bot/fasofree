import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Store,
  Package,
  ShoppingBag,
  Wallet,
  Settings,
  LogOut,
  TrendingUp,
  Power,
  PowerOff,
  Loader2,
} from 'lucide-react';
import { api } from '../services/api';
import useAuthStore from '../store/authStore';
import { getHomeRoute } from '../store/authStore';

const MerchantDashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const [business, setBusiness] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [togglingOpen, setTogglingOpen] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [businessRes, walletRes] = await Promise.allSettled([
        api.getMyBusiness(),
        api.getMerchantWallet(user?.id),
      ]);

      if (businessRes.status === 'fulfilled') setBusiness(businessRes.value);
      if (walletRes.status === 'fulfilled') setWallet(walletRes.value);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  const handleToggleOpen = async () => {
    if (!business) return;
    setTogglingOpen(true);
    try {
      const updated = await api.updateBusiness(business.id, { isOpen: !business.isOpen });
      setBusiness(updated);
    } catch {
      // silent
    } finally {
      setTogglingOpen(false);
    }
  };

  const fullName =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Marchand';
  const businessName = business?.name || 'Ma Boutique';
  const isOpen = business?.isOpen ?? false;
  const balance = wallet?.balance ?? 0;

  const quickActions = [
    {
      title: 'Mes Produits',
      subtitle: 'Gérer votre catalogue',
      icon: Package,
      to: '/merchant/products',
    },
    {
      title: 'Mes Commandes',
      subtitle: 'Suivre les ventes',
      icon: ShoppingBag,
      to: '/merchant/orders',
    },
    {
      title: 'Mon Portefeuille',
      subtitle: 'Soldes & transactions',
      icon: Wallet,
      to: '/merchant/wallet',
    },
    {
      title: 'Paramètres',
      subtitle: 'Configuration boutique',
      icon: Settings,
      to: '/merchant/settings',
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-background-primary flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-accent-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-primary">
      <header className="sticky top-0 z-40 bg-background-primary border-b border-border-light">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(getHomeRoute(user?.role))}
                className="p-2 hover:bg-background-secondary rounded-lg transition-colors"
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

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div
          className="rounded-2xl p-6 sm:p-8 mb-8 text-white shadow-subtle bg-accent-primary"
        >
          <div className="flex items-center gap-3 mb-2">
            <Store size={22} strokeWidth={1.5} />
            <p className="text-xs font-medium uppercase tracking-wide opacity-80">Tableau de bord</p>
          </div>
          <h2 className="text-2xl font-display font-bold mb-1">
            Bonjour, {fullName} 👋
          </h2>
          <p className="text-sm opacity-90 mb-5">
            {businessName} — voici un aperçu de votre activité aujourd'hui.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="bg-white/15 rounded-xl px-4 py-3">
              <p className="text-xs opacity-80 mb-1">Solde portefeuille</p>
              <p className="text-lg font-display font-bold">
                {balance.toLocaleString('fr-FR')} FCFA
              </p>
            </div>
            <div className="bg-white/15 rounded-xl px-4 py-3">
              <p className="text-xs opacity-80 mb-1">Statut boutique</p>
              <p className="text-lg font-display font-bold flex items-center gap-2">
                <TrendingUp size={16} />
                {isOpen ? 'Ouverte' : 'Fermée'}
              </p>
            </div>
            <div className="bg-white/15 rounded-xl px-4 py-3 col-span-2 sm:col-span-1">
              <p className="text-xs opacity-80 mb-1">Catégorie</p>
              <p className="text-lg font-display font-bold capitalize">
                {business?.category || '—'}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.to}
                onClick={() => navigate(action.to)}
                className="rounded-xl border border-border-light bg-background-card p-5 text-left hover:border-accent-primary hover:shadow-subtle transition-all group"
              >
                <div className="w-10 h-10 rounded-lg bg-background-secondary flex items-center justify-center mb-3 group-hover:bg-accent-primary/10 transition-colors">
                  <Icon size={20} className="text-text-secondary group-hover:text-accent-primary transition-colors" strokeWidth={1.5} />
                </div>
                <p className="text-sm font-semibold text-text-primary mb-1">{action.title}</p>
                <p className="text-xs text-text-secondary">{action.subtitle}</p>
              </button>
            );
          })}
        </div>

        <div className="rounded-xl border border-border-light bg-background-card p-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isOpen ? 'bg-success/10' : 'bg-error/10'}`}>
              {isOpen ? (
                <Power size={18} className="text-success" strokeWidth={1.5} />
              ) : (
                <PowerOff size={18} className="text-error" strokeWidth={1.5} />
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary">
                {isOpen ? 'Boutique ouverte' : 'Boutique fermée'}
              </p>
              <p className="text-xs text-text-secondary">
                {isOpen
                  ? 'Les clients peuvent passer des commandes.'
                  : 'Activez pour recevoir des commandes.'}
              </p>
            </div>
          </div>
          <button
            onClick={handleToggleOpen}
            disabled={togglingOpen}
            className={`px-5 py-2.5 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-60 ${
              isOpen ? 'bg-error hover:bg-error/90' : 'bg-success hover:bg-success/90'
            }`}
          >
            {togglingOpen ? (
              <Loader2 size={16} className="animate-spin" />
            ) : isOpen ? (
              'Fermer'
            ) : (
              'Ouvrir'
            )}
          </button>
        </div>

        {wallet && (
          <div className="mt-8 rounded-xl border border-border-light bg-background-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent-primary/10 flex items-center justify-center">
                  <Wallet size={18} className="text-accent-primary" strokeWidth={1.5} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-primary">Portefeuille Marchand</p>
                  <p className="text-xs text-text-secondary">Solde disponible</p>
                </div>
              </div>
              <button
                onClick={() => navigate('/merchant/wallet')}
                className="text-xs font-medium text-accent-primary hover:underline"
              >
                Voir les détails →
              </button>
            </div>
            <p className="text-3xl font-display font-bold text-text-primary">
              {balance.toLocaleString('fr-FR')} <span className="text-base font-normal text-text-secondary">FCFA</span>
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

export default MerchantDashboard;
