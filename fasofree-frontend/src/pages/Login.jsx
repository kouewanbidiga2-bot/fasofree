/**
 * Copyright (c) 2026 BIDIGA Imrane - Koliwa. All rights reserved.
 * Proprietary and confidential.
 */

/** Connexion du livreur. Réservée aux comptes DRIVER / COURIER (vérifié au store). */
import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import useAuthStore from '../store/authStore';
import { ErrorNote } from '../components/ui';
import { KoliwaParcel, KoliwaWordmark } from '../components/brand';

const Login = () => {
  const token = useAuthStore((s) => s.token);
  const login = useAuthStore((s) => s.login);
  const error = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => clearError(), [clearError]);

  if (token) return <Navigate to="/missions" replace />;

  const onSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate('/missions', { replace: true });
    } catch {
      /* le message est déjà dans le store */
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login">
      <div className="login-hero">
        {/* Le nom se transforme en logo, puis revient : la marque respire au lieu d'être figée. */}
        <div className="brand-morph">
          <span className="brand-morph__word">
            <KoliwaWordmark height={30} />
          </span>
          <span className="brand-morph__mark" aria-hidden="true">
            <KoliwaParcel size={34} alt="" />
          </span>
        </div>
        <p>Coursier · Ouagadougou. Connectez-vous pour voir les courses disponibles près de vous.</p>
      </div>

      <ErrorNote>{error}</ErrorNote>

      <form className="login-form" onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            className="input"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vous@exemple.com"
          />
        </div>

        <div className="field">
          <label htmlFor="password">Mot de passe</label>
          <div style={{ position: 'relative' }}>
            <input
              id="password"
              className="input"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{ paddingRight: 54 }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              style={{
                position: 'absolute',
                right: 6,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 0,
                padding: 10,
                color: 'var(--ink-3)',
                cursor: 'pointer',
                lineHeight: 0,
              }}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>

      <p className="login-foot">Pas encore coursier ? Inscription auprès de l'équipe Koliwa.</p>
    </div>
  );
};

export default Login;
