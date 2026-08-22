import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Lock, Mail, Phone, KeyRound, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import useAuthStore, { getHomeRoute } from '../store/authStore';
import { api } from '../services/api';

const Auth = () => {
  const navigate = useNavigate();
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

  const [loginForm, setLoginForm] = useState({ phoneOrEmail: '', password: '' });
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetForm, setResetForm] = useState({ newPassword: '', confirmPassword: '' });

  const inputClass = (field) =>
    `w-full pl-12 pr-11 py-3 bg-background-secondary border-0 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none transition-colors ${
      errors[field] ? 'ring-2 ring-red-500' : ''
    }`;

  const [errors, setErrors] = useState({});

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

        const route = getHomeRoute(user.role);
        if (route.startsWith('http')) {
          window.location.href = route;
        } else {
          navigate(route, { replace: true });
        }
      } else {
        setError('Authentification échouée');
      }
    } catch (err) {
      setError(err.message || 'Email ou mot de passe incorrect');
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
      setSuccess('Mot de passe réinitialisé ! Redirection...');
      setTimeout(() => navigate('/auth'), 2000);
    } catch (err) {
      setError(err.message || 'Erreur lors de la réinitialisation');
    } finally {
      setLoading(false);
    }
  };

  const resetView = view === 'reset';
  const forgotView = view === 'forgot';
  const loginView = view === 'login';

  return (
    <div className="min-h-screen bg-background-primary flex items-center justify-center p-4">
      <div className="max-w-md w-full animate-fade-in">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-accent-primary flex items-center justify-center mx-auto mb-4 shadow-subtle">
            {resetView ? (
              <KeyRound size={30} className="text-white" strokeWidth={1.5} />
            ) : forgotView ? (
              <Mail size={30} className="text-white" strokeWidth={1.5} />
            ) : (
              <Lock size={30} className="text-white" strokeWidth={1.5} />
            )}
          </div>
          <h1 className="text-2xl font-display font-bold text-text-primary">
            {resetView ? 'Nouveau mot de passe' : forgotView ? 'Récupérer l\'accès' : 'Connexion'}
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            {resetView
              ? 'Choisissez un mot de passe sécurisé'
              : forgotView
              ? 'Entrez votre email pour recevoir un lien'
              : 'Accédez à votre espace FasoFree'}
          </p>
        </div>

        {/* Card */}
        <div className="bg-background-card rounded-xl shadow-subtle p-6">
          {/* ── RESET PASSWORD ── */}
          {resetView && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-xs text-text-secondary mb-2">Nouveau mot de passe</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" strokeWidth={1.5} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={resetForm.newPassword}
                    onChange={(e) => setResetForm({ ...resetForm, newPassword: e.target.value })}
                    placeholder="Minimum 8 caractères"
                    required
                    minLength={8}
                    className="w-full pl-11 pr-11 py-3 bg-background-secondary border-0 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-2">Confirmer</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" strokeWidth={1.5} />
                  <input
                    type="password"
                    value={resetForm.confirmPassword}
                    onChange={(e) => setResetForm({ ...resetForm, confirmPassword: e.target.value })}
                    placeholder="Confirmez le mot de passe"
                    required
                    className="w-full pl-11 pr-4 py-3 bg-background-secondary border-0 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none transition-colors"
                  />
                </div>
              </div>
              {error && <p className="text-sm text-error">{error}</p>}
              {success && <p className="text-sm text-success">{success}</p>}
              <button
                type="submit"
                disabled={loading || !resetForm.newPassword || !resetForm.confirmPassword}
                className="w-full py-3 bg-accent-primary text-white text-sm font-medium rounded-lg hover:bg-accent-secondary transition-colors disabled:opacity-50"
              >
                {loading ? 'En cours...' : 'Réinitialiser'}
              </button>
            </form>
          )}

          {/* ── FORGOT PASSWORD ── */}
          {forgotView && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label className="block text-xs text-text-secondary mb-2">Email</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" strokeWidth={1.5} />
                  <input
                    type="email"
                    value={forgotEmail}
                    required
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="votre@email.com"
                    className="w-full pl-11 pr-4 py-3 bg-background-secondary border-0 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none transition-colors"
                  />
                </div>
              </div>
              {error && <p className="text-sm text-error">{error}</p>}
              {success && <p className="text-sm text-success">{success}</p>}
              <button
                type="submit"
                disabled={loading || !forgotEmail}
                className="w-full py-3 bg-accent-primary text-white text-sm font-medium rounded-lg hover:bg-accent-secondary transition-colors disabled:opacity-50"
              >
                {loading ? 'Envoi...' : 'Envoyer le lien'}
              </button>
              <button
                type="button"
                onClick={() => { setView('login'); setError(''); setSuccess(''); }}
                className="flex items-center gap-1 text-sm text-accent-primary hover:text-accent-secondary font-medium mx-auto"
              >
                <ArrowLeft size={14} />
                Retour à la connexion
              </button>
            </form>
          )}

          {/* ── LOGIN ── */}
          {loginView && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs text-text-secondary mb-2">Email ou Téléphone</label>
                <div className="relative">
                  <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" strokeWidth={1.5} />
                  <input
                    type="text"
                    value={loginForm.phoneOrEmail}
                    onChange={(e) => setLoginForm({ ...loginForm, phoneOrEmail: e.target.value })}
                    placeholder="votre@email.com ou +226 XX XX XX XX"
                    className="w-full pl-11 pr-4 py-3 bg-background-secondary border-0 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none transition-colors"
                    disabled={loading}
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-2">Mot de passe</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" strokeWidth={1.5} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    placeholder="••••••"
                    className="w-full pl-11 pr-11 py-3 bg-background-secondary border-0 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none transition-colors"
                    disabled={loading}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              {error && (
                <div className="bg-red-50 border border-red-100 text-error px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={loading || !loginForm.phoneOrEmail || !loginForm.password}
                className="w-full py-3 bg-accent-primary text-white text-sm font-medium rounded-lg hover:bg-accent-secondary transition-colors disabled:opacity-50"
              >
                {loading ? 'Connexion...' : 'Se connecter'}
              </button>
              <div className="flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => { setView('forgot'); setError(''); setSuccess(''); }}
                  className="text-xs text-accent-primary hover:text-accent-secondary font-medium"
                >
                  Mot de passe oublié ?
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Register link */}
        {loginView && (
          <div className="mt-6 text-center">
            <p className="text-sm text-text-secondary">
              Pas encore de compte ?{' '}
              <Link to="/register" className="font-medium text-accent-primary hover:text-accent-secondary transition-colors">
                Créer un compte
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Auth;
