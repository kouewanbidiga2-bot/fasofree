/**
 * Copyright (c) 2026 BIDIGA Imrane - Koliwa. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, FileText, Loader2, AlertTriangle, ScrollText, ShieldCheck } from 'lucide-react';
import { api } from '../services/api';
import MarkdownView from '../components/markdown/MarkdownView';

/**
 * ⚖️ Page document légal — contenu servi par le BACKEND
 * (GET /legal/documents/:docCode, la DB est la source de vérité).
 *
 * Routes : /legal/:docCode (générique), et alias /terms, /privacy,
 * /cookies, /cgv (voir App.jsx).
 */
const DOC_TABS = [
  { code: 'FR-CGU-001', label: "Conditions d'utilisation", to: '/terms' },
  { code: 'FR-CGV-004', label: 'Conditions de vente', to: '/cgv' },
  { code: 'FR-PRIV-002', label: 'Confidentialité', to: '/privacy' },
  { code: 'FR-COOK-003', label: 'Cookies', to: '/cookies' },
];

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
    <div className="app-page legal-page">
      <header className="legal-header">
        <div className="legal-header-inner">
          <button onClick={() => navigate(-1)} className="legal-back" aria-label="Retour">
            <ArrowLeft size={18} strokeWidth={1.6} aria-hidden="true" />
          </button>
          <div className="legal-heading">
            <ScrollText size={17} strokeWidth={1.6} aria-hidden="true" />
            <span>Documents légaux</span>
          </div>
          <Link to="/" className="legal-home">Accueil</Link>
        </div>
      </header>

      <nav className="legal-tabs" aria-label="Documents légaux">
        {DOC_TABS.map((tab) => (
          <Link
            key={tab.code}
            to={tab.to}
            className="legal-tab"
            aria-current={tab.code === docCode ? 'page' : undefined}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <div className="legal-shell">
        {loading && (
          <div className="legal-state">
            <Loader2 size={22} className="animate-spin" aria-hidden="true" />
            <span>Chargement du document…</span>
          </div>
        )}

        {error && !loading && (
          <div className="legal-state legal-state--error">
            <AlertTriangle size={26} strokeWidth={1.5} aria-hidden="true" />
            <p>Document indisponible</p>
            <p className="legal-state-detail">{error}</p>
            <button onClick={() => navigate('/')} className="app-action legal-state-action">
              Retour à l’accueil
            </button>
          </div>
        )}

        {doc && !loading && (
          <article className="legal-doc">
            <div className="legal-doc-intro">
              <span className="legal-doc-badge">
                <ShieldCheck size={13} strokeWidth={2} aria-hidden="true" />
                Document officiel
              </span>
              <h1 className="legal-doc-title">{doc.title}</h1>
              <div className="legal-doc-meta">
                <span className="legal-chip"><FileText size={11} strokeWidth={2} aria-hidden="true" />{doc.docCode}</span>
                <span className="legal-chip">Version {doc.version}</span>
                {doc.date && <span className="legal-chip">{doc.date}</span>}
              </div>
            </div>
            <div className="legal-doc-body">
              <MarkdownView content={doc.contentMd} />
            </div>
            <footer className="legal-doc-footer">
              <span>Une question ? fasofree2@gmail.com</span>
              <button onClick={() => navigate(-1)} className="legal-doc-back">
                <ArrowLeft size={15} strokeWidth={1.8} aria-hidden="true" />
                Retour
              </button>
            </footer>
          </article>
        )}
      </div>
    </div>
  );
};

export default LegalDocPage;
