import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// 📱 PWA — application CLIENT FasoFree (1ʳᵉ des 2 apps PWA).
//
// `generateSW` (et non `injectManifest`) : AUCUN service worker n'est
// enregistré aujourd'hui — le push FCM est désactivé (`VITE_PUSH_ENABLED`
// absent) et `public/firebase-messaging-sw.js` n'est jamais enregistré par
// le code. Il n'y a donc aucun conflit de SW à gérer.
//
// ⚠️ Règle à respecter quand le push sera activé : un SEUL service worker
// par scope (contrainte navigateur). Le handler FCM de
// `public/firebase-messaging-sw.js` devra alors être fusionné dans ce SW
// (passer à `strategies: 'injectManifest'` avec un `swSrc` commun) — sinon
// l'enregistrement du second SW échouera silencieusement.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // `autoUpdate` : une nouvelle version est appliquée dès qu'elle est
      // disponible, sans attendre la fermeture de tous les onglets — adapté
      // à un back-office utilisé toute la journée.
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'assets/*.jpeg', 'assets/*.jpg'],
      manifest: {
        name: 'FasoFree — Marketplace & Livraison',
        short_name: 'FasoFree',
        description:
          'Commandez vos plats préférés et faites livrer en un clin d’œil à Ouagadougou.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#FBF8F3',
        theme_color: '#B95B2B',
        orientation: 'portrait-primary',
        lang: 'fr',
        categories: ['food', 'shopping'],
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
        // ⚠️ On ne met JAMAIS en cache les appels réseau : API, WebSocket
        // (socket.io) et tuiles OpenStreetMap. Un cache agressif casserait
        // le temps réel et renverrait des données périmées au client.
        navigateFallbackDenylist: [
          /^\/api/,
          /^\/socket\.io/,
          /tile\.openstreetmap\.org/,
        ],
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
    allowedHosts: true
  }
})
