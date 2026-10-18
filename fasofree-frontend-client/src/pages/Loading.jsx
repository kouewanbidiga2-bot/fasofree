import React from 'react';
import { FasoFreeLockup } from '../components/FasoFreeLogo';

const Loading = () => {
  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#0C0A08',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '40px',
        padding: '24px',
      }}
    >
      {/* Logo FasoFree (lockup W2) */}
      <FasoFreeLockup maskSize={96} dark />

      {/* Loading Dots */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', height: '12px' }}>
        <div style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: '#C1652E',
          animation: 'bounce 1.4s ease-in-out infinite'
        }} />
        <div style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: '#C1652E',
          animation: 'bounce 1.4s ease-in-out infinite 0.2s'
        }} />
        <div style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: '#C1652E',
          animation: 'bounce 1.4s ease-in-out infinite 0.4s'
        }} />
      </div>

      {/* Tagline */}
      <div style={{
        fontSize: '13px',
        fontWeight: 300,
        fontStyle: 'italic',
        color: '#8B7355',
        letterSpacing: '5px',
        textTransform: 'uppercase',
        opacity: 0.9,
        textAlign: 'center',
      }}>
        Commande &amp; livraison au Burkina
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.3; }
          40% { transform: translateY(-10px); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default Loading;
