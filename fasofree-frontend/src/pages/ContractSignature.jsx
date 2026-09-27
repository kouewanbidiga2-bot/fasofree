/**
 * FasoFree — Signature de contrat (marchands & livreurs)
 *
 * Écran bloquant affiché tant que le contrat (FR-PMERC-005 pour les
 * marchands, FR-LIVR-006 pour les livreurs) n'est pas signé via OTP.
 * Le backend enregistre l'acceptation (mécanisme signature-otp, version
 * du document, date/heure, IP) — la source de vérité est la DB.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, FileSignature, Loader2, MailCheck, CheckCircle2, AlertTriangle, ScrollText, KeyRound } from 'lucide-react';
import useAuthStore from '../store/authStore';
import MarkdownView from '../components/MarkdownView';
import { getContractStatus, getLegalDocument, sendContractOtp, signContract } from '../services/legalService';

const T = {
  bg: '#0D0D0D',
  bgCard: '#1A1A1A',
  bgSecondary: '#161616',
  bgTertiary: '#101010',
  text: '#F0EDE8',
  textSec: '#A09890',
  textTer: '#6B6359',
  border: '#2A2520',
  borderLight: '#241F1B',
  accent: '#C1652E',
  success: '#3FB97F',
  error: '#EF4444',
  errorBg: 'rgba(239,68,68,0.12)',
  font: "'Manrope', system-ui, sans-serif",
};

const ContractSignature = () => {
  const navigate = useNavigate();
  const getDashboardRoute = useAuthStore((s) => s.getDashboardRoute);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [contract, setContract] = useState(null); // { docCode, docVersion, title }
  const [doc, setDoc] = useState(null);           // document légal complet
  const [alreadySigned, setAlreadySigned] = useState(false);
  const [readRatio, setReadRatio] = useState(0);   // progression de lecture 0..1

  const [otpSent, setOtpSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [signed, setSigned] = useState(null);      // réponse de signContract

  const contentRef = useRef(null);

  // Charge le contrat en attente + le document légal associé
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const status = await getContractStatus();
        if (cancelled) return;
        if (!status?.pending || !status?.contract) {
          setAlreadySigned(true);
          setLoading(false);
          return;
        }
        setContract(status.contract);
        const docData = await getLegalDocument(status.contract.docCode);
        if (!cancelled) {
          setDoc(docData);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Impossible de charger le contrat. Veuillez réessayer.');
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Compte à rebours du cooldown de renvoi (60 s, géré aussi côté backend)
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown > 0]);

  // Si le contrat tient entièrement dans la zone de lecture (pas de scroll
  // possible), il est considéré comme lu d'emblée — sinon l'utilisateur
  // serait bloqué sans pouvoir déclencher l'événement onScroll. La mesure
  // est reprise à la frame suivante et à chaque resize : si le contenu se
  // met en page avec un léger délai (police web, etc.), le conteneur peut
  // devenir scrollable après le premier calcul — seul le cas « pas de
  // scroll possible » change readRatio, jamais l'inverse.
  useEffect(() => {
    if (!doc || alreadySigned || signed) return;
    const measure = () => {
      const el = contentRef.current;
      if (!el) return;
      const max = el.scrollHeight - el.clientHeight;
      if (max <= 0) {
        setReadRatio(1);
      }
    };
    measure();
    const raf = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', measure);
    };
  }, [doc, alreadySigned, signed]);

  // Lecture « ouverte » dès 98 % du parcours (progression continue mesurée
  // à chaque scroll — un compteur de titres exigerait 28 à 33 scrolls puis
  // bloquerait : une fois au bas du conteneur, événement scroll épuisé).
  const allRead = readRatio >= 0.98;

  const handleSendOtp = async () => {
    setOtpError('');
    try {
      await sendContractOtp();
      setOtpSent(true);
      setCooldown(60);
    } catch (err) {
      setOtpError(err.message || 'Impossible d’envoyer le code. Réessayez dans un instant.');
    }
  };

  const handleSign = async () => {
    if (!code.trim()) {
      setOtpError('Saisissez le code reçu');
      return;
    }
    setSubmitting(true);
    setOtpError('');
    try {
      const result = await signContract(code.trim());
      setSigned(result);
    } catch (err) {
      setOtpError(err.message || 'Code incorrect ou expiré. Demandez un nouveau code.');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Chargement ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: T.font }}>
        <div style={{ textAlign: 'center' }}>
          <Loader2 size={34} style={{ color: T.accent, animation: 'fasofree-spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: T.textSec, fontSize: 14 }}>Chargement de votre contrat…</p>
        </div>
      </div>
    );
  }

  // ─── Déjà signé ──────────────────────────────────────────────────────────
  if (alreadySigned) {
    return (
      <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: T.font, padding: '0 16px' }}>
        <div style={{ width: '100%', maxWidth: 420, textAlign: 'center' }}>
          <CheckCircle2 size={46} style={{ color: T.success, margin: '0 auto 16px' }} strokeWidth={1.5} />
          <h1 style={{ fontSize: 22, fontWeight: 800, color: T.text, margin: '0 0 8px' }}>Contrat déjà signé</h1>
          <p style={{ color: T.textSec, fontSize: 13, lineHeight: 1.6, marginBottom: 24 }}>
            Votre contrat est signé et enregistré. Vous pouvez accéder à votre espace.
          </p>
          <button
            onClick={() => navigate(getDashboardRoute())}
            style={{
              width: '100%', padding: '14px 0', fontSize: 14, fontWeight: 700, fontFamily: T.font,
              color: '#fff', background: T.accent, border: 'none', borderRadius: 10, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            Accéder à mon espace <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  // ─── Erreur de chargement ────────────────────────────────────────────────
  if (error && !doc) {
    return (
      <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: T.font, padding: '0 16px' }}>
        <div style={{ width: '100%', maxWidth: 420, textAlign: 'center' }}>
          <AlertTriangle size={40} style={{ color: T.error, margin: '0 auto 16px' }} strokeWidth={1.5} />
          <h1 style={{ fontSize: 20, fontWeight: 800, color: T.text, margin: '0 0 8px' }}>Contrat indisponible</h1>
          <p style={{ color: T.textSec, fontSize: 13, lineHeight: 1.6, marginBottom: 24 }}>{error}</p>
          <button
            onClick={() => window.location.reload()}
            style={{
              width: '100%', padding: '14px 0', fontSize: 14, fontWeight: 700, fontFamily: T.font,
              color: '#fff', background: T.accent, border: 'none', borderRadius: 10, cursor: 'pointer',
            }}
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  // ─── Signature (succès) ──────────────────────────────────────────────────
  if (signed) {
    return (
      <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: T.font, padding: '0 16px' }}>
        <div style={{ width: '100%', maxWidth: 460, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(63,185,127,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <CheckCircle2 size={36} style={{ color: T.success }} strokeWidth={1.5} />
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: T.text, margin: 0 }}>Contrat signé !</h1>
            <p style={{ color: T.textSec, fontSize: 14, marginTop: 8, lineHeight: 1.6 }}>
              {signed.docCode} — version {signed.docVersion}
            </p>
          </div>
          <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, padding: 20, marginBottom: 24 }}>
            <p style={{ color: T.textSec, fontSize: 13, lineHeight: 1.7, margin: 0 }}>
              Votre signature électronique a été enregistrée avec la date, l'heure et la version
              du document acceptée. Pour FasoFree, c'est une exigence contractuelle : vous pouvez
              désormais utiliser pleinement votre espace.
            </p>
          </div>
          <button
            onClick={() => navigate(getDashboardRoute())}
            style={{
              width: '100%', padding: '15px 0', fontSize: 14, fontWeight: 700, fontFamily: T.font,
              color: '#fff', background: T.accent, border: 'none', borderRadius: 10, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: '0 4px 14px rgba(193,101,46,0.3)',
            }}
          >
            Accéder à mon espace <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  // ─── Écran principal : lecture + OTP ─────────────────────────────────────
  const readPercent = Math.round(readRatio * 100);

  return (
    <div style={{ minHeight: '100vh', background: T.bg, fontFamily: T.font }}>
      {/* Header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 20, background: T.bg, borderBottom: `1px solid ${T.borderLight}`, padding: '16px 20px' }}>
        <div style={{ maxWidth: 820, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <ScrollText size={20} style={{ color: T.accent }} strokeWidth={1.5} />
          <div>
            <p style={{ color: T.text, fontSize: 15, fontWeight: 700, margin: 0 }}>Signature du contrat obligatoire</p>
            <p style={{ color: T.textTer, fontSize: 12, margin: '2px 0 0' }}>
              {contract?.docCode} — version {contract?.docVersion}
            </p>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 820, margin: '0 auto', padding: '28px 20px 48px' }}>
        {/* Étape 1 : lecture */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <span style={{
            width: 24, height: 24, borderRadius: '50%', background: T.accent, color: '#fff',
            fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>1</span>
          <p style={{ color: T.text, fontSize: 14, fontWeight: 700, margin: 0 }}>
            Lisez votre contrat <span style={{ color: T.textSec, fontWeight: 500 }}>({readPercent} % parcourus{allRead ? ' — lecture terminée' : ', continuez à défiler'})</span>
          </p>
        </div>

        <div
          ref={contentRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            const max = el.scrollHeight - el.clientHeight;
            if (max > 0) {
              const ratio = Math.min(1, Math.max(0, el.scrollTop / max));
              setReadRatio((r) => (ratio > r ? ratio : r));
            }
          }}
          style={{
            background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14,
            padding: '24px 24px 32px', maxHeight: 420, overflowY: 'auto', color: T.text, fontSize: 14,
          }}
        >
          <MarkdownView content={doc?.contentMd || ''} accentColor={T.accent} />
        </div>

        {/* Étape 2 : OTP */}
        <div style={{ marginTop: 24, border: `1px solid ${allRead ? T.border : T.borderLight}`, borderRadius: 14, padding: 20, background: allRead ? T.bgCard : T.bgTertiary, opacity: allRead ? 1 : 0.6, transition: 'opacity 0.3s' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <span style={{
              width: 24, height: 24, borderRadius: '50%', background: allRead ? T.accent : T.textTer,
              color: '#fff', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>2</span>
            <p style={{ color: T.text, fontSize: 14, fontWeight: 700, margin: 0 }}>
              Recevez un code de confirmation ({allRead ? 'disponible' : 'finissez la lecture pour débloquer'})
            </p>
          </div>

          {!otpSent ? (
            <button
              onClick={handleSendOtp}
              disabled={!allRead || cooldown > 0}
              style={{
                width: '100%', padding: '14px 0', fontSize: 14, fontWeight: 700, fontFamily: T.font,
                color: '#fff', background: allRead ? T.accent : T.textTer, border: 'none', borderRadius: 10,
                cursor: allRead ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: 8, transition: 'all 0.2s',
              }}
            >
              <MailCheck size={17} /> Recevoir le code par email/SMS
            </button>
          ) : (
            <div style={{ marginTop: 4 }}>
              <div style={{ background: 'rgba(193,101,46,0.08)', border: '1px solid rgba(193,101,46,0.25)', borderRadius: 10, padding: '12px 14px', marginBottom: 16, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <KeyRound size={16} style={{ color: T.accent, marginTop: 2 }} strokeWidth={1.5} />
                <p style={{ color: T.textSec, fontSize: 12.5, lineHeight: 1.6, margin: 0 }}>
                  Un code à 6 chiffres vous a été envoyé. Il expire dans 5 minutes.
                  {cooldown > 0 && <>{' '}<span style={{ color: T.accent }}>Renvoi possible dans {cooldown}s.</span></>}
                </p>
              </div>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="Code à 6 chiffres"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '13px 14px', fontSize: 16, letterSpacing: '0.35em',
                  textAlign: 'center', fontFamily: T.font, color: T.text, background: T.bgSecondary,
                  border: `1.5px solid ${otpError ? T.error : T.border}`, borderRadius: 10, outline: 'none',
                }}
              />
              {otpError && <p style={{ color: T.error, fontSize: 12, margin: '8px 0 0' }}>{otpError}</p>}

              <button
                onClick={handleSign}
                disabled={submitting || code.length < 6}
                style={{
                  width: '100%', marginTop: 16, padding: '15px 0', fontSize: 14, fontWeight: 700, fontFamily: T.font,
                  color: '#fff', background: T.accent, border: 'none', borderRadius: 10, cursor: submitting || code.length < 6 ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: submitting || code.length < 6 ? 0.6 : 1,
                  boxShadow: '0 4px 14px rgba(193,101,46,0.3)',
                }}
              >
                {submitting ? (
                  <><Loader2 size={16} style={{ animation: 'fasofree-spin 0.8s linear infinite' }} /> Signature en cours…</>
                ) : (
                  <><FileSignature size={17} /> Confirmer et signer le contrat</>
                )}
              </button>

              {cooldown === 0 && (
                <button
                  onClick={handleSendOtp}
                  style={{
                    width: '100%', marginTop: 10, padding: '10px 0', fontSize: 12.5, fontWeight: 600,
                    fontFamily: T.font, color: T.textSec, background: 'none', border: 'none', cursor: 'pointer',
                  }}
                >
                  Renvoyer un code
                </button>
              )}
            </div>
          )}
        </div>

        <p style={{ color: T.textTer, fontSize: 11.5, lineHeight: 1.7, textAlign: 'center', marginTop: 22, maxWidth: 520, marginLeft: 'auto', marginRight: 'auto' }}>
          En signant, la version {contract?.docVersion} du document {contract?.docCode} sera enregistrée avec la date,
          l'heure et votre adresse IP. L'agrément d'exploitation débute après cette signature.
        </p>
      </div>
    </div>
  );
};

export default ContractSignature;