/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

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

// ─── Logique de relance permission (push FCM) ──────────────────────────────
// Objectif : si permission ≠ 'granted', redemander :
//   - au focus/retour sur l'app (visibilitychange + focus)
//   - à chaque 2 clics utilisateur dans la page
// Avec un cooldown de 30s entre deux prompts pour ne pas harceler.
let _permRetry = {
  clickCount: 0,
  lastPromptAt: 0,
  cooldownMs: 30_000,        // 30s entre deux prompts
  clicksBeforePrompt: 2,     // redemander tous les 2 clics
  boundHandlers: false,
  onToken: null,             // callback(token) → persisté côté API
};

function _canPromptNow() {
  return Date.now() - _permRetry.lastPromptAt > _permRetry.cooldownMs;
}

function _resetClickCount() {
  _permRetry.clickCount = 0;
}

/**
 * Transmet le token FCM au callback d'enregistrement (fourni par App.jsx).
 * ⚠️ Sans ce callback, le token récupéré était simplement JETÉ : `users.fcmToken`
 * restait NULL en base et aucun push ne partait (bug « 0 destinataire »).
 */
function _deliverToken(token) {
  if (!token) return;
  try {
    if (typeof _permRetry.onToken === 'function') _permRetry.onToken(token);
  } catch (err) {
    console.warn('[FCM] onToken callback error:', err?.message);
  }
}

async function _tryRequestPermission() {
  if (typeof Notification === 'undefined') return null; // navigateur non compatible
  if (Notification.permission === 'granted') {
    _resetClickCount();
    const token = await getFcmToken(); // déjà accordé → token direct
    _deliverToken(token);
    return token;
  }
  if (!_canPromptNow()) return null;

  _permRetry.lastPromptAt = Date.now();
  const result = await Notification.requestPermission();
  if (result === 'granted') {
    _resetClickCount();
    const token = await getFcmToken();
    _deliverToken(token);
    return token;
  }
  console.info('[FCM] Permission non accordée (relance):', result);
  return null;
}

function _onUserInteraction() {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission === 'granted') return;
  _permRetry.clickCount++;
  if (_permRetry.clickCount >= _permRetry.clicksBeforePrompt) {
    _permRetry.clickCount = 0;
    _tryRequestPermission();
  }
}

function _onVisibilityOrFocus() {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission === 'granted') return;
  // Au retour sur l'app (onglet visible / focus), tenter une relance
  if (document.visibilityState === 'visible') {
    _tryRequestPermission();
  }
}

/**
 * Branche la relance de permission + la persistance du token FCM.
 *
 * @param {{ onToken?: (token: string) => void }} [options]
 *   `onToken` est appelé À CHAQUE fois qu'un token FCM valide est obtenu
 *   (permission déjà accordée, accordée après prompt, ou accordée lors d'une
 *   relance clic/focus). C'est ce qui enregistre réellement le token côté API.
 */
export function setupPermissionRetry(options = {}) {
  if (typeof window === 'undefined') return;
  if (typeof options.onToken === 'function') {
    _permRetry.onToken = options.onToken;
  }

  // À CHAQUE appel — donc à chaque connexion — on tente d'obtenir et de
  // persister le token, même si les écouteurs sont déjà branchés : un autre
  // utilisateur peut se connecter sur le même navigateur et doit recevoir SON
  // push (le token FCM est propre au navigateur, pas au compte).
  //   - permission 'granted' → token récupéré puis enregistré (aucun prompt)
  //   - permission 'default' → prompt (respecte le cooldown de 30 s)
  //   - permission 'denied'  → on ne fait rien (irréversible sans action manuelle)
  if (typeof Notification !== 'undefined' && Notification.permission !== 'denied') {
    _tryRequestPermission();
  }

  if (_permRetry.boundHandlers) return;
  _permRetry.boundHandlers = true;

  // 1) Clics utilisateur (délégué sur document)
  document.addEventListener('click', _onUserInteraction, { passive: true });

  // 2) Retour sur l'onglet / focus fenêtre
  document.addEventListener('visibilitychange', _onVisibilityOrFocus);
  window.addEventListener('focus', _onVisibilityOrFocus);
}

export function stopPermissionRetry() {
  if (!_permRetry.boundHandlers) return;
  _permRetry.boundHandlers = false;
  document.removeEventListener('click', _onUserInteraction);
  document.removeEventListener('visibilitychange', _onVisibilityOrFocus);
  window.removeEventListener('focus', _onVisibilityOrFocus);
}

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
    // ⚠️ Le SW du PWA (`/sw.js`, injectManifest) doit être passé à getToken :
    // sinon Firebase enregistrerait un 2ᵉ SW `/firebase-messaging-sw.js` sur
    // le même scope → collision silencieuse et push cassé.
    let registration = null;
    try {
      registration = await navigator.serviceWorker.ready;
    } catch {
      registration = null;
    }

    const token = await getToken(messagingInstance, {
      vapidKey,
      ...(registration ? { serviceWorkerRegistration: registration } : {}),
    });
    return token;
  } catch (err) {
    console.warn('[FCM] getToken error:', err.message);
    return null;
  }
}

/**
 * Écoute les notifications push reçues quand l'app est au premier plan.
 * Déclenche UNIQUEMENT le callback (toast in-app via App.jsx) : le message est
 * déjà remis à la page par le SDK Firebase, créer aussi une notification
 * native faisait « deux notifications » en premier plan.
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
        // ⚠️ PLUS de `new Notification()` ici : le toast (callback App.jsx) ET
        // une notification native = « deux notifications » quand l'app est au
        // premier plan. Le toast est le seul retour visuel (comportement voulu).
      }
    });
  });

  return () => {
    if (unsubscribe) unsubscribe();
  };
}
