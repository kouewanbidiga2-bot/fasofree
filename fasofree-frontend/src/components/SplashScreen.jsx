import { useState, useEffect } from 'react';
import { FasoFreeLockup } from './FasoFreeLogo';

const SPLASH_KEY = 'fasofree_dashboard_splash_shown';

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

    const fadeTimer = setTimeout(() => setFading(true), 1200);
    const hideTimer = setTimeout(() => setVisible(false), 1500);
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
          background: '#0D0D0D',
          transition: 'opacity 0.3s ease-out',
          opacity: fading ? 0 : 1,
          pointerEvents: fading ? 'none' : 'auto',
        }}
      >
        <FasoFreeLockup maskSize={72} style={{ marginBottom: 28 }} />
        <div
          style={{
            width: 40,
            height: 40,
            border: '3px solid rgba(193,101,46,0.2)',
            borderTopColor: '#C1652E',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
      </div>
      {children}
    </>
  );
}
