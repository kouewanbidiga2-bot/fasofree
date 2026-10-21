/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { useState, useEffect } from 'react';
import { FasoFreeLockup } from './FasoFreeLogo';

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
        <FasoFreeLockup maskSize={72} style={{ marginBottom: 28 }} />
        <div
          style={{
            width: 36,
            height: 36,
            border: '3px solid rgba(193,101,46,0.15)',
            borderTopColor: '#C1652E',
            borderRadius: '50%',
            animation: 'fasofree-spin 0.75s linear infinite',
          }}
        />
      </div>
      {children}
    </>
  );
}
