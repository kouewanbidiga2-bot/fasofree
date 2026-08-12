import React from 'react';

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
      {/* FasoFree Mask Logo */}
      <svg
        style={{ width: '120px', height: '120px' }}
        viewBox="0 0 140 140"
        fill="none"
      >
        <ellipse cx="70" cy="70" rx="44" ry="52" stroke="#C4A574" strokeWidth="2" fill="none"/>
        <path d="M38 50 Q70 22 102 50" stroke="#C4A574" strokeWidth="1.5" fill="none" opacity="0.6"/>
        <line x1="70" y1="22" x2="70" y2="38" stroke="#C4A574" strokeWidth="1" opacity="0.4"/>
        <path d="M50 62 Q58 56 66 62 Q58 68 50 62Z" fill="#C4A574" opacity="0.85"/>
        <path d="M74 62 Q82 56 90 62 Q82 68 74 62Z" fill="#C4A574" opacity="0.85"/>
        <path d="M70 62 L64 84 L76 84 Z" fill="#8B7355" opacity="0.7"/>
        <path d="M56 96 Q70 104 84 96" stroke="#C4A574" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
        <line x1="46" y1="78" x2="54" y2="78" stroke="#C4A574" strokeWidth="0.8" opacity="0.3"/>
        <line x1="86" y1="78" x2="94" y2="78" stroke="#C4A574" strokeWidth="0.8" opacity="0.3"/>
        <circle cx="70" cy="70" r="3" fill="#C4A574" opacity="0.2"/>
      </svg>

      {/* Loading Dots */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', height: '12px' }}>
        <div style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: '#C4A574',
          animation: 'bounce 1.4s ease-in-out infinite'
        }} />
        <div style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: '#C4A574',
          animation: 'bounce 1.4s ease-in-out infinite 0.2s'
        }} />
        <div style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: '#C4A574',
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
        L'art de la table
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
