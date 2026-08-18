import { requestNotificationPermission } from './firebase';
import { api } from './api';

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
    const token = await requestNotificationPermission();
    if (!token) return;

    // Envoyer au backend (POST /notifications/fcm-token)
    await api.registerFcmToken(token);
    console.info('[FCM] Token enregistré auprès du backend');
  } catch (err) {
    // Token invalide ou endpoint indisponible : non bloquant
    console.warn('[FCM] Enregistrement token échoué:', err.message);
  }
}
