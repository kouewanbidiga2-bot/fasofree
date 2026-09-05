import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Shield, ArrowLeft, RefreshCw, CheckCircle, Loader2 } from 'lucide-react';
import { api } from '../services/api';
import useAuthStore, { getHomeRoute } from '../store/authStore';

const OTP_LENGTH = 6;

const VerifyAccount = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setVerified, user } = useAuthStore();

  const email = location.state?.email;

  const [code, setCode] = useState(Array(OTP_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const [resending, setResending] = useState(false);
  const inputRefs = useRef([]);

  useEffect(() => {
    if (!user) {
      navigate('/register', { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    if (user) {
      api.sendOtp().catch(() => {});
    }
  }, [user]);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendTimer]);

  const handleSubmit = useCallback(async (codeString) => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      await api.verifyOtp(codeString);
      setSuccess(true);
      setVerified();

      // Refresh user profile to get updated verification status
      try {
        const meResponse = await api.getMe();
        const userData = meResponse.data || meResponse;
        // Update store with fresh user data
        localStorage.setItem('fasofree_user', JSON.stringify({
          ...user,
          isEmailVerified: !!userData.isEmailVerified,
          isPhoneVerified: !!userData.isPhoneVerified,
        }));
      } catch {
        // Non-critical — setVerified already updated local state
      }

      setTimeout(() => {
        const homeRoute = getHomeRoute(user.role);
        if (homeRoute.startsWith('http')) {
          window.location.href = homeRoute;
        } else {
          navigate(homeRoute, { replace: true });
        }
      }, 1500);
    } catch (err) {
      setError(err.message || 'Code incorrect. Réessayez.');
      setCode(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }, [user, setVerified, navigate]);

  const handleCodeChange = useCallback((index, value) => {
    if (!/^\d*$/.test(value)) return;
    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);
    setError('');

    if (value && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    if (value && index === OTP_LENGTH - 1) {
      const fullCode = newCode.join('');
      if (fullCode.length === OTP_LENGTH) {
        handleSubmit(fullCode);
      }
    }
  }, [code, handleSubmit]);

  const handleKeyDown = useCallback((index, e) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }, [code]);

  const handlePaste = useCallback((e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (pasted) {
      const newCode = pasted.split('').concat(Array(OTP_LENGTH).fill('')).slice(0, OTP_LENGTH);
      setCode(newCode);
      const nextEmpty = newCode.findIndex((d) => !d);
      const focusIndex = nextEmpty === -1 ? OTP_LENGTH - 1 : nextEmpty;
      inputRefs.current[focusIndex]?.focus();
      if (pasted.length === OTP_LENGTH) {
        setTimeout(() => handleSubmit(pasted), 100);
      }
    }
  }, [handleSubmit]);

  const handleResend = async () => {
    if (!user || resendTimer > 0) return;
    setResending(true);
    try {
      await api.sendOtp();
      setResendTimer(60);
      setCode(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } catch (err) {
      setError(err.message || 'Impossible de renvoyer le code');
    } finally {
      setResending(false);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background-primary flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#C1652E] flex items-center justify-center">
            <Shield size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-semibold text-[#2D2A26] mb-2">Vérifiez votre compte</h1>
          <p className="text-sm text-[#70645C]">
            Un code à 6 chiffres a été envoyé à<br />
            <span className="font-medium text-text-primary">{email || 'votre adresse'}</span>
          </p>
        </div>

        <div className="bg-background-card rounded-xl border border-border-light p-6">
          {success ? (
            <div className="text-center py-8">
              <CheckCircle size={48} className="mx-auto text-green-500 mb-4" />
              <p className="text-lg font-medium text-text-primary mb-2">Compte verifie !</p>
              <p className="text-sm text-text-secondary">Redirection en cours...</p>
            </div>
          ) : (
            <>
              <div className="flex justify-center gap-2 mb-6">
                {code.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => (inputRefs.current[i] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleCodeChange(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    onPaste={handlePaste}
                    disabled={loading}
                    className="w-12 h-14 text-center text-xl font-semibold border border-[#E8E0D8] rounded-lg focus:outline-none focus:border-[#C1652E] transition disabled:opacity-50"
                    autoFocus={i === 0}
                  />
                ))}
              </div>

              {error && (
                <p className="text-sm text-red-500 text-center mb-4">{error}</p>
              )}

              <button
                onClick={() => handleSubmit(code.join(''))}
                disabled={loading || code.join('').length !== OTP_LENGTH}
                className="w-full py-3 text-white text-sm font-medium transition disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ backgroundColor: '#C1652E' }}
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Vérification...
                  </>
                ) : (
                  'Vérifier'
                )}
              </button>

              <div className="text-center mt-6">
                {resendTimer > 0 ? (
                  <p className="text-sm text-[#70645C]">
                    Renvoyer le code dans{' '}
                    <span className="font-medium text-[#C1652E]">{resendTimer}s</span>
                  </p>
                ) : (
                  <button
                    onClick={handleResend}
                    disabled={resending}
                    className="text-sm font-medium text-[#C1652E] hover:underline flex items-center justify-center gap-1 mx-auto"
                  >
                    <RefreshCw size={14} className={resending ? 'animate-spin' : ''} />
                    Renvoyer le code
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        <div className="text-center mt-6">
          <button
            onClick={() => navigate('/register')}
            className="text-sm text-[#70645C] hover:text-[#C1652E] flex items-center justify-center gap-1 mx-auto"
          >
            <ArrowLeft size={14} />
            Retour à l'inscription
          </button>
        </div>
      </div>
    </div>
  );
};

export default VerifyAccount;
