import React, { useState, useEffect } from 'react';
import { Gift, Users, Copy, Check, Star, TrendingUp } from 'lucide-react';
import { api } from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';

const LoyaltyWidget = () => {
  const { t } = useLanguage();
  const [balance, setBalance] = useState(null);
  const [referralStats, setReferralStats] = useState(null);
  const [referralCode, setReferralCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [balanceRes, statsRes, codeRes] = await Promise.all([
        api.getLoyaltyPoints(),
        api.getReferralStats(),
        api.getReferralCode(),
      ]);
      setBalance(balanceRes?.data?.balance ?? 0);
      setReferralStats(statsRes?.data);
      setReferralCode(codeRes?.data?.code || '');
    } catch {
      setBalance(0);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = async () => {
    if (!referralCode) return;
    try {
      await navigator.clipboard.writeText(referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  if (loading) {
    return (
      <div className="bg-background-card rounded-2xl border border-border-light p-5">
        <div className="animate-pulse flex gap-3">
          <div className="w-10 h-10 rounded-full bg-background-secondary" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-background-secondary rounded w-1/3" />
            <div className="h-3 bg-background-secondary rounded w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Points balance */}
      <div className="bg-gradient-to-br from-[#C1652E] to-[#a85522] rounded-2xl p-5 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white/70 text-xs font-medium uppercase tracking-wider">{t('myPoints')}</p>
            <p className="text-3xl font-bold mt-1">{balance ?? 0}</p>
            <p className="text-white/60 text-xs mt-1">{t('pointsPerSpent')}</p>
          </div>
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
            <Star size={24} className="text-white" />
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-white/20">
          <p className="text-white/60 text-xs">
            {t('equivalentReduction', { amount: Math.floor((balance ?? 0) / 100) })}
          </p>
        </div>
      </div>

      {/* Referral section */}
      <div className="bg-background-card rounded-2xl border border-border-light p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-background-secondary flex items-center justify-center">
            <Users size={18} className="text-accent-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-primary">{t('referFriend')}</h3>
            <p className="text-xs text-text-secondary">
              {t('friendsRegistered', { count: referralStats?.completedReferrals || 0 })}
            </p>
          </div>
        </div>

        {referralCode && (
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 bg-background-secondary rounded-lg px-4 py-2.5 font-mono text-sm font-semibold text-text-primary tracking-wider">
              {referralCode}
            </div>
            <button
              onClick={handleCopyCode}
              className="w-10 h-10 rounded-lg bg-background-secondary flex items-center justify-center hover:bg-background-tertiary transition-colors"
            >
              {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} className="text-text-secondary" />}
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 mt-3">
          <div className="bg-background-secondary rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-accent-primary">{referralStats?.totalReferred || 0}</p>
            <p className="text-[10px] text-text-secondary font-medium">{t('referred')}</p>
          </div>
          <div className="bg-background-secondary rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-accent-primary">{referralStats?.pendingBonus || 0}</p>
            <p className="text-[10px] text-text-secondary font-medium">{t('pendingPoints')}</p>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 text-xs text-[#70645C]">
          <Gift size={14} className="text-[#C1652E]" />
          <span>{t('referrerBonus')}</span>
        </div>
      </div>
    </div>
  );
};

export default LoyaltyWidget;
