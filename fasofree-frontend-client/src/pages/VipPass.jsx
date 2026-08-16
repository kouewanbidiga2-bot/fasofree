import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Crown, Wallet, Check, RefreshCw, Zap } from 'lucide-react';
import Footer from '../components/Footer';
import useAuthStore from '../store/authStore';
import { api } from '../services/api';

const VipPass = () => {
  const navigate = useNavigate();
  const { user, setPremium } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [plans, setPlans] = useState([]);
  const [vipStatus, setVipStatus] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [subscribing, setSubscribing] = useState(false);
  const [topupOpen, setTopupOpen] = useState(false);
  const [topupAmount, setTopupAmount] = useState(5000);
  const [topupBusy, setTopupBusy] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [plansData, statusData, walletData] = await Promise.all([
        api.getPlans('CUSTOMER'),
        api.getVipStatus(),
        user?.id ? api.getWallet(user.id) : Promise.resolve(null),
      ]);
      setPlans(Array.isArray(plansData) ? plansData : []);
      setVipStatus(statusData);
      setWallet(walletData);
      setPremium(!!statusData?.isPremium);
    } catch (err) {
      setError(err.message || 'Impossible de charger le pass');
    } finally {
      setLoading(false);
    }
  }, [user?.id, setPremium]);

  useEffect(() => {
    if (user?.id) loadData();
    else setLoading(false);
  }, [loadData, user?.id]);

  const handleSubscribe = async (plan) => {
    setError('');
    setSubscribing(true);
    try {
      const result = await api.subscribeVip(plan.code, true);
      setVipStatus({
        isPremium: true,
        planCode: result.subscription?.plan,
        planName: plan.name,
        expiresAt: result.expiresAt,
      });
      setPremium(true);
      if (user?.id) {
        const walletData = await api.getWallet(user.id);
        setWallet(walletData);
      }
    } catch (err) {
      setError(err.message || "Échec de l'abonnement");
    } finally {
      setSubscribing(false);
    }
  };

  const handleTopup = async () => {
    setError('');
    setTopupBusy(true);
    try {
      const data = await api.topupWallet({
        amount: Number(topupAmount),
        customerName: user?.firstName && user?.lastName
          ? `${user.firstName} ${user.lastName}`.trim()
          : user?.email || 'Client FasoFree',
        customerEmail: user?.email || 'client@fasofree.bf',
      });
      setTopupOpen(false);
      if (user?.id) {
        const walletData = await api.getWallet(user.id);
        setWallet(walletData);
      }
    } catch (err) {
      setError(err.message || 'Échec de la recharge');
    } finally {
      setTopupBusy(false);
    }
  };

  const isPremium = !!vipStatus?.isPremium;

  return (
    <div className="min-h-screen bg-background-primary">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background-primary border-b border-border-light">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-background-secondary transition-colors"
            >
              <ArrowLeft size={18} className="text-text-primary" strokeWidth={1.5} />
            </button>
            <h1 className="text-lg font-display font-bold text-text-primary">FasoFree Pass VIP</h1>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-3xl mx-auto space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Hero */}
          <div className="relative overflow-hidden text-white p-8" style={{ backgroundColor: '#C1652E' }}>
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-3">
                <Crown size={22} className="text-amber-300" fill="#FCD34D" />
                <span className="text-xs font-bold uppercase tracking-widest text-amber-200">
                  {isPremium ? 'Membre actif' : 'Avantage exclusif'}
                </span>
              </div>
              <h2 className="text-2xl font-bold mb-2">
                {isPremium ? 'Frais de plateforme offerts' : 'Passez au FasoFree Pass VIP'}
              </h2>
              <p className="text-sm text-orange-100 mb-4 max-w-md">
                Pendant toute la durée de votre abonnement, les frais de service /
                plateforme de {loading ? '…' : '100 FCFA'} par commande sont
                entièrement offerts. La livraison reste calculée selon la distance
                (min. 800 FCFA).
              </p>
              <div className="flex flex-wrap gap-3 text-xs">
                <span className="px-3 py-1 bg-white/15 rounded-full backdrop-blur-sm">✓ 100 FCFA offerts / commande</span>
                <span className="px-3 py-1 bg-white/15 rounded-full backdrop-blur-sm">✓ Sans engagement</span>
              </div>
            </div>
          </div>

          {/* Wallet + Statut */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="border border-border-light p-4">
              <div className="flex items-center gap-3 mb-2">
                <Wallet size={16} className="text-accent-primary" strokeWidth={1.5} />
                <h3 className="text-sm font-medium text-text-primary">Portefeuille FasoFree</h3>
              </div>
              <p className="text-2xl font-mono font-bold text-text-primary mb-3">
                {(wallet?.balance ?? 0).toLocaleString('fr-FR')} FCFA
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setTopupOpen(true)}
                  className="px-3 py-2 text-xs font-medium text-white rounded transition-colors"
                  style={{ backgroundColor: '#C1652E' }}
                >
                  Recharger
                </button>
                <button onClick={loadData} className="px-3 py-2 text-xs font-medium border border-border-light text-text-secondary hover:border-accent-primary hover:text-accent-primary transition-colors">
                  <RefreshCw size={12} className="inline mr-1" />
                  Actualiser
                </button>
              </div>
            </div>

            <div className="border border-border-light p-4">
              <div className="flex items-center gap-3 mb-2">
                <Crown size={16} className="text-amber-500" strokeWidth={1.5} />
                <h3 className="text-sm font-medium text-text-primary">Mon statut</h3>
              </div>
              {loading ? (
                <p className="text-sm text-text-secondary">Chargement…</p>
              ) : isPremium ? (
                <div>
                  <p className="text-sm text-status-success font-semibold">Abonné {vipStatus?.planCode || 'VIP'} actif</p>
                  <p className="text-xs text-text-secondary mt-1">
                    Expire le {vipStatus?.expiresAt ? new Date(vipStatus.expiresAt).toLocaleDateString('fr-FR') : '—'}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-text-secondary">Vous n'êtes pas encore abonné au Pass VIP.</p>
              )}
            </div>
          </div>

          {/* Recharge modal */}
          {topupOpen && (
            <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setTopupOpen(false)}>
              <div className="bg-white rounded-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
                <h3 className="font-bold text-gray-800 mb-4">Recharger le portefeuille</h3>
                <label className="block text-sm text-gray-600 mb-2">Montant (FCFA)</label>
                <input
                  type="number"
                  min={100}
                  value={topupAmount}
                  onChange={(e) => setTopupAmount(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400 mb-4"
                />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setTopupOpen(false)} className="px-4 py-2 text-sm text-gray-600">Annuler</button>
                  <button
                    onClick={handleTopup}
                    disabled={topupBusy || Number(topupAmount) < 100}
                    className="px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50"
                    style={{ backgroundColor: '#C1652E' }}
                  >
                    {topupBusy ? 'Recharge…' : 'Recharger'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Offres VIP */}
          {!isPremium && (
            <div>
              <h3 className="text-base font-bold text-text-primary mb-4">Choisissez votre offre</h3>
              {loading ? (
                <div className="text-sm text-text-secondary">Chargement des offres…</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {plans.map(plan => (
                    <div key={plan.code} className="border border-border-light p-6 flex flex-col">
                      <div className="flex items-center gap-2 mb-2">
                        <Zap size={16} className="text-amber-500" strokeWidth={1.5} />
                        <h4 className="font-bold text-text-primary">{plan.name}</h4>
                      </div>
                      <p className="text-3xl font-mono font-bold text-text-primary mb-2">
                        {(plan.priceFcfa ?? 0).toLocaleString('fr-FR')} <span className="text-sm text-text-secondary font-normal">FCFA</span>
                      </p>
                      <p className="text-xs text-text-secondary mb-2">{plan.durationDays} jours</p>
                      <p className="text-sm text-text-secondary flex-1 mb-4">{plan.description}</p>
                      <div className="space-y-2 text-sm text-text-primary mb-6">
                        <p className="flex items-center gap-2">
                          <Check size={14} className="text-status-success" /> Frais de plateforme offerts
                        </p>
                        <p className="flex items-center gap-2">
                          <Check size={14} className="text-status-success" /> Renouvellement automatique
                        </p>
                      </div>
                      <button
                        onClick={() => handleSubscribe(plan)}
                        disabled={subscribing}
                        className="w-full px-4 py-3 text-sm font-medium text-white rounded-lg transition-all disabled:opacity-50"
                        style={{ backgroundColor: '#C1652E' }}
                      >
                        {subscribing ? 'Abonnement…' : `S'abonner pour ${(plan.priceFcfa ?? 0).toLocaleString('fr-FR')} FCFA`}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {isPremium && !loading && (
            <div className="border border-border-light p-6 text-center">
              <Crown size={40} className="mx-auto text-amber-500 mb-3" fill="#FCD34D" strokeWidth={1} />
              <p className="font-bold text-text-primary mb-1">Vous profitez déjà du Pass VIP</p>
              <p className="text-sm text-text-secondary mb-4">
                Vos commandes ne paient plus les 100 FCFA de frais de plateforme.
              </p>
              <button
                onClick={() => navigate('/')}
                className="px-4 py-3 text-sm font-medium text-white rounded-lg"
                style={{ backgroundColor: '#C1652E' }}
              >
                Commander
              </button>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default VipPass;
