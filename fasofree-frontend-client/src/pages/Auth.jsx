import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Mail, UserPlus, Phone, KeyRound, Eye, EyeOff } from 'lucide-react';
import useAuthStore from '../store/authStore';
import { api } from '../services/api';

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const resetToken = searchParams.get('token');
  const { loginWithToken } = useAuthStore();
  const [isLogin, setIsLogin] = useState(!resetToken);
  const [showForgot, setShowForgot] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [loginForm, setLoginForm] = useState({
    phoneOrEmail: '',
    password: '',
  });
  
  const [registerForm, setRegisterForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [forgotEmail, setForgotEmail] = useState('');
  const [resetForm, setResetForm] = useState({
    newPassword: '',
    confirmPassword: '',
  });

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
        });

        const normalizedRole = user.role ? String(user.role).toUpperCase() : 'CLIENT';
        if (['DRIVER', 'COURIER'].includes(normalizedRole)) {
          navigate('/driver-dashboard');
        } else if (['BUSINESS_ADMIN', 'MERCHANT'].includes(normalizedRole)) {
          navigate('/merchant-dashboard');
        } else if (['CLIENT', 'CUSTOMER', 'USER'].includes(normalizedRole)) {
          navigate('/');
        } else {
          navigate('/dashboard');
        }
      } else {
        setError('Authentification échouée');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError(err.message || 'Email ou mot de passe incorrect');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');

    if (registerForm.password !== registerForm.confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    if (registerForm.password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    setLoading(true);

    try {
      const response = await api.register({
        fullName: `${registerForm.firstName} ${registerForm.lastName}`.trim(),
        phone: registerForm.phone,
        email: registerForm.email,
        password: registerForm.password,
      });

      if (response) {
        alert('Compte créé avec succès ! Connectez-vous maintenant.');
        setIsLogin(true);
      }
    } catch (err) {
      console.error('Registration error:', err);
      setError(err.message || 'Erreur lors de la création du compte');
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
      setSuccess('Si cet email existe, un lien de réinitialisation vous a été envoyé. Vérifiez votre boîte de réception.');
      setForgotEmail('');
    } catch (err) {
      setError(err.message || 'Erreur lors de l\'envoi');
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
      setSuccess('Mot de passe réinitialisé avec succès ! Redirection vers la connexion...');
      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (err) {
      setError(err.message || 'Erreur lors de la réinitialisation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white border border-orange-100 rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center mx-auto mb-4 shadow-lg">
              {showForgot ? <KeyRound size={36} className="text-white" strokeWidth={2} />
                : isLogin ? <Lock size={36} className="text-white" strokeWidth={2} />
                : <UserPlus size={36} className="text-white" strokeWidth={2} />}
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">FasoFree</h1>
            <p className="text-sm text-gray-600">
              {resetToken ? 'Réinitialisez votre mot de passe'
                : showForgot ? 'Récupérez votre accès'
                : isLogin ? 'Connectez-vous à votre compte' : 'Créez votre compte'}
            </p>
          </div>

          {/* ── RESET PASSWORD (via token URL) ── */}
          {resetToken ? (
            <form onSubmit={handleResetPassword} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nouveau mot de passe</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type={showPassword ? 'text' : 'password'} value={resetForm.newPassword}
                    onChange={(e) => setResetForm({ ...resetForm, newPassword: e.target.value })}
                    placeholder="Minimum 8 caractères" required minLength={8}
                    className="w-full pl-11 pr-11 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all text-sm" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Confirmer</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="password" value={resetForm.confirmPassword}
                    onChange={(e) => setResetForm({ ...resetForm, confirmPassword: e.target.value })}
                    placeholder="Confirmez le mot de passe" required
                    className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all text-sm" />
                </div>
              </div>
              {error && <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-lg text-sm">{error}</div>}
              {success && <div className="bg-green-50 border border-green-100 text-green-600 px-4 py-3 rounded-lg text-sm">{success}</div>}
              <button type="submit" disabled={loading || !resetForm.newPassword || !resetForm.confirmPassword}
                className="w-full px-4 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl hover:from-orange-600 hover:to-amber-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-md hover:shadow-lg">
                {loading ? 'Réinitialisation...' : 'Réinitialiser le mot de passe'}
              </button>
            </form>

          /* ── FORGOT PASSWORD ── */
          ) : showForgot ? (
            <form onSubmit={handleForgotPassword} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <div className="relative">
                  <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="email" value={forgotEmail} required
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="votre@email.com"
                    className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all text-sm" />
                </div>
              </div>
              {error && <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-lg text-sm">{error}</div>}
              {success && <div className="bg-green-50 border border-green-100 text-green-600 px-4 py-3 rounded-lg text-sm">{success}</div>}
              <button type="submit" disabled={loading || !forgotEmail}
                className="w-full px-4 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl hover:from-orange-600 hover:to-amber-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-md hover:shadow-lg">
                {loading ? 'Envoi...' : 'Envoyer le lien de récupération'}
              </button>
              <div className="text-center">
                <button type="button" onClick={() => { setShowForgot(false); setError(''); setSuccess(''); }}
                  className="text-sm text-orange-600 hover:text-orange-700 font-medium">
                  Retour à la connexion
                </button>
              </div>
            </form>

          /* ── LOGIN ── */
          ) : isLogin ? (
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email ou Téléphone</label>
                <div className="relative">
                  <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" value={loginForm.phoneOrEmail}
                    onChange={(e) => setLoginForm({ ...loginForm, phoneOrEmail: e.target.value })}
                    placeholder="votre@email.com ou +226 XX XX XX XX"
                    className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all text-sm"
                    disabled={loading} required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Mot de passe</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="password" value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    placeholder="••••••"
                    className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all text-sm"
                    disabled={loading} required />
                </div>
              </div>
              {error && <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-lg text-sm">{error}</div>}
              <button type="submit" disabled={loading || !loginForm.phoneOrEmail || !loginForm.password}
                className="w-full px-4 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl hover:from-orange-600 hover:to-amber-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-md hover:shadow-lg">
                {loading ? 'Connexion...' : 'Se connecter'}
              </button>
              <div className="text-center">
                <button type="button" onClick={() => { setShowForgot(true); setError(''); setSuccess(''); }}
                  className="text-sm text-orange-600 hover:text-orange-700 font-medium">
                  Mot de passe oublié ?
                </button>
              </div>
            </form>

          /* ── REGISTER ── */
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Prénom</label>
                  <input type="text" value={registerForm.firstName}
                    onChange={(e) => setRegisterForm({ ...registerForm, firstName: e.target.value })}
                    placeholder="Jean"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all text-sm"
                    disabled={loading} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nom</label>
                  <input type="text" value={registerForm.lastName}
                    onChange={(e) => setRegisterForm({ ...registerForm, lastName: e.target.value })}
                    placeholder="Doe"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all text-sm"
                    disabled={loading} required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <div className="relative">
                  <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="email" value={registerForm.email}
                    onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                    placeholder="votre@email.com"
                    className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all text-sm"
                    disabled={loading} required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Téléphone</label>
                <div className="relative">
                  <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="tel" value={registerForm.phone}
                    onChange={(e) => setRegisterForm({ ...registerForm, phone: e.target.value })}
                    placeholder="+226 XX XX XX XX"
                    className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all text-sm"
                    disabled={loading} required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Mot de passe</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type={showPassword ? 'text' : 'password'} value={registerForm.password}
                    onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                    placeholder="Minimum 8 caractères"
                    className="w-full pl-11 pr-11 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all text-sm"
                    disabled={loading} required minLength={8} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Confirmer le mot de passe</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="password" value={registerForm.confirmPassword}
                    onChange={(e) => setRegisterForm({ ...registerForm, confirmPassword: e.target.value })}
                    placeholder="••••••"
                    className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all text-sm"
                    disabled={loading} required />
                </div>
              </div>
              {error && <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-lg text-sm">{error}</div>}
              {success && <div className="bg-green-50 border border-green-100 text-green-600 px-4 py-3 rounded-lg text-sm">{success}</div>}
              <button type="submit" disabled={loading || !registerForm.email || !registerForm.password || !registerForm.firstName || !registerForm.lastName}
                className="w-full px-4 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl hover:from-orange-600 hover:to-amber-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-md hover:shadow-lg">
                {loading ? 'Création...' : 'Créer mon compte'}
              </button>
            </form>
          )}

          {/* ── Toggle login/register (pas sur forgot/reset) ── */}
          {!resetToken && !showForgot && (
            <div className="mt-6 text-center">
              <button onClick={() => { setIsLogin(!isLogin); setError(''); setSuccess(''); }}
                className="text-sm text-orange-600 hover:text-orange-700 font-medium">
                {isLogin ? "Pas de compte ? Créer un compte" : "Déjà un compte ? Se connecter"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Auth;
