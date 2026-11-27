/**
 * Copyright (c) 2026 BIDIGA Imrane - Koliwa. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * 📱 PWA Koliwa Coursier — application terrain du livreur.
 *
 * Séparée de l'app client : elle ne contient que les écrans du livreur
 * (connexion, missions, détail mission, gains, compte). `generateSW` suffit
 * ici : pas de push Firebase, seulement un cache de la coquille pour que
 * l'app s'ouvre quand le réseau est mauvais sur la route.
 */
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Koliwa Coursier',
        short_name: 'Koliwa',
        description: 'Courses, navigation et gains du livreur Koliwa.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#f3f4f5',
        theme_color: '#f3f4f5',
        orientation: 'portrait',
        lang: 'fr',
        categories: ['business', 'navigation'],
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,woff,woff2}'],
        navigateFallback: '/index.html',
        // Les appels API et le socket ne doivent jamais recevoir l'index HTML.
        navigateFallbackDenylist: [/^\/api/, /^\/socket\.io/],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    port: 5273,
    strictPort: true,
    host: '127.0.0.1',
  },
});
