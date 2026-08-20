/**
 * FasoFree — Page d'authentification Dashboard
 * Login email+password et inscription avec rôle
 * Design aligné sur l'identité visuelle officielle (favicon dark + papillon terracotta)
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, User, Phone, Eye, EyeOff, ArrowRight, ChevronRight } from 'lucide-react';
import useAuthStore from '../store/authStore';

/* ─── FasoFree Official Brand Logo (dark bg + terracotta butterfly) ──── */
const FasoFreeLogo = ({ size = 64 }) => (
  <svg width={size} height={size} viewBox="0 0 140 140" fill="none">
    <rect width="140" height="140" rx="28" fill="#0D0D0D" />
    <ellipse cx="70" cy="70" rx="44" ry="52" stroke="#C1652E" strokeWidth="2.5" fill="none" />
    <path d="M38 50 Q70 22 102 50" stroke="#C1652E" strokeWidth="1.8" fill="none" opacity="0.6" />
    <path d="M50 62 Q58 56 66 62 Q58 68 50 62Z" fill="#C1652E" opacity="0.9" />
    <path d="M74 62 Q82 56 90 62 Q82 68 74 62Z" fill="#C1652E" opacity="0.9" />
    <path d="M70 62 L64 84 L76 84 Z" fill="#8B7355" opacity="0.8" />
    <path d="M56 96 Q70 104 84 96" stroke="#C1652E" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    <circle cx="70" cy="70" r="3" fill="#C1652E" opacity="0.3" />
  </svg>
);

/* ─── Dark Design Tokens (matching dashboard) ─────────────────────────── */
const T = {
  bg: '#0D0D0D',
  bgCard: '#1A1A1A',
  bgSecondary: '#161616',
  text: '#F0EDE8',
  textSec: '#A09890',
  textTer: '#6B6359',
  border: '#2A2520',
  accent: '#C1652E',
  accentSec: '#D9753E',
  error: '#EF4444',
  errorBg: 'rgba(239,68,68,0.12)',
  shadow: '0 20px 60px rgba(0,0,0,0.6)',
  radius: '16px',
  radiusSm: '10px',
  font: "'Manrope', system-ui, sans-serif",
};

const InputField = ({ label, type = 'text', placeholder, value, onChange, icon: Icon, error, rightEl }) => (
  <div style={{ marginBottom: 18 }}>
    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: T.textSec, marginBottom: 6, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: T.font }}>
      {label}
    </label>
    <div style={{ position: 'relative' }}>
      {Icon && (
        <Icon size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: T.textTer }} strokeWidth={1.5} />
      )}
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        style={{
          width: '100%',
          padding: `13px 14px 13px ${Icon ? 40 : 14}px`,
          paddingRight: rightEl ? 40 : 14,
          fontSize: 14,
          fontFamily: T.font,
          color: T.text,
          background: T.bgSecondary,
          border: `1.5px solid ${error ? T.error : T.border}`,
          borderRadius: T.radiusSm,
          outline: 'none',
          transition: 'border-color 0.2s, box-shadow 0.2s',
          boxSizing: 'border-box',
        }}
        onFocus={(e) => {
          e.target.style.borderColor = T.accent;
          e.target.style.boxShadow = '0 0 0 3px rgba(193,101,46,0.15)';
        }}
        onBlur={(e) => {
          e.target.style.borderColor = error ? T.error : T.border;
          e.target.style.boxShadow = 'none';
        }}
      />
      {rightEl && (
        <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}>{rightEl}</div>
      )}
    </div>
    {error && <p style={{ marginTop: 5, fontSize: 12, color: T.error, fontFamily: T.font }}>{error}</p>}
  </div>
);

const PhoneAuth = () => {
  const navigate = useNavigate();
  const { login, register, isLoading, error, clearError } = useAuthStore();

  const [mode, setMode] = useState('login');
  const [showPassword, setShowPassword] = useState(false);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');

  const [localErrors, setLocalErrors] = useState({});

  const validateLogin = () => {
    const errs = {};
    if (!loginEmail) errs.email = 'Email requis';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginEmail)) errs.email = 'Email invalide';
    if (!loginPassword) errs.password = 'Mot de passe requis';
    setLocalErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateRegister = () => {
    const errs = {};
    if (!regFullName.trim()) errs.fullName = 'Nom complet requis';
    if (!regEmail) errs.email = 'Email requis';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail)) errs.email = 'Email invalide';
    if (!regPhone) errs.phone = 'Téléphone requis';
    else if (!/^\+?[0-9\s]{8,}$/.test(regPhone)) errs.phone = 'Format: +226XXXXXXXX';
    if (!regPassword) errs.password = 'Mot de passe requis';
    else if (regPassword.length < 8) errs.password = 'Minimum 8 caractères';
    setLocalErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const redirectByRole = (user) => {
    const role = (user?.role || '').toLowerCase().replace('-', '_');
    const roleRoutes = {
      'business_admin': '/designer',
      'business': '/designer',
      'merchant': '/designer',
      'restaurant': '/designer',
      'driver': '/livreur',
      'courier': '/livreur',
      'livreur': '/livreur',
      'super_admin': '/admin/super',
      'superadmin': '/admin/super',
      'admin': '/admin/manager',
      'support': '/admin/support',
    };
    navigate(roleRoutes[role] || '/login');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    clearError();
    if (!validateLogin()) return;
    try {
      const user = await login(loginEmail, loginPassword);
      redirectByRole(user);
    } catch {
      // Erreur déjà dans le store
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    clearError();
    if (!validateRegister()) return;
    try {
      const user = await register({
        fullName: regFullName,
        email: regEmail,
        phone: regPhone,
        password: regPassword,
      });
      redirectByRole(user);
    } catch {
      // Erreur déjà dans le store
    }
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setLocalErrors({});
    clearError();
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: T.bg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px 16px',
      fontFamily: T.font,
      position: 'relative',
    }}>
      {/* Ambient glow */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div style={{
          position: 'absolute',
          top: '20%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 600,
          height: 600,
          borderRadius: '50%',
          opacity: 0.04,
          background: `radial-gradient(circle, ${T.accent}, transparent)`,
          filter: 'blur(80px)',
        }} />
      </div>

      <div style={{ width: '100%', maxWidth: 400, position: 'relative', animation: 'slideUp 0.4s ease-out' }}>
        {/* Brand — centered butterfly logo on dark bg */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
            <FasoFreeLogo size={72} />
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: T.text, fontFamily: T.font, margin: 0, letterSpacing: '-0.02em' }}>
            FasoFree
          </h1>
          <p style={{ color: T.textSec, fontSize: 13, marginTop: 6, fontWeight: 500 }}>
            Espace d'administration
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: T.bgCard,
          borderRadius: T.radius,
          boxShadow: T.shadow,
          padding: 32,
          border: `1px solid ${T.border}`,
        }}>
          {/* Toggle */}
          <div style={{
            display: 'flex',
            gap: 4,
            padding: 4,
            background: T.bgSecondary,
            borderRadius: T.radiusSm,
            marginBottom: 28,
          }}>
            {[{ id: 'login', label: 'Connexion' }, { id: 'register', label: 'Inscription' }].map((tab) => (
              <button
                key={tab.id}
                onClick={() => switchMode(tab.id)}
                style={{
                  flex: 1,
                  padding: '11px 0',
                  fontSize: 13,
                  fontWeight: 700,
                  fontFamily: T.font,
                  borderRadius: 8,
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  background: mode === tab.id ? T.accent : 'transparent',
                  color: mode === tab.id ? '#fff' : T.textSec,
                  boxShadow: mode === tab.id ? `0 0 12px rgba(193,101,46,0.25)` : 'none',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div style={{
              marginBottom: 20,
              padding: '12px 14px',
              background: T.errorBg,
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: T.radiusSm,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              animation: 'fadeIn 0.3s ease-in-out',
            }}>
              <span style={{ color: T.error, fontSize: 14 }}>⚠</span>
              <p style={{ color: T.error, fontSize: 13, margin: 0, fontFamily: T.font }}>{error}</p>
            </div>
          )}

          {/* ─── LOGIN ───────────────────────────────────────────── */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} style={{ animation: 'fadeIn 0.3s ease-in-out' }}>
              <InputField label="Email" type="email" placeholder="vous@exemple.com" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} icon={Mail} error={localErrors.email} />
              <InputField
                label="Mot de passe"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                icon={Lock}
                error={localErrors.password}
                rightEl={
                  <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textTer, padding: 0, display: 'flex' }}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                }
              />

              <button
                type="submit"
                disabled={isLoading}
                style={{
                  width: '100%',
                  marginTop: 8,
                  padding: '14px 0',
                  fontSize: 14,
                  fontWeight: 700,
                  fontFamily: T.font,
                  color: '#fff',
                  background: T.accent,
                  border: 'none',
                  borderRadius: T.radiusSm,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  transition: 'all 0.2s',
                  boxShadow: '0 4px 14px rgba(193,101,46,0.3)',
                }}
              >
                {isLoading ? (
                  <>
                    <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'fasofree-spin 0.8s linear infinite', display: 'inline-block' }} />
                    Connexion en cours...
                  </>
                ) : (
                  <>Se connecter <ArrowRight size={16} /></>
                )}
              </button>

              <p style={{ textAlign: 'center', color: T.textTer, fontSize: 12, marginTop: 20, fontFamily: T.font }}>
                Pas encore de compte ?{' '}
                <button type="button" onClick={() => switchMode('register')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.accent, fontWeight: 700, fontSize: 12, fontFamily: T.font, padding: 0 }}>
                  Créer un compte
                </button>
              </p>
            </form>
          )}

          {/* ─── REGISTER ──────────────────────────────────────── */}
          {mode === 'register' && (
            <form onSubmit={handleRegister} style={{ animation: 'fadeIn 0.3s ease-in-out' }}>
              <InputField label="Nom complet" placeholder="Aminata Ouédraogo" value={regFullName} onChange={(e) => setRegFullName(e.target.value)} icon={User} error={localErrors.fullName} />
              <InputField label="Email" type="email" placeholder="vous@exemple.com" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} icon={Mail} error={localErrors.email} />
              <InputField label="Téléphone" type="tel" placeholder="+226 70 00 00 00" value={regPhone} onChange={(e) => setRegPhone(e.target.value)} icon={Phone} error={localErrors.phone} />
              <InputField
                label="Mot de passe"
                type={showPassword ? 'text' : 'password'}
                placeholder="Minimum 8 caractères"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                icon={Lock}
                error={localErrors.password}
                rightEl={
                  <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textTer, padding: 0, display: 'flex' }}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                }
              />

              <div style={{ marginBottom: 20, padding: '12px 14px', background: T.bgSecondary, border: `1px solid ${T.border}`, borderRadius: T.radiusSm }}>
                <p style={{ fontSize: 12, color: T.textSec, lineHeight: 1.6, margin: 0, fontFamily: T.font }}>
                  L'inscription publique crée un compte <strong style={{ color: T.accent }}>Client</strong>. Les comptes
                  commerçants, livreurs et administrateurs sont créés par l'administration.
                </p>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                style={{
                  width: '100%',
                  marginTop: 4,
                  padding: '14px 0',
                  fontSize: 14,
                  fontWeight: 700,
                  fontFamily: T.font,
                  color: '#fff',
                  background: T.accent,
                  border: 'none',
                  borderRadius: T.radiusSm,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  transition: 'all 0.2s',
                  boxShadow: '0 4px 14px rgba(193,101,46,0.3)',
                }}
              >
                {isLoading ? (
                  <>
                    <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'fasofree-spin 0.8s linear infinite', display: 'inline-block' }} />
                    Création en cours...
                  </>
                ) : (
                  <>Créer mon compte <ChevronRight size={16} /></>
                )}
              </button>

              <p style={{ textAlign: 'center', color: T.textTer, fontSize: 12, marginTop: 20, fontFamily: T.font }}>
                Déjà inscrit ?{' '}
                <button type="button" onClick={() => switchMode('login')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.accent, fontWeight: 700, fontSize: 12, fontFamily: T.font, padding: 0 }}>
                  Se connecter
                </button>
              </p>
            </form>
          )}
        </div>

        <p style={{ textAlign: 'center', color: T.textTer, fontSize: 11, marginTop: 24, fontFamily: T.font }}>
          FasoFree — Marketplace & Livraison Premium
        </p>
      </div>
    </div>
  );
};

export default PhoneAuth;
