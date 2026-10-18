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
 * d'application mobile. Les notifications du flux passent aujourd'hui par le
 * centre de notifications (cloche, in-app) — le push FCM est une brique
 * préparée pour plus tard, activable d'un simple flag.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Pour l'activer le jour venu :
 *   1. les dépendances sont déjà là (@firebase/app, @firebase/messaging)
 *   2. le SW `src/sw.js` (injectManifest) gère déjà le push FCM
 *   3. renseigner les variables ci-dessous (VITE_FIREBASE_*)
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

// ─── Logique de relance permission (admin) ─────────────────────────────────
// Même principe que le client : si permission ≠ 'granted', redemander au
// focus/retour et tous les 2 clics, avec cooldown 30s.
let _adminPermRetry = {
  clickCount: 0,
  lastPromptAt: 0,
  cooldownMs: 30_000,
  clicksBeforePrompt: 2,
  boundHandlers: false,
  onGranted: null,
};

function _adminCanPromptNow() {
  return Date.now() - _adminPermRetry.lastPromptAt > _adminPermRetry.cooldownMs;
}

function _adminResetClickCount() {
  _adminPermRetry.clickCount = 0;
}

/**
 * Prévient que la permission vient d'être (ou était déjà) accordée.
 * ⚠️ Indispensable : sans ce callback, une permission accordée lors d'une
 * relance (clic/focus) n'entraînait AUCUN enregistrement du token → le
 * back-office ne recevait jamais ses push (« 0 destinataire »).
 */
function _adminDeliverGranted() {
  try {
    if (typeof _adminPermRetry.onGranted === 'function') {
      _adminPermRetry.onGranted();
    }
  } catch (err) {
    console.warn('[FCM Admin] onGranted callback error:', err?.message);
  }
}

async function _adminTryRequestPermission() {
  if (Notification.permission === 'granted') {
    _adminResetClickCount();
    _adminDeliverGranted();
    return true;
  }
  if (!_adminCanPromptNow()) return false;

  _adminPermRetry.lastPromptAt = Date.now();
  const result = await Notification.requestPermission();
  if (result === 'granted') {
    _adminResetClickCount();
    _adminDeliverGranted();
    return true;
  }
  console.info('[FCM Admin] Permission non accordée (relance):', result);
  return false;
}

function _adminOnUserInteraction() {
  if (Notification.permission === 'granted') return;
  _adminPermRetry.clickCount++;
  if (_adminPermRetry.clickCount >= _adminPermRetry.clicksBeforePrompt) {
    _adminPermRetry.clickCount = 0;
    _adminTryRequestPermission();
  }
}

function _adminOnVisibilityOrFocus() {
  if (Notification.permission === 'granted') return;
  if (document.visibilityState === 'visible') {
    _adminTryRequestPermission();
  }
}

/**
 * Branche la relance de permission (admin) + l'enregistrement du token obtenu.
 *
 * @param {{ onGranted?: () => void }} [options]
 *   `onGranted` est appelé dès que la permission est accordée (immédiatement si
 *   elle l'était déjà, ou après le prompt / une relance clic-focus). C'est ce qui
 *   déclenche réellement `registerPushToken()` côté appelant.
 */
export function setupAdminPermissionRetry(options = {}) {
  if (typeof window === 'undefined') return;
  if (typeof options.onGranted === 'function') {
    _adminPermRetry.onGranted = options.onGranted;
  }

  // À chaque appel (donc à chaque connexion) : si la permission est déjà
  // accordée, on (re)enregistre le token — un autre compte peut se connecter sur
  // le même navigateur et doit recevoir SES push. Sinon on (re)demande.
  if (typeof Notification !== 'undefined' && Notification.permission !== 'denied') {
    _adminTryRequestPermission();
  }

  if (_adminPermRetry.boundHandlers) return;
  _adminPermRetry.boundHandlers = true;

  document.addEventListener('click', _adminOnUserInteraction, { passive: true });
  document.addEventListener('visibilitychange', _adminOnVisibilityOrFocus);
  window.addEventListener('focus', _adminOnVisibilityOrFocus);
}

export function stopAdminPermissionRetry() {
  if (!_adminPermRetry.boundHandlers) return;
  _adminPermRetry.boundHandlers = false;
  document.removeEventListener('click', _adminOnUserInteraction);
  document.removeEventListener('visibilitychange', _adminOnVisibilityOrFocus);
  window.removeEventListener('focus', _adminOnVisibilityOrFocus);
}

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

    // Le SW du PWA est `src/sw.js` → `/sw.js` (injectManifest). On le réutilise
    // pour FCM : enregistrer un SW distinct recréerait un 2ᵉ worker sur le
    // scope racine (collision silencieuse).
    let registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      try {
        registration = await navigator.serviceWorker.register('/sw.js');
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