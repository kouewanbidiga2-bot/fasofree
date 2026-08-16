/**
 * FasoFree — Page d'authentification
 * Login email+password et inscription avec rôle
 * Connecté au backend via authStore → authService
 */
import React, { useState } from 'react';
// ✅ CORRECT
import { useNavigate, useLocation, useParams, Link } from 'react-router-dom';
import { Mail, Lock, User, Phone, Eye, EyeOff, ArrowRight, ChevronRight } from 'lucide-react';
import useAuthStore from '../store/authStore';

// ─── Logo SVG FasoFree ──────────────────────────────────────────────────
const FasoFreeLogo = () => (
  <svg width="52" height="52" viewBox="0 0 140 140" fill="none">
    <ellipse cx="70" cy="70" rx="44" ry="52" stroke="#C1652E" strokeWidth="2" fill="none" />
    <path d="M38 50 Q70 22 102 50" stroke="#C1652E" strokeWidth="1.5" fill="none" opacity="0.6" />
    <path d="M50 62 Q58 56 66 62 Q58 68 50 62Z" fill="#C1652E" opacity="0.9" />
    <path d="M74 62 Q82 56 90 62 Q82 68 74 62Z" fill="#C1652E" opacity="0.9" />
    <path d="M70 62 L64 84 L76 84 Z" fill="#8B7355" opacity="0.8" />
    <path d="M56 96 Q70 104 84 96" stroke="#C1652E" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    <circle cx="70" cy="70" r="3" fill="#C1652E" opacity="0.3" />
  </svg>
);

// ─── Rôles disponibles à l'inscription ──────────────────────────────────
// Depuis le verrouillage des rôles (Phase sécurité), l'inscription publique
// crée exclusivement des comptes CLIENT. Les comptes commerçants, livreurs
// et administrateurs sont créés par l'administration (Console → Gestion Utilisateurs).

// ─── Composant champ input ───────────────────────────────────────────────
const InputField = ({ label, type = 'text', placeholder, value, onChange, icon: Icon, error, rightEl }) => (
  <div className="mb-4">
    <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">
      {label}
    </label>
    <div className="relative">
      {Icon && (
        <Icon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-tertiary" strokeWidth={1.5} />
      )}
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className={`input-field ${Icon ? 'pl-10' : ''} ${rightEl ? 'pr-10' : ''} ${error ? 'border-status-error focus:border-status-error' : ''}`}
      />
      {rightEl && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">{rightEl}</div>
      )}
    </div>
    {error && <p className="mt-1 text-xs text-status-error">{error}</p>}
  </div>
);

// ─── Composant principal ─────────────────────────────────────────────────
const PhoneAuth = () => {
  const navigate = useNavigate();
  const { login, register, isLoading, error, clearError } = useAuthStore();

  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [showPassword, setShowPassword] = useState(false);

  // Champs Login
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Champs Register
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');

  // Erreurs locales
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

  // ─── Redirection vers le Dashboard selon le rôle ─────────────────────────
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
    <div className="min-h-screen bg-background-primary flex items-center justify-center px-4 py-12">
      {/* Background décoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full opacity-5" style={{ background: 'radial-gradient(circle, #C1652E, transparent)' }} />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full opacity-5" style={{ background: 'radial-gradient(circle, #C1652E, transparent)' }} />
      </div>

      <div className="w-full max-w-md relative animate-slide-up">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-2xl" style={{ background: 'rgba(193,101,46,0.1)', border: '1px solid rgba(193,101,46,0.2)' }}>
              <FasoFreeLogo />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-text-primary" style={{ fontFamily: 'Clash Display, sans-serif' }}>
            FasoFree
          </h1>
          <p className="text-text-secondary text-sm mt-1">Marketplace & Livraison — Ouagadougou</p>
        </div>

        {/* Card principale */}
        <div className="card-glass p-8">
          {/* Toggle Login / Register */}
          <div className="flex gap-1 p-1 bg-background-secondary rounded-lg mb-7">
            {[{ id: 'login', label: 'Connexion' }, { id: 'register', label: 'Inscription' }].map((tab) => (
              <button
                key={tab.id}
                onClick={() => switchMode(tab.id)}
                className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all duration-200 ${
                  mode === tab.id
                    ? 'bg-accent-primary text-white shadow-glow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Erreur globale API */}
          {error && (
            <div className="mb-5 p-3.5 bg-status-errorBg border border-status-error/30 rounded-md flex items-start gap-2.5 animate-fade-in">
              <span className="text-status-error text-sm">⚠</span>
              <p className="text-status-error text-sm">{error}</p>
            </div>
          )}

          {/* ─── FORMULAIRE LOGIN ────────────────────────────────── */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="animate-fade-in">
              <InputField
                label="Email"
                type="email"
                placeholder="vous@exemple.com"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                icon={Mail}
                error={localErrors.email}
              />
              <InputField
                label="Mot de passe"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                icon={Lock}
                error={localErrors.password}
                rightEl={
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-text-tertiary hover:text-text-secondary transition-colors">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                }
              />

              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary w-full mt-2"
              >
                {isLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Connexion en cours...
                  </>
                ) : (
                  <>Se connecter <ArrowRight size={16} /></>
                )}
              </button>

              <p className="text-center text-text-tertiary text-xs mt-5">
                Pas encore de compte ?{' '}
                <button type="button" onClick={() => switchMode('register')} className="text-accent-primary hover:text-accent-secondary transition-colors font-semibold">
                  Créer un compte
                </button>
              </p>
            </form>
          )}

          {/* ─── FORMULAIRE REGISTER ─────────────────────────────── */}
          {mode === 'register' && (
            <form onSubmit={handleRegister} className="animate-fade-in">
              <InputField
                label="Nom complet"
                placeholder="Aminata Ouédraogo"
                value={regFullName}
                onChange={(e) => setRegFullName(e.target.value)}
                icon={User}
                error={localErrors.fullName}
              />
              <InputField
                label="Email"
                type="email"
                placeholder="vous@exemple.com"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                icon={Mail}
                error={localErrors.email}
              />
              <InputField
                label="Téléphone"
                type="tel"
                placeholder="+226 70 00 00 00"
                value={regPhone}
                onChange={(e) => setRegPhone(e.target.value)}
                icon={Phone}
                error={localErrors.phone}
              />
              <InputField
                label="Mot de passe"
                type={showPassword ? 'text' : 'password'}
                placeholder="Minimum 8 caractères"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                icon={Lock}
                error={localErrors.password}
                rightEl={
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-text-tertiary hover:text-text-secondary transition-colors">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                }
              />

              {/* Sélection du rôle — inscription réservée aux clients */}
              <div className="mb-5 p-3.5 bg-background-secondary border border-border-light rounded-md">
                <p className="text-xs text-text-secondary leading-relaxed">
                  L'inscription publique crée un compte <span className="font-bold text-text-primary">Client</span>. Les comptes
                  commerçants, livreurs et administrateurs sont créés par l'administration.
                </p>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary w-full mt-1"
              >
                {isLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Création en cours...
                  </>
                ) : (
                  <>Créer mon compte <ChevronRight size={16} /></>
                )}
              </button>

              <p className="text-center text-text-tertiary text-xs mt-5">
                Déjà inscrit ?{' '}
                <button type="button" onClick={() => switchMode('login')} className="text-accent-primary hover:text-accent-secondary transition-colors font-semibold">
                  Se connecter
                </button>
              </p>
            </form>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-text-tertiary text-xs mt-6">
          Espace d'administration FasoFree — Dashboard
        </p>
      </div>
    </div>
  );
};

export default PhoneAuth;
