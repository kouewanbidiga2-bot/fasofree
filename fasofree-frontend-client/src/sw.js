/* eslint-env serviceworker */
/**
 * Service Worker unique de l'application CLIENT FasoFree.
 *
 * ⚠️ Pourquoi `injectManifest` (et non `generateSW`) :
 * le navigateur n'autorise qu'UN seul Service Worker par scope (ici `/`).
 * On fusionne donc dans CE fichier :
 *   1. le precache Workbox (mode hors-ligne de la PWA) ;
 *   2. le handler Firebase Messaging (notifications push en arrière-plan).
 * Auparavant `generateSW` + `public/firebase-messaging-sw.js` créaient deux
 * SW sur le même scope → le second échouait silencieusement (push cassé).
 *
 * La configuration Firebase ci-dessous est PUBLIQUE (clé navigateur) : elle est
 * injectée par Vite au build via `import.meta.env.VITE_FIREBASE_*`.
 */
import { precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { initializeApp } from 'firebase/app';
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw';

// 1) Precache des assets buildés (mode hors-ligne). Le manifeste est injecté
//    par vite-plugin-pwa sous forme de `self.__WB_MANIFEST`.
precacheAndRoute(self.__WB_MANIFEST);

// 2) Repli de navigation vers index.html (SPA), SAUF sur les appels réseau :
//    API, WebSocket (socket.io) et tuiles OpenStreetMap. Un cache agressif
//    casserait le temps réel et renverrait des données périmées au client.
//    ⚠️ `createHandlerBoundToURL` n'existe plus dans workbox-routing v7.
registerRoute(
  new NavigationRoute(
    () => caches.match(new URL('index.html', self.location).toString()),
    {
      denylist: [/^\/api/, /^\/socket\.io/, /tile\.openstreetmap\.org/],
    },
  ),
);

// 3) Firebase Messaging (notifications push en arrière-plan).
//    Aucune initialisation si la config est absente → le SW reste un simple
//    SW de precache (état d'aujourd'hui, push désactivé).
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

if (firebaseConfig.projectId) {
  try {
    initializeApp(firebaseConfig);
    const messaging = getMessaging();

    onBackgroundMessage(messaging, (payload) => {
      const { title, body } = payload.notification || {};
      const orderId = payload.data?.orderId;
      const url = orderId ? `/order-tracking?id=${orderId}` : '/';

      self.registration.showNotification(title || 'FasoFree', {
        body: body || '',
        icon: '/favicon.svg',
        data: { url },
      });
    });
  } catch (err) {
    // Un SW doit toujours rester fonctionnel (precache) même si FCM échoue.
    console.warn('[sw] Firebase Messaging non initialisé:', err);
  }
}

// 4) Clic sur une notification → ouvrir l'app sur la bonne page.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(self.clients.openWindow(url));
});
