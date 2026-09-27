/**
 * FasoFree — Page document légal (dashboard, lecture seule)
 *
 * Route : /legal/:docCode — sert le contenu depuis le BACKEND
 * (GET /legal/documents/:docCode, la DB est la source de vérité).
 * Les références croisées entre documents du pack (FR-PRIV-002.md, …)
 * deviennent des liens internes /legal/:docCode qui restent dans l'espace
 * connecté au lieu d'éjecter vers /login.
 */
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Loader2, AlertTriangle, ScrollText } from 'lucide-react';
import MarkdownView from '../components/MarkdownView';
import { getLegalDocument } from '../services/legalService';

const T = {
  bg: '#0D0D0D',
  bgCard: '#161616',
  border: '#2A2520',
  text: '#F0EDE8',
  textSec: '#A09890',
  textTer: '#6B6359',
  accent: '#C1652E',
  font: "'Manrope', system-ui, sans-serif",
};

const LegalDocPage = () => {
  const { docCode } = useParams();
  const navigate = useNavigate();

  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setDoc(null);

    getLegalDocument(docCode)
      .then((data) => {
        if (!cancelled) setDoc(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Document introuvable');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [docCode]);

  return (
    <div style={{ minHeight: '100vh', background: T.bg, fontFamily: T.font }}>
      <header style={{
        position: 'sticky', top: 0, zIndex: 20, background: T.bg,
        borderBottom: `1px solid ${T.border}`, padding: '16px 20px',
      }}>
        <div style={{ maxWidth: 820, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            onClick={() => navigate(-1)}
            style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 4, color: T.text }}
            aria-label="Retour"
          >
            <ArrowLeft size={18} strokeWidth={1.5} />
          </button>
          <ScrollText size={18} style={{ color: T.accent }} strokeWidth={1.5} />
          <p style={{ color: T.text, fontSize: 15, fontWeight: 700, margin: 0 }}>Document légal</p>
        </div>
      </header>

      <div style={{ maxWidth: 820, margin: '0 auto', padding: '28px 20px 48px' }}>
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: 10, color: T.textSec }}>
            <Loader2 size={20} style={{ animation: 'fasofree-spin 0.8s linear infinite', color: T.accent }} />
            <span style={{ fontSize: 13 }}>Chargement du document…</span>
          </div>
        )}

        {error && !loading && (
          <div style={{
            border: `1px solid rgba(239,68,68,0.25)`, background: 'rgba(239,68,68,0.08)',
            borderRadius: 12, padding: '28px 20px', textAlign: 'center',
          }}>
            <AlertTriangle size={28} style={{ color: '#EF4444', margin: '0 auto 10px' }} strokeWidth={1.5} />
            <p style={{ color: T.text, fontSize: 14, fontWeight: 600, margin: '0 0 4px' }}>Document indisponible</p>
            <p style={{ color: T.textSec, fontSize: 12.5, margin: 0 }}>{error}</p>
          </div>
        )}

        {doc && !loading && (
          <article style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, padding: '28px 24px 36px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingBottom: 18, marginBottom: 22, borderBottom: `1px solid ${T.border}` }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11,
                fontWeight: 700, padding: '5px 10px', borderRadius: 999,
                background: 'rgba(193,101,46,0.12)', color: T.accent,
              }}>
                <FileText size={11} strokeWidth={2} /> {doc.docCode}
              </span>
              <span style={{
                fontSize: 11, padding: '5px 10px', borderRadius: 999,
                background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.border}`, color: T.textSec,
              }}>
                Version {doc.version}
              </span>
              {doc.date && (
                <span style={{
                  fontSize: 11, padding: '5px 10px', borderRadius: 999,
                  background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.border}`, color: T.textSec,
                }}>
                  {doc.date}
                </span>
              )}
            </div>

            <div style={{ color: T.text, fontSize: 14 }}>
              <MarkdownView content={doc.contentMd} accentColor={T.accent} />
            </div>
          </article>
        )}
      </div>
    </div>
  );
};

export default LegalDocPage;