/**
 * FasoFree — Lazy loading avec retry automatique
 *
 * FIX écran noir "Failed to fetch dynamically imported module" :
 * après un deploy Vercel, le navigateur garde l'ancien index.html en cache
 * qui référence des chunks au hash périmé (404). Le composant ne se charge
 * jamais → page noire.
 *
 * Solution : si le chargement d'un chunk échoue, on recharge la page UNE fois
 * (sessionStorage évite la boucle infinie). Au reload, le nouvel index.html
 * (jamais caché grâce aux headers Vercel) référence les bons chunks.
 */
import React, { Suspense, lazy } from 'react';

const RETRY_KEY = 'fasofree_chunk_retry';

const retryLazy = (importFn) =>
  lazy(() =>
    importFn().catch((err) => {
      const isChunkError =
        err?.message?.includes('dynamically imported module') ||
        err?.message?.includes('Loading chunk') ||
        err?.message?.includes('Failed to fetch');

      if (isChunkError && !sessionStorage.getItem(RETRY_KEY)) {
        console.warn('[LazyLoad] Chunk périmé détecté — reload de la page');
        sessionStorage.setItem(RETRY_KEY, '1');
        window.location.reload();
      }
      throw err;
    }),
  );

// Retire le flag de retry une fois la page chargée avec succès
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    setTimeout(() => sessionStorage.removeItem(RETRY_KEY), 3000);
  });
}

export const LazySection = ({ children, fallback }) => (
  <Suspense fallback={fallback ?? null}>{children}</Suspense>
);

export default retryLazy;
