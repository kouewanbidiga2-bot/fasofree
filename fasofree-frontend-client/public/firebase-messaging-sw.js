/* eslint-env serviceworker */

/**
 * Firebase Cloud Messaging Service Worker
 * Intercepte les notifications push même lorsque l'application est fermée.
 * Vite sert ce fichier depuis /public/firebase-messaging-sw.js.
 */

// Importations Firebase via CDN (le SW ne supporte pas les modules ES natifs)
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: self.__FIREBASE_CONFIG__?.apiKey || '',
  authDomain: self.__FIREBASE_CONFIG__?.authDomain || '',
  projectId: self.__FIREBASE_CONFIG__?.projectId || '',
  storageBucket: self.__FIREBASE_CONFIG__?.storageBucket || '',
  messagingSenderId: self.__FIREBASE_CONFIG__?.messagingSenderId || '',
  appId: self.__FIREBASE_CONFIG__?.appId || '',
};

// Initialiser Firebase (une seule fois)
if (firebaseConfig.projectId) {
  firebase.initializeApp(firebaseConfig);
}

const messaging = firebase.messaging();

/**
 * Gère les notifications push reçues en arrière-plan.
 * Le navigateur affichera automatiquement la notification grâce à
 * la présence du champ `notification` dans le payload FCM.
 */
messaging.onBackgroundMessage((payload) => {
  const { title, body, image } = payload.notification || {};
  const url = payload.fcmOptions?.link || payload.data?.orderId
    ? `/order-tracking?id=${payload.data.orderId}`
    : '/';

  self.registration.showNotification(title || 'FasoFree', {
    body: body || '',
    icon: '/favicon.svg',
    image: image || undefined,
    badge: '/favicon.svg',
    data: { url, ...payload.data },
    actions: [
      { action: 'open', title: 'Ouvrir' },
    ],
  });
});

/**
 * Clic sur une notification → ouvre/focus la fenêtre de l'app.
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';
  const origin = self.location.origin;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Si une fenêtre FasoFree est déjà ouverte, la focus
      for (const client of windowClients) {
        if (client.url.startsWith(origin) && 'focus' in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      // Sinon, ouvrir une nouvelle fenêtre
      return clients.openWindow(`${origin}${url}`);
    }),
  );
});

self.addEventListener('push', (event) => {
  // Forcer l'affichage même si l'app est ouverte (optionnel)
  // Les notifications foreground sont gérées par onMessage dans firebase.js
});
