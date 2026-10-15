import api from './api';

/**
 * 🔔 Enregistrement du token de notification push (FCM).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ⚠️ DÉSACTIVÉ PAR DÉFAUT — NE PAS ACTIVER AU LANCEMENT.
 *
 * Tant que `VITE_PUSH_ENABLED` n'est pas exactement la chaîne "true", ce
 * module ne fait RIEN : aucun import de Firebase n'est chargé, aucune
 * permission n'est demandée, aucun appel réseau n'est effectué.
 *
 * Pourquoi c'est volontairement éteint : la plateforme n'a pas encore
 * d'application mobile. Les notifications des campagnes passent aujourd'hui
 * par EMAIL / SMS / WhatsApp (voir `NotificationsService.sendNotification`),
 * ce qui fonctionne sans application mobile. Le push FCM est une brique
 * préparée pour plus tard, activable d'un simple flag.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Pour l'activer le jour venu :
 *   1. les dépendances sont déjà là (@firebase/app, @firebase/messaging)
 *   2. créer `public/firebase-messaging-sw.js` (config Firebase publique)
 *   3. renseigner les variables ci-dessous
 *   4. passer VITE_PUSH_ENABLED="true" à la VRAIE mise en ligne
 *   5. developments côté client : demander la permission et surveiller
 *      `console.log('[push] token enregistré')`
 */

const ENABLED = String(import.meta.env.VITE_PUSH_ENABLED || '').toLowerCase() === 'true';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;

/** Le push est-il activé sur cet environnement ? */
export const isPushEnabled = () => ENABLED;

/** Conditions navigateur nécessaires au push (absentes des navigateurs sans service worker). */
function isPushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Enregistre le token FCM de l'utilisateur courant auprès du backend
 * (`POST /notifications/fcm-token`, existe déjà côté API).
 *
 * @returns {Promise<string|null>} le token enregistré, ou `null` si le push
 *   est désactivé / non supporté / refusé par l'utilisateur.
 */
export async function registerPushToken() {
  // Garde-fou principal : rien ne se charge ni ne s'exécute au lancement.
  if (!ENABLED) return null;
  if (!isPushSupported()) return null;

  try {
    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return null;
    }
    if (Notification.permission !== 'granted') return null;

    // Import dynamique : Firebase n'entre dans le bundle QUE si le push est
    // activé. On n'importe que `@firebase/app` + `@firebase/messaging` — et
    // NON le paquet umbrella `firebase`, qui embarquerait `@firebase/firestore`
    // et sa dépendance vulnérable `@grpc/grpc-js` pour rien ici.
    const [{ initializeApp, getApps, getApp }, { getMessaging, getToken }] =
      await Promise.all([
        import('@firebase/app'),
        import('@firebase/messaging'),
      ]);

    const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    const messaging = getMessaging(app);

    // Préférence de service worker : le fichier dédié s'il existe, sinon un
    // service worker minimal créé à la volée.
    let registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      try {
        registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      } catch {
        return null;
      }
    }

    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });
    if (!token) return null;

    await api.post('/notifications/fcm-token', { fcmToken: token });
    return token;
  } catch {
    // Un échec d'enregistrement ne doit jamais casser l'application.
    return null;
  }
}

const pushNotificationService = { isPushEnabled, registerPushToken };

export default pushNotificationService;