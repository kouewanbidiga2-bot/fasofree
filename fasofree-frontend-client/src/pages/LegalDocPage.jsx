import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Loader2, AlertTriangle, ScrollText } from 'lucide-react';
import { api } from '../services/api';
import MarkdownView from '../components/markdown/MarkdownView';

const ACCENT = '#C1652E';

/**
 * ⚖️ Page document légal — contenu servi par le BACKEND
 * (GET /legal/documents/:docCode, la DB est la source de vérité).
 *
 * Routes : /legal/:docCode (générique), et alias /terms, /privacy,
 * /cookies, /cgv (voir App.jsx).
 */
const LegalDocPage = ({ docCode: fixedDocCode }) => {
  const { docCode: paramDocCode } = useParams();
  const navigate = useNavigate();
  const docCode = fixedDocCode || paramDocCode;

  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setDoc(null);

    api
      .getLegalDocument(docCode)
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
    <div className="min-h-screen bg-background-primary">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background-primary border-b border-border-light">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-background-secondary transition-colors"
              aria-label="Retour"
            >
              <ArrowLeft size={18} className="text-text-primary" strokeWidth={1.5} />
            </button>
            <div className="flex items-center gap-2">
              <ScrollText size={18} className="text-text-secondary" strokeWidth={1.5} />
              <h1 className="text-base font-display font-bold text-text-primary">
                Document légal
              </h1>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading && (
          <div className="flex items-center justify-center py-20 text-text-secondary">
            <Loader2 size={22} className="animate-spin mr-3 text-accent-primary" />
            <span className="text-sm">Chargement du document…</span>
          </div>
        )}

        {error && !loading && (
          <div className="rounded-lg border border-error/20 bg-error/5 px-4 py-6 text-center">
            <AlertTriangle size={28} className="mx-auto mb-3 text-error" strokeWidth={1.5} />
            <p className="text-sm text-text-primary font-medium">Document indisponible</p>
            <p className="text-xs text-text-secondary mt-1">{error}</p>
            <button
              onClick={() => navigate('/')}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium text-white hover:opacity-90 transition-opacity"
              style={{ backgroundColor: ACCENT }}
            >
              Retour à l’accueil
            </button>
          </div>
        )}

        {doc && !loading && (
          <article className="bg-background-secondary/40 border border-border-light rounded-xl p-5 sm:p-8">
            {/* Métadonnées du document */}
            <div className="flex flex-wrap items-center gap-2 mb-5 pb-5 border-b border-border-light">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-medium px-2.5 py-1 rounded-full"
                    style={{ backgroundColor: '#FDF3EA', color: ACCENT }}>
                <FileText size={11} strokeWidth={2} />
                {doc.docCode}
              </span>
              <span className="text-[11px] px-2.5 py-1 rounded-full bg-background-secondary border border-border-light text-text-secondary">
                Version {doc.version}
              </span>
              {doc.date && (
                <span className="text-[11px] px-2.5 py-1 rounded-full bg-background-secondary border border-border-light text-text-secondary">
                  {doc.date}
                </span>
              )}
            </div>

            <MarkdownView content={doc.contentMd} />
          </article>
        )}
      </div>
    </div>
  );
};

export default LegalDocPage;