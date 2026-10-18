import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// 📱 PWA — application BACK-OFFICE FasoFree Pro (2ᵉ app PWA).
//
// Contient tous les dashboards pro : Super Admin, Admin, Support, Agence,
// Livreur et Commerce. Installable sur le poste des équipes d'exploitation
// comme une application native, avec mise à jour automatique.
//
// `injectManifest` : le SW source `src/sw.js` fusionne le precache Workbox
// (hors-ligne) et le handler Firebase Messaging (push) — un seul SW par scope.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // ⚠️ injectManifest : le SW source `src/sw.js` fusionne le precache
      // Workbox ET le handler Firebase Messaging → un seul SW par scope.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.svg',
        'favicon.ico',
        'favicon-16.png',
        'favicon-32.png',
        'apple-touch-icon.png',
      ],
      manifest: {
        name: 'FasoFree Pro — Back-office',
        short_name: 'FasoFree Pro',
        description:
          'Pilotage FasoFree : commandes, livreurs, commerces, qualité de livraison.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#0D0D0D',
        theme_color: '#0D0D0D',
        orientation: 'any',
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
      devOptions: { enabled: false },
    }),
  ],
  server: {
    port: 5173,
    strictPort: true,
    host: true
  }
})
