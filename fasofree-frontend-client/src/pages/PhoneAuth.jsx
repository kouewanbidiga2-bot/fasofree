import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, ArrowRight, User, Mail } from 'lucide-react';
import useAuthStore from '../store/authStore';

const PhoneAuth = () => {
  const navigate = useNavigate();
  const { loginWithPhone, updateUser } = useAuthStore();
  const [step, setStep] = useState('phone'); // phone, register, verify
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePhoneSubmit = (e) => {
    e.preventDefault();
    setError('');
    
    if (!phone || !/^\+?[0-9\s]{10,}$/.test(phone)) {
      setError('Numéro de téléphone invalide');
      return;
    }

    setLoading(true);
    
    // Simulate checking if user exists
    setTimeout(() => {
      setLoading(false);
      // For demo, always go to register step
      setStep('register');
    }, 1000);
  };

  const handleRegisterSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Le nom est requis');
      return;
    }

    setLoading(true);
    
    // Simulate sending verification code
    setTimeout(() => {
      setLoading(false);
      setStep('verify');
      // Auto-fill demo code
      setCode('1234');
    }, 1000);
  };

  const handleVerifySubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!code || code !== '1234') {
      setError('Code de vérification invalide (utilisez 1234)');
      return;
    }

    setLoading(true);
    
    // Show loading page during verification
    navigate('/loading');
    
    // Complete registration/login
    setTimeout(() => {
      console.log('Attempting login with phone:', phone);
      loginWithPhone(phone, { name, email });
      setLoading(false);
      console.log('Navigating to home...');
      navigate('/');
    }, 2000);
  };

  return (
    <div className="app-page flex items-center justify-center px-4 py-10">
      <div className="max-w-md w-full">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <svg
            className="mx-auto mb-4"
            style={{ width: '80px', height: '80px' }}
            viewBox="0 0 140 140"
            fill="none"
          >
            <ellipse cx="70" cy="70" rx="44" ry="52" stroke="#C1652E" strokeWidth="2" fill="none"/>
            <path d="M38 50 Q70 22 102 50" stroke="#C1652E" strokeWidth="1.5" fill="none" opacity="0.6"/>
            <line x1="70" y1="22" x2="70" y2="38" stroke="#C1652E" strokeWidth="1" opacity="0.4"/>
            <path d="M50 62 Q58 56 66 62 Q58 68 50 62Z" fill="#C1652E" opacity="0.85"/>
            <path d="M74 62 Q82 56 90 62 Q82 68 74 62Z" fill="#C1652E" opacity="0.85"/>
            <path d="M70 62 L64 84 L76 84 Z" fill="#8B7355" opacity="0.7"/>
            <path d="M56 96 Q70 104 84 96" stroke="#C1652E" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
            <line x1="46" y1="78" x2="54" y2="78" stroke="#C1652E" strokeWidth="0.8" opacity="0.3"/>
            <line x1="86" y1="78" x2="94" y2="78" stroke="#C1652E" strokeWidth="0.8" opacity="0.3"/>
            <circle cx="70" cy="70" r="3" fill="#C1652E" opacity="0.2"/>
          </svg>
          <p className="text-text-secondary text-sm">Livraison de repas à Ouagadougou</p>
        </div>

        <div className="app-panel rounded-xl p-6 sm:p-8">
          {step === 'phone' && (
            <>
              <h2 className="text-lg font-medium text-text-primary mb-6">Entrez votre numéro</h2>
              <form onSubmit={handlePhoneSubmit}>
                <div className="mb-6">
                  <label className="block text-xs text-text-secondary mb-2">Numéro de téléphone</label>
                  <div className="relative">
                    <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" strokeWidth={1.5} />
                    <input
                      type="tel"
                      placeholder="+226 XX XX XX XX"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="app-input pl-12"
                      autoFocus
                    />
                  </div>
                </div>
                {error && <p className="text-xs text-red-500 mb-4">{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="app-action w-full gap-2"
                >
                  {loading ? 'Vérification...' : 'Continuer'}
                  {!loading && <ArrowRight size={18} strokeWidth={1.5} />}
                </button>
              </form>
            </>
          )}

          {step === 'register' && (
            <>
              <h2 className="text-lg font-medium text-text-primary mb-6">Créer votre compte</h2>
              <form onSubmit={handleRegisterSubmit}>
                <div className="mb-4">
                  <label className="block text-xs text-text-secondary mb-2">Nom complet</label>
                  <div className="relative">
                    <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" strokeWidth={1.5} />
                    <input
                      type="text"
                      placeholder="Votre nom"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="app-input pl-12"
                      autoFocus
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-xs text-text-secondary mb-2">Email (optionnel)</label>
                  <div className="relative">
                    <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" strokeWidth={1.5} />
                    <input
                      type="email"
                      placeholder="votre@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="app-input pl-12"
                    />
                  </div>
                </div>

                <div className="mb-4 p-3 bg-background-secondary">
                  <p className="text-xs text-text-secondary">Numéro: <span className="font-medium text-text-primary">{phone}</span></p>
                </div>

                {error && <p className="text-xs text-red-500 mb-4">{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="app-action w-full gap-2"
                >
                  {loading ? 'Envoi du code...' : 'Recevoir le code'}
                  {!loading && <ArrowRight size={18} strokeWidth={1.5} />}
                </button>

                <button
                  type="button"
                  onClick={() => setStep('phone')}
                  className="w-full mt-3 px-4 py-3 text-sm text-text-secondary hover:text text-primary transition-colors"
                >
                  Modifier le numéro
                </button>
              </form>
            </>
          )}

          {step === 'verify' && (
            <>
              <h2 className="text-lg font-medium text-text-primary mb-2">Vérification</h2>
              <p className="text-xs text-text-secondary mb-6">Entrez le code envoyé à {phone}</p>
              
              <form onSubmit={handleVerifySubmit}>
                <div className="mb-6">
                  <label className="block text-xs text-text-secondary mb-2">Code de vérification</label>
                  <input
                    type="text"
                    placeholder="XXXX"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    maxLength={4}
                    className="app-input text-center text-2xl tracking-widest font-mono"
                    autoFocus
                  />
                </div>
                {error && <p className="text-xs text-red-500 mb-4">{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="app-action w-full gap-2"
                >
                  {loading ? 'Vérification...' : 'Confirmer'}
                  {!loading && <ArrowRight size={18} strokeWidth={1.5} />}
                </button>
                <button
                  type="button"
                  onClick={() => setStep('register')}
                  className="w-full mt-3 px-4 py-3 text-sm text-text-secondary hover:text text-primary transition-colors"
                >
                  Renvoyer le code
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-xs text-text-secondary mt-6">
          En continuant, vous acceptez nos conditions d'utilisation
        </p>
      </div>
    </div>
  );
};

export default PhoneAuth;
