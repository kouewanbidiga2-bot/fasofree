import { requestNotificationPermission } from './firebase';
import { api } from './api';

/**
 * Persiste un token FCM auprès du backend (`POST /notifications/fcm-token`).
 * Utilisé par `registerFcmTokenOnLogin` ET par la relance de permission
 * (`setupPermissionRetry({ onToken })`) — un seul chemin d'écriture.
 *
 * Ne propage jamais les erreurs pour ne pas casser le flux utilisateur.
 *
 * @returns {Promise<string|null>} le token si enregistré, sinon null.
 */
export async function persistFcmToken(token) {
  if (!token) return null;
  try {
    await api.registerFcmToken(token);
    console.info('[FCM] Token enregistré auprès du backend');
    return token;
  } catch (err) {
    // Token invalide ou endpoint indisponible : non bloquant
    console.warn('[FCM] Enregistrement token échoué:', err.message);
    return null;
  }
}

/**
 * Demande la permission notifications, récupère le token FCM,
 * et l'enregistre auprès du backend.
 *
 * À appeler :
 *   - après une connexion réussie
 *   - au chargement d'une session active (App.jsx)
 *
 * Ne propage jamais les erreurs pour ne pas casser le flux utilisateur.
 */
export async function registerFcmTokenOnLogin() {
  try {
    return await persistFcmToken(await requestNotificationPermission());
  } catch (err) {
    console.warn('[FCM] Enregistrement token échoué:', err?.message);
    return null;
  }
}
