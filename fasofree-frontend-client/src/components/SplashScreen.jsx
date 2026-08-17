import { useState, useEffect } from 'react';

const SPLASH_KEY = 'fasofree_client_splash_shown';

export default function SplashScreen({ children }) {
  const [visible, setVisible] = useState(() => {
    try {
      return !sessionStorage.getItem(SPLASH_KEY);
    } catch {
      return true;
    }
  });
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (!visible) return;

    try {
      sessionStorage.setItem(SPLASH_KEY, '1');
    } catch {}

    const fadeTimer = setTimeout(() => setFading(true), 1000);
    const hideTimer = setTimeout(() => setVisible(false), 1300);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, [visible]);

  if (!visible) return children;

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#FBF8F3',
          transition: 'opacity 0.3s ease-out',
          opacity: fading ? 0 : 1,
          pointerEvents: fading ? 'none' : 'auto',
        }}
      >
        <svg width="80" height="80" viewBox="0 0 140 140" fill="none" style={{ marginBottom: 20 }}>
          <ellipse cx="70" cy="70" rx="44" ry="52" stroke="#B95B2B" strokeWidth="2.5" fill="none" />
          <path d="M38 50 Q70 22 102 50" stroke="#B95B2B" strokeWidth="1.8" fill="none" opacity="0.6" />
          <path d="M50 62 Q58 56 66 62 Q58 68 50 62Z" fill="#B95B2B" opacity="0.9" />
          <path d="M74 62 Q82 56 90 62 Q82 68 74 62Z" fill="#B95B2B" opacity="0.9" />
          <path d="M70 62 L64 84 L76 84 Z" fill="#8B7355" opacity="0.8" />
          <path d="M56 96 Q70 104 84 96" stroke="#B95B2B" strokeWidth="1.8" fill="none" strokeLinecap="round" />
          <circle cx="70" cy="70" r="3" fill="#B95B2B" opacity="0.3" />
        </svg>
        <div
          style={{
            width: 36,
            height: 36,
            border: '3px solid rgba(185,91,43,0.15)',
            borderTopColor: '#B95B2B',
            borderRadius: '50%',
            animation: 'fasofree-spin 0.75s linear infinite',
          }}
        />
      </div>
      {children}
    </>
  );
}
