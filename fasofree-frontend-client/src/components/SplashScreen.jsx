/**
 * Copyright (c) 2026 BIDIGA Imrane - Koliwa. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { Suspense, useLayoutEffect } from 'react';
import Loading from '../pages/Loading';

const SPLASH_MINIMUM_MS = 2100;

function DismissInitialSplash() {
  useLayoutEffect(() => {
    const splash = document.getElementById('koliwa-boot');
    const root = document.getElementById('root');

    function revealApp() {
      splash?.remove();
      root?.removeAttribute('inert');
    }

    const start = performance.getEntriesByName('koliwa:splash-start', 'mark')[0]?.startTime;
    const elapsed = start === undefined ? 0 : performance.now() - start;
    const remaining = splash ? SPLASH_MINIMUM_MS - elapsed : 0;
    if (remaining <= 0) {
      revealApp();
      return undefined;
    }

    const timer = window.setTimeout(revealApp, remaining);
    return () => window.clearTimeout(timer);
  }, []);
  return null;
}

export default function SplashScreen({ children }) {
  return (
    <Suspense fallback={document.getElementById('koliwa-boot') ? null : <Loading />}>
      {children}
      <DismissInitialSplash />
    </Suspense>
  );
}
