/**
 * FasoFree — Page d'authentification
 * Login email+password et inscription avec rôle
 * Connecté au backend via authStore → authService
 *
 * Design tokens alignés sur l'app Client (palette chaude, Nexa, radius 14px)
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, User, Phone, Eye, EyeOff, ArrowRight, ChevronRight } from 'lucide-react';
import useAuthStore from '../store/authStore';

/* ─── Client Design Tokens ────────────────────────────────────────────── */
const T = {
  bg: '#FBF8F3',
  bgCard: '#FFFDFC',
  bgSecondary: '#F4EEE5',
  text: '#29231E',
  textSec: '#74695F',
  textTer: '#5E554D',
  border: '#E9E0D5',
  accent: '#B95B2B',
  accentSec: '#D17843',
  error: '#B5502E',
  errorBg: 'rgba(181,80,46,0.08)',
  shadow: '0 14px 34px rgba(77,53,35,0.10)',
  radius: '14px',
  radiusSm: '10px',
  font: "'Nexa', 'Manrope', system-ui, sans-serif",
};

const InputField = ({ label, type = 'text', placeholder, value, onChange, icon: Icon, error, rightEl }) => (
  <div style={{ marginBottom: 16 }}>
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
          padding: `12px 14px 12px ${Icon ? 40 : 14}px`,
          paddingRight: rightEl ? 40 : 14,
          fontSize: 14,
          fontFamily: T.font,
          color: T.text,
          background: T.bgSecondary,
          border: `1.5px solid ${error ? T.error : T.border}`,
          borderRadius: T.radiusSm,
          outline: 'none',
          transition: 'border-color 0.2s',
          boxSizing: 'border-box',
        }}
        onFocus={(e) => { e.target.style.borderColor = T.accent; }}
        onBlur={(e) => { e.target.style.borderColor = error ? T.error : T.border; }}
      />
      {rightEl && (
        <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}>{rightEl}</div>
      )}
    </div>
    {error && <p style={{ marginTop: 4, fontSize: 12, color: T.error, fontFamily: T.font }}>{error}</p>}
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
      'super_admin': '/financier',
      'superadmin': '/financier',
      'admin': '/financier',
      'support': '/financier',
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
    <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 16px', fontFamily: T.font, position: 'relative' }}>
      {/* Background blobs */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: -160, right: -160, width: 384, height: 384, borderRadius: '50%', opacity: 0.06, background: `radial-gradient(circle, ${T.accent}, transparent)` }} />
        <div style={{ position: 'absolute', bottom: -160, left: -160, width: 384, height: 384, borderRadius: '50%', opacity: 0.06, background: `radial-gradient(circle, ${T.accent}, transparent)` }} />
      </div>

      <div style={{ width: '100%', maxWidth: 420, position: 'relative', animation: 'slideUp 0.4s ease-out' }}>
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <div style={{ padding: 12, borderRadius: 20, background: 'rgba(185,91,43,0.08)', border: `1px solid rgba(185,91,43,0.15)` }}>
              <svg width="52" height="52" viewBox="0 0 140 140" fill="none">
                <ellipse cx="70" cy="70" rx="44" ry="52" stroke={T.accent} strokeWidth="2" fill="none" />
                <path d="M38 50 Q70 22 102 50" stroke={T.accent} strokeWidth="1.5" fill="none" opacity="0.6" />
                <path d="M50 62 Q58 56 66 62 Q58 68 50 62Z" fill={T.accent} opacity="0.9" />
                <path d="M74 62 Q82 56 90 62 Q82 68 74 62Z" fill={T.accent} opacity="0.9" />
                <path d="M70 62 L64 84 L76 84 Z" fill="#8B7355" opacity="0.8" />
                <path d="M56 96 Q70 104 84 96" stroke={T.accent} strokeWidth="1.5" fill="none" strokeLinecap="round" />
                <circle cx="70" cy="70" r="3" fill={T.accent} opacity="0.3" />
              </svg>
            </div>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: T.text, fontFamily: T.font, margin: 0 }}>
            FasoFree
          </h1>
          <p style={{ color: T.textSec, fontSize: 13, marginTop: 4 }}>Marketplace & Livraison — Ouagadougou</p>
        </div>

        {/* Card */}
        <div style={{ background: T.bgCard, borderRadius: T.radius, boxShadow: T.shadow, padding: 32, border: `1px solid ${T.border}` }}>
          {/* Toggle */}
          <div style={{ display: 'flex', gap: 4, padding: 4, background: T.bgSecondary, borderRadius: T.radiusSm, marginBottom: 28 }}>
            {[{ id: 'login', label: 'Connexion' }, { id: 'register', label: 'Inscription' }].map((tab) => (
              <button
                key={tab.id}
                onClick={() => switchMode(tab.id)}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  fontSize: 13,
                  fontWeight: 700,
                  fontFamily: T.font,
                  borderRadius: 8,
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  background: mode === tab.id ? T.accent : 'transparent',
                  color: mode === tab.id ? '#fff' : T.textSec,
                  boxShadow: mode === tab.id ? `0 0 10px rgba(185,91,43,0.2)` : 'none',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div style={{ marginBottom: 20, padding: '14px 16px', background: T.errorBg, border: `1px solid rgba(181,80,46,0.2)`, borderRadius: T.radiusSm, display: 'flex', alignItems: 'flex-start', gap: 10, animation: 'fadeIn 0.3s ease-in-out' }}>
              <span style={{ color: T.error, fontSize: 14 }}>⚠</span>
              <p style={{ color: T.error, fontSize: 13, margin: 0, fontFamily: T.font }}>{error}</p>
            </div>
          )}

          {/* LOGIN */}
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
                  transition: 'background 0.2s',
                }}
              >
                {isLoading ? (
                  <>
                    <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
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

          {/* REGISTER */}
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

              <div style={{ marginBottom: 20, padding: '14px 16px', background: T.bgSecondary, border: `1px solid ${T.border}`, borderRadius: T.radiusSm }}>
                <p style={{ fontSize: 12, color: T.textSec, lineHeight: 1.6, margin: 0, fontFamily: T.font }}>
                  L'inscription publique crée un compte <strong style={{ color: T.text }}>Client</strong>. Les comptes
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
                  transition: 'background 0.2s',
                }}
              >
                {isLoading ? (
                  <>
                    <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
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
          Espace d'administration FasoFree — Dashboard
        </p>
      </div>
    </div>
  );
};

export default PhoneAuth;
