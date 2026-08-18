import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, isSupported, getToken, onMessage } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let app = null;
let messaging = null;

/**
 * Initialise Firebase côté client (une seule fois).
 */
export function initFirebase() {
  if (typeof window === 'undefined') return null;

  if (getApps().length === 0) {
    try {
      app = initializeApp(firebaseConfig);
    } catch (err) {
      console.warn('[Firebase] Init error:', err.message);
      return null;
    }
  } else {
    app = getApps()[0];
  }

  return app;
}

/**
 * Récupère l'instance Messaging (si supportée par le navigateur).
 */
export async function getFirebaseMessaging() {
  if (!app) initFirebase();
  if (!app) return null;

  try {
    const supported = await isSupported();
    if (!supported) {
      console.warn('[Firebase] Messaging non supporté par ce navigateur');
      return null;
    }

    if (!messaging) {
      messaging = getMessaging(app);
    }

    return messaging;
  } catch (err) {
    console.warn('[Firebase] Messaging unavailable:', err.message);
    return null;
  }
}

/**
 * Demande la permission notifications + récupère le token FCM.
 * @returns {string|null} Le token FCM ou null si refusé/échoué
 */
export async function requestNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return null;
  }

  // Permission déjà accordée
  if (Notification.permission === 'granted') {
    return getFcmToken();
  }

  // Permission déjà refusée
  if (Notification.permission === 'denied') {
    console.info('[FCM] Permission refusée par l\'utilisateur');
    return null;
  }

  // Demander la permission
  const result = await Notification.requestPermission();
  if (result === 'granted') {
    return getFcmToken();
  }

  console.info('[FCM] Permission non accordée:', result);
  return null;
}

/**
 * Récupère le token FCM via le service worker.
 */
async function getFcmToken() {
  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
  if (!vapidKey || vapidKey.includes('REPLACE')) {
    console.warn('[FCM] VAPID key non configurée — token non récupéré');
    return null;
  }

  const messagingInstance = await getFirebaseMessaging();
  if (!messagingInstance) return null;

  try {
    const token = await getToken(messagingInstance, { vapidKey });
    return token;
  } catch (err) {
    console.warn('[FCM] getToken error:', err.message);
    return null;
  }
}

/**
 * Écoute les notifications push reçues quand l'app est au premier plan.
 * Affiche une notification navigateur classique.
 * @param {(payload) => void} callback - Appelé avec le payload FCM
 * @returns {Function} Fonction de désabonnement
 */
export function onForegroundMessage(callback) {
  let unsubscribe = null;

  getFirebaseMessaging().then((msg) => {
    if (!msg) return;
    unsubscribe = onMessage(msg, (payload) => {
      const { title, body } = payload.notification || {};
      if (title) {
        callback({ title, body: body || '', data: payload.data });
        // Notification navigateur nativo en premier plan
        if (Notification.permission === 'granted') {
          try {
            new Notification(title, { body: body || '', icon: '/favicon.svg' });
          } catch {
            // Fallback silencieux
          }
        }
      }
    });
  });

  return () => {
    if (unsubscribe) unsubscribe();
  };
}
