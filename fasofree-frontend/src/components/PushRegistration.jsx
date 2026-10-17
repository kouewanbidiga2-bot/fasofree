import { useEffect } from 'react';
import useAuthStore from '../store/authStore';
import { registerPushToken, setupAdminPermissionRetry } from '../services/pushNotificationService';

/**
 * 🔔 Enregistre le token push de l'utilisateur connecté (FCM).
 *
 * ⚠️ Inerte tant que `VITE_PUSH_ENABLED` n'est pas "true" (voir
 * `pushNotificationService.js`) : au lancement, ce composant ne demande
 * AUCUNE permission et n'effectue AUCUN appel réseau. Il est monté une fois
 * dans `App` et ne rend rien.
 *
 * L'enregistrement est rejoué à chaque connexion et une seule fois par
 * session : un token push est propre au navigateur, il suffit donc de le
 * réécrire lorsque l'utilisateur s'authentifie.
 */
export default function PushRegistration() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isHydrated = useAuthStore((state) => state.isHydrated);

  useEffect(() => {
    // Pas encore de session restaurée → on attend.
    if (!isHydrated || !isAuthenticated) return undefined;

    // Configure la relance de permission (prompt initial + relance clics/focus)
    setupAdminPermissionRetry();

    let cancelled = false;

    registerPushToken()
      .then((token) => {
        if (!cancelled && token) {
          // eslint-disable-next-line no-console
          console.log('[push] token FCM enregistré');
        }
      })
      .catch(() => {
        // Silencieux : le push ne doit jamais impacter la navigation.
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isHydrated]);

  return null;
}