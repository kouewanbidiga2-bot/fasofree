import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Shield, Globe, Moon, Sun, ChevronRight, Eye, Trash2, Lock,
  Download, Bell, ChevronDown, Check, Loader2
} from 'lucide-react';
import useAuthStore from '../store/authStore';
import { api } from '../services/api';
import { useDarkMode } from '../contexts/DarkModeContext';
import { useLanguage } from '../contexts/LanguageContext';

export default function Settings() {
  const navigate = useNavigate();
  const { logout } = useAuthStore();
  const { dark, toggle: toggleDark } = useDarkMode();
  const { lang, setLanguage, t } = useLanguage();
  const [openSection, setOpenSection] = useState(null);
  const [loading, setLoading] = useState(false);

  const toggle = (key) => setOpenSection(openSection === key ? null : key);

  return (
    <div className="min-h-screen bg-background-primary">
      <header className="sticky top-0 z-40 bg-background-primary border-b border-border-light">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-background-secondary transition-colors">
              <ArrowLeft size={18} className="text-text-primary" strokeWidth={1.5} />
            </button>
            <h1 className="text-lg font-display font-bold text-text-primary">{t('settings')}</h1>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-3xl mx-auto space-y-3">

          {/* Mode sombre */}
          <div className="border border-border-light p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              {dark ? <Moon size={18} className="text-text-secondary" /> : <Sun size={18} className="text-text-secondary" />}
              <div>
                <p className="text-sm font-medium text-text-primary">{t('darkMode') || 'Mode sombre'}</p>
                <p className="text-xs text-text-secondary">{dark ? (t('darkModeOn') || 'Actif') : (t('darkModeOff') || 'Inactif — Mode clair')}</p>
              </div>
            </div>
            <button
              onClick={toggleDark}
              className={`relative w-10 h-5 rounded-full transition-colors ${dark ? 'bg-[#C1652E]' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${dark ? 'translate-x-5' : ''}`} />
            </button>
          </div>

          {/* Langue */}
          <div className="border border-border-light">
            <button
              onClick={() => toggle('lang')}
              className="w-full flex items-center justify-between p-4 hover:bg-background-secondary transition-colors text-left"
            >
              <div className="flex items-center gap-4">
                <Globe size={18} className="text-text-secondary" />
                <div>
                  <p className="text-sm font-medium text-text-primary">{t('language')}</p>
                  <p className="text-xs text-text-secondary">{lang === 'fr' ? 'Francais' : lang === 'en' ? 'English' : 'Moore'}</p>
                </div>
              </div>
              <ChevronDown
                size={16}
                className={`text-text-secondary transition-transform ${openSection === 'lang' ? 'rotate-180' : ''}`}
              />
            </button>
            {openSection === 'lang' && (
              <div className="border-t border-border-light bg-background-secondary/50">
                <LangOption label="Francais" code="fr" active={lang === 'fr'} onSelect={setLanguage} />
                <LangOption label="English" code="en" active={lang === 'en'} onSelect={setLanguage} />
                <LangOption label="Moore" code="mo" active={lang === 'mo'} onSelect={setLanguage} />
              </div>
            )}
          </div>

          {/* Notifications */}
          <div className="border border-border-light">
            <button
              onClick={() => toggle('notif')}
              className="w-full flex items-center justify-between p-4 hover:bg-background-secondary transition-colors text-left"
            >
              <div className="flex items-center gap-4">
                <Bell size={18} className="text-text-secondary" />
                <div>
                  <p className="text-sm font-medium text-text-primary">{t('notifications')}</p>
                  <p className="text-xs text-text-secondary">{t('notificationsDesc')}</p>
                </div>
              </div>
              <ChevronDown
                size={16}
                className={`text-text-secondary transition-transform ${openSection === 'notif' ? 'rotate-180' : ''}`}
              />
            </button>
            {openSection === 'notif' && (
              <div className="border-t border-border-light bg-background-secondary/50">
                <ToggleRow label={t('notifOrders')} desc={t('notifOrdersDesc')} defaultOn storageKey="notif_orders" />
                <ToggleRow label={t('notifPromos')} desc={t('notifPromosDesc')} defaultOn storageKey="notif_promos" />
                <ToggleRow label={t('notifNewRestaurants')} desc={t('notifNewRestaurantsDesc')} storageKey="notif_restaurants" />
              </div>
            )}
          </div>

          {/* Securite */}
          <div className="border border-border-light">
            <button
              onClick={() => toggle('security')}
              className="w-full flex items-center justify-between p-4 hover:bg-background-secondary transition-colors text-left"
            >
              <div className="flex items-center gap-4">
                <Lock size={18} className="text-text-secondary" />
                <div>
                  <p className="text-sm font-medium text-text-primary">{t('security')}</p>
                  <p className="text-xs text-text-secondary">{t('securityDesc')}</p>
                </div>
              </div>
              <ChevronDown
                size={16}
                className={`text-text-secondary transition-transform ${openSection === 'security' ? 'rotate-180' : ''}`}
              />
            </button>
            {openSection === 'security' && (
              <div className="border-t border-border-light bg-background-secondary/50 p-4">
                <ChangePasswordForm t={t} setLoading={setLoading} />
              </div>
            )}
          </div>

          {/* Confidentialite */}
          <div className="border border-border-light">
            <button
              onClick={() => toggle('privacy')}
              className="w-full flex items-center justify-between p-4 hover:bg-background-secondary transition-colors text-left"
            >
              <div className="flex items-center gap-4">
                <Shield size={18} className="text-text-secondary" />
                <div>
                  <p className="text-sm font-medium text-text-primary">{t('privacy')}</p>
                  <p className="text-xs text-text-secondary">{t('privacyDesc')}</p>
                </div>
              </div>
              <ChevronDown
                size={16}
                className={`text-text-secondary transition-transform ${openSection === 'privacy' ? 'rotate-180' : ''}`}
              />
            </button>
            {openSection === 'privacy' && (
              <div className="border-t border-border-light bg-background-secondary/50 p-4 space-y-3">
                <button
                  onClick={async () => {
                    try {
                      setLoading(true);
                      const data = await api.exportData();
                      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `fasofree_donnees_${new Date().toISOString().slice(0, 10)}.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                    } catch (err) {
                      alert(t('downloadError') + ': ' + err.message);
                    } finally {
                      setLoading(false);
                    }
                  }}
                  className="w-full flex items-center gap-3 p-3 hover:bg-background-secondary transition-colors text-left"
                >
                  <Download size={16} className="text-text-secondary" />
                  <div className="flex-1">
                    <p className="text-sm text-text-primary">{t('downloadData')}</p>
                    <p className="text-xs text-text-secondary">{t('downloadDataDesc')}</p>
                  </div>
                </button>
                <button
                  onClick={async () => {
                    if (!window.confirm(t('deleteConfirmTitle') + '\n\n' + t('deleteConfirmDesc'))) return;
                    try {
                      setLoading(true);
                      await api.deleteAccount();
                      logout();
                      navigate('/');
                      alert(t('deleteSuccess'));
                    } catch (err) {
                      alert(t('deleteError') + ': ' + err.message);
                    } finally {
                      setLoading(false);
                    }
                  }}
                  className="w-full flex items-center gap-3 p-3 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left"
                >
                  <Trash2 size={16} className="text-red-500" />
                  <div className="flex-1">
                    <p className="text-sm text-red-600">{t('deleteAccount')}</p>
                    <p className="text-xs text-text-secondary">{t('deleteAccountDesc')}</p>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* A propos */}
          <div className="border border-border-light">
            <button
              onClick={() => toggle('about')}
              className="w-full flex items-center justify-between p-4 hover:bg-background-secondary transition-colors text-left"
            >
              <div className="flex items-center gap-4">
                <Globe size={18} className="text-text-secondary" />
                <div>
                  <p className="text-sm font-medium text-text-primary">{t('about')}</p>
                  <p className="text-xs text-text-secondary">{t('version')}</p>
                </div>
              </div>
              <ChevronDown
                size={16}
                className={`text-text-secondary transition-transform ${openSection === 'about' ? 'rotate-180' : ''}`}
              />
            </button>
            {openSection === 'about' && (
              <div className="border-t border-border-light bg-background-secondary/50 p-4 space-y-2">
                <p className="text-xs text-text-secondary">{t('aboutDesc')}</p>
                <a href="/terms" className="block text-sm text-[#C1652E]">{t('terms')}</a>
                <a href="/privacy" className="block text-sm text-[#C1652E]">{t('privacyPolicy')}</a>
              </div>
            )}
          </div>

          {/* Deconnexion */}
          <button
            onClick={() => { logout(); navigate('/'); }}
            className="w-full border border-red-200 dark:border-red-800 p-4 text-red-600 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors mt-6"
          >
            {t('logout')}
          </button>
        </div>
      </div>

      {loading && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-background-card p-6 flex items-center gap-3">
            <Loader2 size={20} className="animate-spin text-[#C1652E]" />
            <span className="text-sm text-text-primary">{t('loading')}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function ChangePasswordForm({ t, setLoading }) {
  const [current, setCurrent] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg(null);
    if (newPass.length < 6) { setMsg({ type: 'error', text: t('passwordTooShort') }); return; }
    if (newPass !== confirm) { setMsg({ type: 'error', text: t('passwordMismatch') }); return; }
    setSaving(true);
    try {
      await api.changePassword(current, newPass);
      setMsg({ type: 'success', text: t('passwordChanged') });
      setCurrent(''); setNewPass(''); setConfirm('');
    } catch (err) {
      setMsg({ type: 'error', text: err.message || t('passwordError') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input
        type="password"
        placeholder={t('currentPassword')}
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
        className="w-full px-3 py-2.5 bg-background-secondary border border-border-light text-sm text-text-primary"
        required
      />
      <input
        type="password"
        placeholder={t('newPassword')}
        value={newPass}
        onChange={(e) => setNewPass(e.target.value)}
        className="w-full px-3 py-2.5 bg-background-secondary border border-border-light text-sm text-text-primary"
        required
      />
      <input
        type="password"
        placeholder={t('confirmPassword')}
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        className="w-full px-3 py-2.5 bg-background-secondary border border-border-light text-sm text-text-primary"
        required
      />
      {msg && (
        <p className={`text-xs ${msg.type === 'error' ? 'text-red-500' : 'text-green-600'}`}>{msg.text}</p>
      )}
      <button
        type="submit"
        disabled={saving || !current || !newPass || !confirm}
        className="w-full bg-[#C1652E] text-white py-2.5 text-sm font-semibold disabled:opacity-50"
      >
        {saving ? <Loader2 size={16} className="animate-spin mx-auto" /> : t('save')}
      </button>
    </form>
  );
}

function LangOption({ label, code, active, onSelect }) {
  return (
    <button
      onClick={() => onSelect(code)}
      className="w-full flex items-center justify-between p-3 hover:bg-background-secondary transition-colors text-left"
    >
      <span className="text-sm text-text-primary">{label}</span>
      {active ? <Check size={14} className="text-[#C1652E]" /> : <span className="w-3.5" />}
    </button>
  );
}

function ToggleRow({ label, desc, defaultOn = false, storageKey }) {
  const [on, setOn] = useState(() => {
    const saved = localStorage.getItem(`fasofree_${storageKey}`);
    if (saved !== null) return saved === 'true';
    return defaultOn;
  });
  const handleToggle = () => {
    const next = !on;
    setOn(next);
    localStorage.setItem(`fasofree_${storageKey}`, String(next));
  };
  return (
    <div className="flex items-center justify-between p-3">
      <div>
        <p className="text-sm text-text-primary">{label}</p>
        <p className="text-xs text-text-secondary">{desc}</p>
      </div>
      <button
        onClick={handleToggle}
        className={`relative w-10 h-5 rounded-full transition-colors ${on ? 'bg-[#C1652E]' : 'bg-gray-300'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${on ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  );
}
