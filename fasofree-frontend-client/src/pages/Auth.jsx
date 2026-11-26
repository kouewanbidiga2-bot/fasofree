/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams, useLocation, Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Eye, EyeOff, Lock, Mail, UserRound } from 'lucide-react';
import useAuthStore, { getHomeRoute } from '../store/authStore';
import { api } from '../services/api';
import { KoliwaLockup } from '../components/KoliwaLogo';
import DeliveryGlyph from '../components/DeliveryGlyph';

function AuthField({ id, label, icon: Icon, action, labelAction, ...inputProps }) {
  return (
    <div className="auth-field">
      <label htmlFor={id}>{label}</label>
      <div className="auth-control">
        <Icon size={17} strokeWidth={1.65} aria-hidden="true" />
        <input id={id} name={id} required {...inputProps} />
        {action}
      </div>
      {labelAction}
    </div>
  );
}

const Auth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const resetToken = searchParams.get('token');
  const { loginWithToken } = useAuthStore();

  const [view, setView] = useState(
    resetToken ? 'reset' : 'login',
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const headingRef = useRef(null);
  const previousView = useRef(view);

  useEffect(() => {
    if (previousView.current !== view) headingRef.current?.focus();
    previousView.current = view;
  }, [view]);

  const [loginForm, setLoginForm] = useState({ phoneOrEmail: '', password: '' });
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetForm, setResetForm] = useState({ newPassword: '', confirmPassword: '' });

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.login(loginForm.phoneOrEmail, loginForm.password);

      if (response.access_token) {
        const user = response.user || {};
        const nameParts = (user.fullName || '').split(' ');
        loginWithToken(response.access_token, {
          id: user.id,
          email: user.email,
          phone: user.phone,
          firstName: nameParts[0] || '',
          lastName: nameParts.slice(1).join(' ') || '',
          role: user.role,
          isPremium: !!user.isPremium,
          isEmailVerified: !!user.isEmailVerified,
          isPhoneVerified: !!user.isPhoneVerified,
        });

        // Retour à la page visée avant la connexion (commande, service, ...)
        const from = location.state?.from;
        const safeFrom = from && from.startsWith('/') && !from.startsWith('//') && from !== '/auth'
          ? from
          : null;

        const route = getHomeRoute(user.role);
        if (safeFrom) {
          navigate(safeFrom, { replace: true });
        } else if (route.startsWith('http')) {
          window.location.href = route;
        } else {
          navigate(route, { replace: true });
        }
      } else {
        setError('La connexion a échoué. Réessayez.');
      }
    } catch (err) {
      setError(err.message || 'Identifiant ou mot de passe incorrect.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      await api.forgotPassword(forgotEmail);
      setSuccess('Si cet email existe, un lien de réinitialisation vous a été envoyé.');
      setForgotEmail('');
    } catch (err) {
      setError(err.message || "Erreur lors de l'envoi");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    if (resetForm.newPassword !== resetForm.confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }
    if (resetForm.newPassword.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères');
      return;
    }
    setLoading(true);
    try {
      await api.resetPassword(resetToken, resetForm.newPassword);
      changeView('login');
      setSuccess('Mot de passe réinitialisé. Vous pouvez vous connecter.');
      navigate('/auth', { replace: true });
    } catch (err) {
      setError(err.message || 'Erreur lors de la réinitialisation');
    } finally {
      setLoading(false);
    }
  };

  const resetView = view === 'reset';
  const forgotView = view === 'forgot';
  const loginView = view === 'login';
  const passwordAction = (
    <button
      type="button"
      className="auth-visibility"
      aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
      disabled={loading}
      onClick={() => setShowPassword((visible) => !visible)}
    >
      {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
    </button>
  );

  const changeView = (nextView) => {
    setView(nextView);
    setShowPassword(false);
    setError('');
    setSuccess('');
  };

  return (
    <div className="auth-page">
      <header className="auth-header">
        <Link to="/" aria-label="Koliwa, accueil" className="auth-brand">
          <KoliwaLockup width={118} animate />
        </Link>
        <Link to="/" className="auth-back auth-home-link">
          <ArrowLeft size={16} aria-hidden="true" />
          Accueil
        </Link>
      </header>

      <main className="auth-layout">
        <section className="auth-content" data-view={view} aria-labelledby="auth-title">
          <h1 ref={headingRef} id="auth-title" className="auth-title" tabIndex={-1}>
            {resetView ? 'Nouveau mot de passe' : forgotView ? 'Mot de passe oublié ?' : 'Connexion'}
          </h1>
          <p className="auth-description">
            {resetView
              ? 'Choisissez un mot de passe d’au moins 8 caractères.'
              : forgotView
                ? 'Recevez un lien de réinitialisation par e-mail.'
                : 'Retrouvez vos envois et suivez vos colis.'}
          </p>

          <form
            key={view}
            onSubmit={resetView ? handleResetPassword : forgotView ? handleForgotPassword : handleLogin}
            className="auth-form"
            aria-busy={loading}
          >
            {loginView && (
              <>
                <AuthField
                  id="auth-identifier"
                  label="Téléphone ou e-mail"
                  icon={UserRound}
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={loginForm.phoneOrEmail}
                  onChange={(e) => setLoginForm({ ...loginForm, phoneOrEmail: e.target.value })}
                  disabled={loading}
                />
                <AuthField
                  id="auth-password"
                  label="Mot de passe"
                  icon={Lock}
                  action={passwordAction}
                  labelAction={(
                    <button type="button" className="auth-forgot auth-link" disabled={loading} onClick={() => changeView('forgot')}>
                      Mot de passe oublié ?
                    </button>
                  )}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  disabled={loading}
                />
              </>
            )}

            {forgotView && (
              <AuthField
                id="auth-email"
                label="Adresse e-mail"
                icon={Mail}
                type="email"
                autoComplete="email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                disabled={loading}
              />
            )}

            {resetView && (
              <>
                <AuthField
                  id="auth-new-password"
                  label="Nouveau mot de passe"
                  icon={Lock}
                  action={passwordAction}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  minLength={8}
                  value={resetForm.newPassword}
                  onChange={(e) => setResetForm({ ...resetForm, newPassword: e.target.value })}
                  disabled={loading}
                />
                <AuthField
                  id="auth-confirm-password"
                  label="Confirmer le mot de passe"
                  icon={Lock}
                  type="password"
                  autoComplete="new-password"
                  value={resetForm.confirmPassword}
                  onChange={(e) => setResetForm({ ...resetForm, confirmPassword: e.target.value })}
                  disabled={loading}
                />
              </>
            )}

            {error && <p className="auth-message auth-message-error" role="alert">{error}</p>}
            {success && <p className="auth-message auth-message-success" role="status">{success}</p>}
            <button type="submit" className="auth-submit" disabled={loading || (resetView && Boolean(success))}>
              {loading ? 'Veuillez patienter…' : resetView ? 'Réinitialiser le mot de passe' : forgotView ? 'Envoyer le lien' : 'Se connecter'}
              <span className="auth-submit-arrow"><ArrowRight size={18} strokeWidth={1.75} aria-hidden="true" /></span>
            </button>
          </form>

          {loginView && (
            <p className="auth-register">
              <span>Première visite ?</span>
              <Link to="/register" className="auth-link">Créer un compte <ArrowRight size={15} aria-hidden="true" /></Link>
            </p>
          )}

          {loginView && (
            <Link to="/p2p-delivery" className="auth-guest">Commander sans compte <ArrowRight size={16} aria-hidden="true" /></Link>
          )}

          {forgotView && (
            <button type="button" className="auth-back auth-back-to-login" disabled={loading} onClick={() => changeView('login')}>
              <ArrowLeft size={16} aria-hidden="true" />
              Retour à la connexion
            </button>
          )}
        </section>

        <figure className="auth-landmark">
          <img
            className="auth-landmark-photo"
            src="/assets/monument-heros-ouagadougou.jpg"
            width="605"
            height="605"
            alt=""
            decoding="async"
          />
          <figcaption className="auth-landmark-caption">
            <DeliveryGlyph kind="location" />
            <span>
              <strong className="auth-landmark-city">Ouagadougou</strong>
              <span className="auth-landmark-name">Monument des Héros</span>
            </span>
          </figcaption>
        </figure>
      </main>
    </div>
  );
};

export default Auth;
