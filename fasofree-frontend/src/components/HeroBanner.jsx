import React, { useState, useEffect } from 'react';

export default function HeroBanner() {
  const [text, setText] = useState('');
  const fullText = 'Découvrez nos restaurants';
  
  useEffect(() => {
    let index = 0;
    const timer = setInterval(() => {
      if (index < fullText.length) {
        setText(fullText.slice(0, index + 1));
        index++;
      } else {
        clearInterval(timer);
      }
    }, 100);
    
    return () => clearInterval(timer);
  }, []);

  return (
    <div
      style={{
        backgroundImage: 'url(/src/assets/banner-bg.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        minHeight: '400px',
        maxHeight: '600px',
        padding: 'clamp(40px, 8vw, 80px) clamp(20px, 5vw, 40px)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        position: 'relative',
        width: '100%',
      }}
    >
      {/* Overlay for better text readability */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
        }}
      />
      
      <div style={{ position: 'relative', zIndex: 1, maxWidth: '100%' }}>
        <h1
          style={{
            fontSize: 'clamp(24px, 6vw, 56px)',
            fontWeight: 300,
            fontFamily: 'Playfair Display, serif',
            fontStyle: 'italic',
            color: '#FFFFFF',
            margin: '0 0 clamp(16px, 3vw, 24px) 0',
            letterSpacing: '0.5px',
            textShadow: '2px 2px 4px rgba(0, 0, 0, 0.6)',
            lineHeight: '1.2',
          }}
        >
          {text}
          <span style={{ animation: 'blink 1s infinite' }}>|</span>
        </h1>

        <p
          style={{
            fontFamily: 'Nexa, Manrope, sans-serif',
            fontSize: 'clamp(12px, 2.5vw, 16px)',
            color: '#FFFFFF',
            margin: '0 0 clamp(20px, 4vw, 32px) 0',
            fontWeight: 400,
            letterSpacing: '0.3px',
            textShadow: '1px 1px 2px rgba(0, 0, 0, 0.5)',
          }}
        >
          Livraison rapide et repas de qualité
        </p>

        <button
          style={{
            width: 'clamp(160px, 40vw, 200px)',
            height: 'clamp(44px, 10vw, 52px)',
            border: '2px solid #FFFFFF',
            background: 'transparent',
            color: '#FFFFFF',
            fontFamily: 'Nexa, Manrope, sans-serif',
            fontSize: 'clamp(12px, 2.5vw, 15px)',
            fontWeight: 400,
            cursor: 'pointer',
            borderRadius: 0,
            transition: 'all 0.3s ease',
            letterSpacing: '0.5px',
            textShadow: '1px 1px 2px rgba(0, 0, 0, 0.3)',
          }}
          onMouseEnter={(e) => {
            e.target.style.background = '#C1652E';
            e.target.style.borderColor = '#C1652E';
          }}
          onMouseLeave={(e) => {
            e.target.style.background = 'transparent';
            e.target.style.borderColor = '#FFFFFF';
          }}
        >
          Explorer les restaurants
        </button>
      </div>

      <style>{`
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
