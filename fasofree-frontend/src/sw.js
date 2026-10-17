/* eslint-env serviceworker */
/**
 * Service Worker unique de l'application BACK-OFFICE FasoFree Pro.
 *
 * ⚠️ Pourquoi `injectManifest` (et non `generateSW`) :
 * le navigateur n'autorise qu'UN seul Service Worker par scope (ici `/`).
 * On fusionne dans CE fichier le precache Workbox (hors-ligne PWA) et le
 * handler Firebase Messaging (notifications push en arrière-plan), ce qui
 * évite la collision silencieuse de deux SW sur le scope racine.
 *
 * La configuration Firebase ci-dessous est PUBLIQUE (clé navigateur), injectée
 * par Vite au build via `import.meta.env.VITE_FIREBASE_*`.
 */
import { precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { initializeApp } from '@firebase/app';
import { getMessaging, onBackgroundMessage } from '@firebase/messaging/sw';

// 1) Precache des assets buildés (mode hors-ligne).
precacheAndRoute(self.__WB_MANIFEST);

// 2) Repli de navigation vers index.html (SPA), SAUF sur les appels réseau :
//    API, WebSocket et tuiles OpenStreetMap (le back-office vit de données
//    fraîches).
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
      self.registration.showNotification(title || 'FasoFree Pro', {
        body: body || '',
        icon: '/favicon.svg',
        data: { url: '/' },
      });
    });
  } catch (err) {
    // Le SW de precache doit rester fonctionnel même si FCM échoue.
    console.warn('[sw] Firebase Messaging non initialisé:', err);
  }
}

// 4) Clic sur une notification → ouvrir l'app.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(self.clients.openWindow(url));
});
