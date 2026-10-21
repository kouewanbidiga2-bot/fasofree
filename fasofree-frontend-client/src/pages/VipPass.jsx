/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Crown, Wallet, Check, RefreshCw, Zap } from 'lucide-react';
import Footer from '../components/Footer';
import useAuthStore from '../store/authStore';
import { api } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import Skeleton from '../components/ui/Skeleton';
import { Modal, ModalTitle } from '../components/ui/Modal';

const VipPass = () => {
  const navigate = useNavigate();
  const { user, setPremium } = useAuthStore();
  const { t } = useLanguage();
  const userId = user?.id;
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState('');
  const [subscribing, setSubscribing] = useState(false);
  const [topupOpen, setTopupOpen] = useState(false);
  const [topupAmount, setTopupAmount] = useState(5000);
  const [topupBusy, setTopupBusy] = useState(false);

  // ⚙️ Les 3 lectures de la page (offres, statut VIP, wallet) passent par le
  // cache TanStack Query : le retour arrière sur FasoFree Pass réaffiche tout
  // instantanément puis resynchronise en tâche de fond. `enabled: !!userId`
  // reproduit l'ancien comportement au pixel : visiteur non connecté → aucune
  // requête, aucun chargement, aucun écran d'erreur. Les queryKey portent
  // l'id utilisateur → aucun wallet/statut d'un autre compte en cache.
  const {
    data: plans = [],
    isLoading: plansLoading,
    error: plansError,
  } = useQuery({
    queryKey: ['plans', 'CUSTOMER', userId ?? null],
    queryFn: async () => {
      const d = await api.getPlans('CUSTOMER');
      return Array.isArray(d) ? d : [];
    },
    enabled: !!userId,
    staleTime: 5 * 60_000, // catalogue d'offres quasi statique
  });

  const {
    data: vipStatus,
    isLoading: statusLoading,
    error: statusError,
  } = useQuery({
    queryKey: ['vip-status', userId ?? null],
    queryFn: () => api.getVipStatus(),
    enabled: !!userId,
    staleTime: 30_000,
  });

  const {
    data: wallet,
    isLoading: walletLoading,
    error: walletError,
  } = useQuery({
    queryKey: ['wallet', 'CUSTOMER', userId ?? null],
    queryFn: () => api.getWallet(userId),
    enabled: !!userId,
    staleTime: 15_000, // solde sensible : fraîcheur 15 s + re-sync de fond
  });

  // Un seul indicateur « chargement » comme avant (Promise.all historique).
  const loading = plansLoading || statusLoading || walletLoading;
  // Bandeau d'erreur : échec d'une des 3 lectures, ou erreur d'action
  // (abonnement / recharge) — même rendu que l'ancien state `error`.
  const queryError = plansError || statusError || walletError;
  const error = actionError || queryError?.message || '';

  // Synchronisation du flag premium du store (comportement historique de
  // loadData) : uniquement quand un statut réel est disponible.
  useEffect(() => {
    if (vipStatus) setPremium(!!vipStatus.isPremium);
  }, [vipStatus, setPremium]);

  // Bouton « Rafraîchir » : relance les 3 lectures en arrière-plan.
  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['plans'] });
    queryClient.invalidateQueries({ queryKey: ['vip-status'] });
    queryClient.invalidateQueries({ queryKey: ['wallet'] });
  };

  const handleSubscribe = async (plan) => {
    setActionError('');
    setSubscribing(true);
    try {
      const result = await api.subscribeVip(plan.code, true);
      // Statut optimiste immédiat + invalidation : la vérification serveur
      // confirme en tâche de fond (même UX que l'ancien setVipStatus direct).
      queryClient.setQueryData(['vip-status', userId ?? null], {
        isPremium: true,
        planCode: result.subscription?.plan,
        planName: plan.name,
        expiresAt: result.expiresAt,
      });
      setPremium(true);
      // Le wallet a bougé (prélèvement) : relecture en arrière-plan.
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      queryClient.invalidateQueries({ queryKey: ['vip-status'] });
    } catch (err) {
      setActionError(err.message || "Échec de l'abonnement");
    } finally {
      setSubscribing(false);
    }
  };

  const handleTopup = async () => {
    setActionError('');
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
      // 🔗 Redirection obligatoire vers la page de paiement GeniusPay : sans
      // elle, aucun paiement n'est encaissé et le portefeuille n'est JAMAIS
      // crédité. Le crédit est appliqué par le webhook à la confirmation.
      const checkoutUrl = data?.checkoutUrl || data?.paymentUrl;
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
        return;
      }
      // Pas de redirection : relecture du wallet en arrière-plan.
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
    } catch (err) {
      setActionError(err.message || 'Échec de la recharge');
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
            <h1 className="text-lg font-display font-bold text-text-primary">{t('vipPass')}</h1>
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
                  {isPremium ? t('activeMember') : t('exclusiveAdvantage')}
                </span>
              </div>
              <h2 className="text-2xl font-bold mb-2">
                {isPremium ? t('platformFeesFree') : t('switchToVip')}
              </h2>
              <p className="text-sm text-orange-100 mb-4 max-w-md">
                {t('vipDesc', { fee: loading ? '…' : '100 FCFA' })}
              </p>
              <div className="flex flex-wrap gap-3 text-xs">
                <span className="px-3 py-1 bg-white/15 rounded-full backdrop-blur-sm">✓ {t('feePerOrder')}</span>
                <span className="px-3 py-1 bg-white/15 rounded-full backdrop-blur-sm">✓ {t('noCommitment')}</span>
              </div>
            </div>
          </div>

          {/* Wallet + Statut */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="border border-border-light p-4">
              <div className="flex items-center gap-3 mb-2">
                <Wallet size={16} className="text-accent-primary" strokeWidth={1.5} />
                <h3 className="text-sm font-medium text-text-primary">{t('fasoFreeWallet')}</h3>
              </div>
              <p className="text-2xl font-mono font-bold text-text-primary mb-3">
                {(wallet?.balance ?? 0).toLocaleString('fr-FR')} FCFA
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setTopupOpen(true)}
                  className="px-3 py-2 text-xs font-medium text-white rounded transition active:scale-[0.98]"
                  style={{ backgroundColor: '#C1652E' }}
                >
                  {t('recharge')}
                </button>
                <button onClick={refreshAll} className="px-3 py-2 text-xs font-medium border border-border-light text-text-secondary hover:border-accent-primary hover:text-accent-primary transition active:scale-[0.98]">
                  <RefreshCw size={12} className="inline mr-1" />
                  {t('refresh')}
                </button>
              </div>
            </div>

            <div className="border border-border-light p-4">
              <div className="flex items-center gap-3 mb-2">
                <Crown size={16} className="text-amber-500" strokeWidth={1.5} />
                <h3 className="text-sm font-medium text-text-primary">{t('myStatus')}</h3>
              </div>
              {loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 rounded w-3/4" />
                  <Skeleton className="h-3 rounded w-1/2" />
                </div>
              ) : isPremium ? (
                <div>
                  <p className="text-sm text-status-success font-semibold">{t('activeSub', { plan: vipStatus?.planCode || 'VIP' })}</p>
                  <p className="text-xs text-text-secondary mt-1">
                    {t('expiresOn', { date: vipStatus?.expiresAt ? new Date(vipStatus.expiresAt).toLocaleDateString('fr-FR') : '—' })}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-text-secondary">{t('notSubscribed')}</p>
              )}
            </div>
          </div>

          {/* Recharge modal — Radix via le primitif Modal (mêmes classes) */}
          <Modal
            isOpen={topupOpen}
            onClose={() => setTopupOpen(false)}
            overlayClassName="bg-black/50"
            panelClassName="bg-white rounded-2xl p-6 w-full max-w-sm"
          >
                <ModalTitle asChild>
                  <h3 className="font-bold text-gray-800 mb-4">{t('rechargeWallet')}</h3>
                </ModalTitle>
                <label className="block text-sm text-gray-600 mb-2">{t('amountFcfa')}</label>
                <input
                  type="number"
                  min={100}
                  value={topupAmount}
                  onChange={(e) => setTopupAmount(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400 mb-4"
                />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setTopupOpen(false)} className="px-4 py-2 text-sm text-gray-600 transition active:scale-[0.98]">{t('cancel')}</button>
                  <button
                    onClick={handleTopup}
                    disabled={topupBusy || Number(topupAmount) < 100}
                    className="px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50 transition active:scale-[0.98]"
                    style={{ backgroundColor: '#C1652E' }}
                  >
                    {topupBusy ? t('recharging') : t('recharge')}
                  </button>
                </div>
          </Modal>

          {/* Offres VIP */}
          {!isPremium && (
            <div>
              <h3 className="text-base font-bold text-text-primary mb-4">{t('chooseOffer')}</h3>
              {loading ? (
                // Squelettes aux dimensions des cartes d'offre réelles
                // (bordure p-6 + icône + prix + durée + description + CTA).
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="border border-border-light p-6 flex flex-col space-y-3">
                      <Skeleton className="h-4 rounded w-1/3" />
                      <Skeleton className="h-8 rounded w-1/2" />
                      <Skeleton className="h-3 rounded w-1/4" />
                      <Skeleton className="h-3.5 rounded w-full" />
                      <Skeleton className="h-11 rounded w-full mt-4" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in">
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
                          <Check size={14} className="text-status-success" /> {t('platformFeesFree')}
                        </p>
                        <p className="flex items-center gap-2">
                          <Check size={14} className="text-status-success" /> {t('autoRenew')}
                        </p>
                      </div>
                      <button
                        onClick={() => handleSubscribe(plan)}
                        disabled={subscribing}
                        className="w-full px-4 py-3 text-sm font-medium text-white rounded-lg transition-all active:scale-[0.98] disabled:opacity-50"
                        style={{ backgroundColor: '#C1652E' }}
                      >
                        {subscribing ? t('subscribing') : t('subscribeFor', { price: (plan.priceFcfa ?? 0).toLocaleString('fr-FR') })}
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
              <p className="font-bold text-text-primary mb-1">{t('alreadyVip')}</p>
              <p className="text-sm text-text-secondary mb-4">
                {t('vipActiveDesc')}
              </p>
              <button
                onClick={() => navigate('/')}
                className="px-4 py-3 text-sm font-medium text-white rounded-lg transition active:scale-[0.98]"
                style={{ backgroundColor: '#C1652E' }}
              >
                {t('orderNow')}
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
