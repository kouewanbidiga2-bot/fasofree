/**
 * FasoFree — Garde de signature de contrat (marchands & livreurs)
 *
 * Bloque l'accès au dashboard métier tant que le contrat (FR-PMERC-005 pour
 * les marchands, FR-LIVR-006 pour les livreurs) n'est pas signé via OTP.
 * Le compte reste actif côté login (JwtStrategy) ; le blocage est fonctionnel,
 * au niveau de l'écran : tout accès aux routes /designer et /livreur passe
 * par ce garde, qui redirige vers /contrat (signature).
 */
import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { getContractStatus } from '../services/legalService';

const ContractGate = ({ children }) => {
  const [state, setState] = useState({ checking: true, pending: false });

  useEffect(() => {
    let cancelled = false;
    getContractStatus()
      .then((data) => {
        if (!cancelled) setState({ checking: false, pending: Boolean(data?.pending) });
      })
      .catch(() => {
        // Backend injoignable : on ouvre malgré tout (aucun blocage faux positif
        // qui enfermerait l'utilisateur hors de son espace).
        if (!cancelled) setState({ checking: false, pending: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.checking) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#0D0D0D',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: "'Manrope', system-ui, sans-serif",
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: 16,
              height: 16,
              border: '2px solid rgba(193,101,46,0.3)',
              borderTopColor: '#C1652E',
              borderRadius: '50%',
              animation: 'fasofree-spin 0.8s linear infinite',
              margin: '0 auto 12px',
            }}
          />
          <p style={{ color: '#A09890', fontSize: 13 }}>Vérification de votre contrat…</p>
        </div>
      </div>
    );
  }

  if (state.pending) {
    return <Navigate to="/contrat" replace />;
  }

  return children;
};

export default ContractGate;