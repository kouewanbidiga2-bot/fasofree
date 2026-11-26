/**
 * Copyright (c) 2026 BIDIGA Imrane - Koliwa. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, MapPin, Phone, LogOut, Settings, Bell, CreditCard, Crown, Check, AlertTriangle, Camera, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import Footer from '../components/Footer';
import NotificationDropdown from '../components/NotificationDropdown';
import LoyaltyWidget from '../components/loyalty/LoyaltyWidget';
import useAuthStore from '../store/authStore';
import { api } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import CallSupportButton from '../components/CallSupportButton';
import { hasSupportPhone } from '../utils/support';

const MOBILE_MONEY_PROVIDERS = [
  { value: 'ORANGE_MONEY', label: 'Orange Money' },
  { value: 'MOOV_MONEY', label: 'Moov Money' },
];

const Profile = () => {
  const navigate = useNavigate();
  const { user, logout, updateUser } = useAuthStore();
  const { t } = useLanguage();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || [user?.firstName, user?.lastName].filter(Boolean).join(' '),
    email: user?.email || '',
    phone: user?.phone || '',
    preferredNotificationChannel: user?.preferredNotificationChannel || 'EMAIL',
  });
  const [notifOpen, setNotifOpen] = useState(false);

  // Avatar
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarFileRef = useRef(null);

  // Mobile Money state
  const [showPaymentInfo, setShowPaymentInfo] = useState(false);
  const [paymentData, setPaymentData] = useState({
    mobileMoneyNumber: '',
    mobileMoneyProvider: '',
  });
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentSaved, setPaymentSaved] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const me = await api.getProfile();
        const name = me.fullName || me.name || [me.firstName, me.lastName].filter(Boolean).join(' ');
        setFormData((prev) => ({
          ...prev,
          name,
          email: me.email || '',
          phone: me.phone || '',
          preferredNotificationChannel: me.preferredNotificationChannel || 'EMAIL',
        }));
        setAvatarUrl(me.avatarUrl || '');
        updateUser({ name, email: me.email, phone: me.phone, id: me.id, avatarUrl: me.avatarUrl || '' });
        // Load Mobile Money info
        setPaymentData({
          mobileMoneyNumber: me.mobileMoneyNumber || '',
          mobileMoneyProvider: me.mobileMoneyProvider || '',
        });
      } catch {
        // silent — keep local defaults
      }
    };
    loadProfile();
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  const handleAvatarSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.match(/^image\/(jpeg|png|webp)$/)) {
      toast.error('Formats acceptés : JPEG, PNG, WebP');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Photo trop lourde (max 5 Mo)');
      return;
    }
    setAvatarUploading(true);
    try {
      const fd = new FormData();
      fd.append('avatar', file);
      const res = await api.uploadAvatar(fd);
      setAvatarUrl(res.avatarUrl);
      updateUser({ avatarUrl: res.avatarUrl });
      toast.success('Photo de profil mise à jour');
    } catch (err) {
      toast.error(err.message || 'Échec de l\'upload');
    } finally {
      setAvatarUploading(false);
      if (avatarFileRef.current) avatarFileRef.current.value = '';
    }
  };

  const menuItems = [
    { icon: Crown, label: t('vipPass'), action: () => navigate('/vip-pass') },
    { icon: MapPin, label: t('addresses'), action: () => navigate('/addresses') },
    { icon: CreditCard, label: t('paymentInfo'), action: () => setShowPaymentInfo((open) => !open), expandable: true },
    { icon: Bell, label: t('notifications'), action: () => setNotifOpen(true) },
    { icon: AlertTriangle, label: t('reclamations'), action: () => navigate('/disputes') },
    { icon: Settings, label: t('settings'), action: () => navigate('/settings') },
  ];

  const handleSave = async () => {
    setLoading(true);
    try {
      const updated = await api.updateProfile({
        fullName: formData.name,
        email: formData.email,
        phone: formData.phone,
        preferredNotificationChannel: formData.preferredNotificationChannel,
      });
      const name = updated.fullName || updated.name || formData.name;
      updateUser({ name, email: updated.email, phone: updated.phone });
      setFormData((prev) => ({ ...prev, name, email: updated.email, phone: updated.phone }));
      setIsEditing(false);
    } catch (err) {
      toast.error(err.message || 'Erreur lors de la mise à jour du profil.');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePaymentInfo = async () => {
    setPaymentLoading(true);
    setPaymentSaved(false);
    try {
      await api.updatePaymentInfo({
        mobileMoneyNumber: paymentData.mobileMoneyNumber || undefined,
        mobileMoneyProvider: paymentData.mobileMoneyProvider || undefined,
      });
      setPaymentSaved(true);
      setTimeout(() => setPaymentSaved(false), 3000);
    } catch (err) {
      toast.error(err.message || 'Erreur lors de la mise à jour des informations de paiement.');
    } finally {
      setPaymentLoading(false);
    }
  };

  return (
    <div className="app-page profile-page">
      <div className="client-screen-frame">
        <header className="client-screen-heading">
          <div className="client-screen-title">
            <span><User size={24} strokeWidth={1.65} aria-hidden="true" /></span>
            <h1>{t('myProfile')}</h1>
          </div>
        </header>

        <div className="profile-layout">
          <section className="profile-account" aria-labelledby="profile-name">
            <div className="profile-identity">
              <button
                type="button"
                className="profile-avatar"
                onClick={() => avatarFileRef.current?.click()}
                disabled={avatarUploading}
                aria-label={avatarUploading ? 'Envoi de la photo en cours' : 'Changer la photo de profil'}
              >
                {avatarUrl ? <img src={avatarUrl} alt="" /> : <User size={26} strokeWidth={1.4} aria-hidden="true" />}
                <span className="profile-avatar-edit"><Camera size={13} aria-hidden="true" /></span>
              </button>
              <input ref={avatarFileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarSelect} hidden />
              <div className="profile-identity-details">
                <h2 id="profile-name">{formData.name || 'Mon compte'}</h2>
                {formData.email && <p>{formData.email}</p>}
                {formData.phone && (
                  <p className="profile-phone"><Phone size={14} strokeWidth={1.6} aria-hidden="true" /> {formData.phone}</p>
                )}
              </div>
              {user?.isPremium && <span className="profile-vip"><Crown size={13} aria-hidden="true" /> VIP</span>}
            </div>

            <button type="button" className="app-action-secondary profile-edit" aria-expanded={isEditing} onClick={() => setIsEditing((open) => !open)}>
              {isEditing ? t('cancel') : t('edit')}
            </button>

            {isEditing && (
              <form className="profile-form" onSubmit={(event) => { event.preventDefault(); handleSave(); }}>
                <label>
                  <span>{t('fullName')}</span>
                  <input className="app-input" autoComplete="name" value={formData.name} onChange={(event) => setFormData({ ...formData, name: event.target.value })} />
                </label>
                <label>
                  <span>{t('email')}</span>
                  <input className="app-input" type="email" autoComplete="email" value={formData.email} onChange={(event) => setFormData({ ...formData, email: event.target.value })} />
                </label>
                <label>
                  <span>{t('phone')}</span>
                  <input className="app-input" type="tel" autoComplete="tel" value={formData.phone} onChange={(event) => setFormData({ ...formData, phone: event.target.value })} />
                </label>
                <label>
                  <span>{t('notificationChannel')}</span>
                  <select className="app-input" value={formData.preferredNotificationChannel} onChange={(event) => setFormData({ ...formData, preferredNotificationChannel: event.target.value })}>
                    <option value="EMAIL">Email</option>
                    <option value="SMS">SMS</option>
                    <option value="WHATSAPP">WhatsApp</option>
                  </select>
                </label>
                <button type="submit" className="app-action" disabled={loading}>{loading ? t('saving') : t('save')}</button>
              </form>
            )}
          </section>

          <div className="profile-tools">
            <section className="profile-menu" aria-labelledby="profile-menu-title">
              <h2 id="profile-menu-title">Préférences du compte</h2>
              {menuItems.map(({ icon: Icon, label, action, expandable }) => (
                <div key={label} className="profile-menu-item">
                  <button
                    type="button"
                    className="profile-menu-row"
                    onClick={action}
                    aria-expanded={expandable ? showPaymentInfo : undefined}
                    aria-controls={expandable && showPaymentInfo ? 'profile-mobile-money' : undefined}
                  >
                    <span className="profile-menu-icon"><Icon size={19} strokeWidth={1.65} aria-hidden="true" /></span>
                    <span>{label}</span>
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>
                  {expandable && showPaymentInfo && (
                    <form id="profile-mobile-money" className="profile-form profile-payment" onSubmit={(event) => { event.preventDefault(); handleSavePaymentInfo(); }}>
                      <p>{t('paymentInfoDesc')}</p>
                      <label>
                        <span>{t('mobileMoneyNumber')}</span>
                        <input
                          className="app-input"
                          type="tel"
                          placeholder="+226 70 12 34 56"
                          value={paymentData.mobileMoneyNumber}
                          onChange={(event) => setPaymentData({ ...paymentData, mobileMoneyNumber: event.target.value })}
                        />
                      </label>
                      <label>
                        <span>{t('operator')}</span>
                        <select className="app-input" value={paymentData.mobileMoneyProvider} onChange={(event) => setPaymentData({ ...paymentData, mobileMoneyProvider: event.target.value })}>
                          <option value="">{t('selectOperator')}</option>
                          {MOBILE_MONEY_PROVIDERS.map(({ value, label: provider }) => <option key={value} value={value}>{provider}</option>)}
                        </select>
                      </label>
                      <button type="submit" className="app-action" disabled={paymentLoading}>
                        {paymentLoading ? t('saving') : paymentSaved ? <><Check size={16} aria-hidden="true" /> {t('saved')}</> : t('save')}
                      </button>
                    </form>
                  )}
                </div>
              ))}
            </section>

            <div className="profile-help">
              {hasSupportPhone && <CallSupportButton variant="outline" label={t('callSupport')} />}
              <button type="button" className="profile-logout" onClick={handleLogout}><LogOut size={17} aria-hidden="true" /> {t('logout')}</button>
            </div>
          </div>

          <section className="profile-rewards" aria-label="Fidélité et parrainage"><LoyaltyWidget /></section>
        </div>
      </div>
      <NotificationDropdown open={notifOpen} onClose={() => setNotifOpen(false)} />
      <Footer />
    </div>
  );
};

export default Profile;
