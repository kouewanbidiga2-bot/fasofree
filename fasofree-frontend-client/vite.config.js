/**
 * Copyright (c) 2026 BIDIGA Imrane - Koliwa. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// 📱 PWA — application CLIENT Koliwa (1ʳᵉ des 2 apps PWA).
//
// `injectManifest` : le Service Worker source `src/sw.js` fusionne le
// precache Workbox (hors-ligne) et le handler Firebase Messaging (push).
// Un SEUL SW par scope (contrainte navigateur) : c'est ce qui évite la
// collision silencieuse entre le SW PWA et l'ancien
// `public/firebase-messaging-sw.js` (supprimé).
export default defineConfig(({ mode }) => {
  const { KOLIWA_DEV_API_ORIGIN } = loadEnv(mode, process.cwd(), 'KOLIWA_DEV_');
  const target = KOLIWA_DEV_API_ORIGIN?.trim() || 'http://127.0.0.1:3100';
  const apiProxy = { target, changeOrigin: true };

  return {
  plugins: [
    react(),
    VitePWA({
      // ⚠️ injectManifest : le SW source `src/sw.js` fusionne le precache
      // Workbox ET le handler Firebase Messaging → un seul SW sur le scope
      // racine (sinon collision silencieuse entre deux SW).
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.svg',
        'koliwa-wordmark.svg',
        'koliwa-courier-splash.svg',
        'koliwa-loading.css',
        'favicon.ico',
        'favicon-16.png',
        'favicon-32.png',
        'apple-touch-icon.png',
      ],
      manifest: {
        name: 'Koliwa — Livraison de colis',
        short_name: 'Koliwa',
        description:
          'Envoyez, faites récupérer et suivez vos colis à Ouagadougou.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#d7f36b',
        theme_color: '#f4f2e6',
        orientation: 'portrait-primary',
        lang: 'fr',
        categories: ['business', 'productivity'],
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        // Le repli de navigation (hors API / WebSocket / tuiles) est géré
        // dans `src/sw.js` (NavigationRoute + denylist). On conserve le
        // manifeste de precache ci-dessous.
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,jpeg,woff,woff2}'],
      },
      // Le SW n'est pas généré en dev : il mettrait en cache les sources et
      // empêcherait tout rechargement à chaud pendant le développement.
      devOptions: { enabled: false },
    }),
  ],
  server: {
    host: true,
    port: 3000,
    allowedHosts: ['localhost', '127.0.0.1', '.fasofree.site', '.vercel.app'],
    proxy: {
      '/api/v1': apiProxy,
      '/uploads': apiProxy,
      '/socket.io': { ...apiProxy, ws: true },
    },
  },
  };
})
