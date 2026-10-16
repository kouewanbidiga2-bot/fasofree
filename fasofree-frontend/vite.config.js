import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// 📱 PWA — application BACK-OFFICE FasoFree Pro (2ᵉ app PWA).
//
// Contient tous les dashboards pro : Super Admin, Admin, Support, Agence,
// Livreur et Commerce. Installable sur le poste des équipes d'exploitation
// comme une application native, avec mise à jour automatique.
//
// `generateSW` : aucun service worker n'est enregistré aujourd'hui dans
// cette application, donc aucun conflit à gérer.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
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
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // ⚠️ Jamais de cache sur les appels réseau : API, WebSocket et tuiles
        // OpenStreetMap. Le back-office vit de données fraîches.
        navigateFallbackDenylist: [
          /^\/api/,
          /^\/socket\.io/,
          /tile\.openstreetmap\.org/,
        ],
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
