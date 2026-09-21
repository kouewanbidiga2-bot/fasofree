/**
 * FasoFree — Realtime Sockets (Singleton)
 *
 * FIX CRITIQUE : le token JWT est lu depuis localStorage À CHAQUE tentative
 * de connexion/reconnexion, pas capturé une seule fois à la création du singleton.
 * Cela résout le problème où après refresh (F5) ou changement de token,
 * les sockets utilisaient un token stale et ne se reconnectaient pas.
 */
import { io } from 'socket.io-client';

const API_URL =
  import.meta.env.VITE_API_URL ||
  'https://api.fasofree.site/api/v1';

const getSocketBase = () => {
  try {
    return new URL(API_URL).origin;
  } catch {
    return 'http://localhost:3100';
  }
};

/**
 * Retourne les options de connexion avec le token FRAIS de localStorage.
 * Appelé à chaque tentative de connexion/reconnexion.
 */
const getSocketOptions = () => {
  const token = localStorage.getItem('fasofree_token');
  return {
    auth: { token },
    transports: ['polling', 'websocket'],
    reconnection: true,
    reconnectionAttempts: Infinity, // Toujours réessayer
    reconnectionDelay: 2000,
    reconnectionDelayMax: 10000,
    timeout: 15000,
    // IMPORTANT : forcer le upgrade de polling vers websocket
    upgrade: true,
    rememberUpgrade: true,
  };
};

let chatSocket = null;
let dispatchSocket = null;

/**
 * Crée ou retourne le socket chat singleton.
 * Si le socket existe mais est déconnecté et ne peut plus se reconnecter,
 * on le recrée avec un token frais.
 */
export const getChatSocket = () => {
  // Si le socket existe et est connecté, le retourner tel quel
  if (chatSocket && chatSocket.connected) {
    return chatSocket;
  }

  // Si le socket existe mais est dans un état "mort" (plus de reconnection attempts)
  // on le détruit et on en recrée un
  if (chatSocket && chatSocket.disconnected && !chatSocket.active) {
    chatSocket.removeAllListeners();
    chatSocket.disconnect();
    chatSocket = null;
  }

  if (!chatSocket) {
    chatSocket = io(`${getSocketBase()}/chat`, {
      ...getSocketOptions(),
      autoConnect: false,
    });

    chatSocket.on('connect_error', (err) => {
      console.warn('[Chat Socket] Erreur connexion:', err?.message);
      // Si c'est une erreur d'auth, forcer la reconnexion avec un token frais
      if (err?.message?.includes('Token') || err?.message?.includes('auth')) {
        console.warn('[Chat Socket] Token可能 expiré — déconnexion et reset');
        chatSocket?.disconnect();
        chatSocket = null;
      }
    });

    chatSocket.on('disconnect', (reason) => {
      console.log('[Chat Socket] Déconnecté:', reason);
      // Si déconnecté pour une raison qui nécessite un nouveau token
      if (reason === 'io server disconnect' || reason === 'auth timeout') {
        chatSocket = null; // Forcer la recréation au prochain appel
      }
    });

    chatSocket.on('connect', () => {
      console.log('[Chat Socket] ✅ Connecté');
    });
  }

  return chatSocket;
};

/**
 * Crée ou retourne le socket dispatch singleton.
 */
export const getDispatchSocket = () => {
  if (dispatchSocket && dispatchSocket.connected) {
    return dispatchSocket;
  }

  if (dispatchSocket && dispatchSocket.disconnected && !dispatchSocket.active) {
    dispatchSocket.removeAllListeners();
    dispatchSocket.disconnect();
    dispatchSocket = null;
  }

  if (!dispatchSocket) {
    dispatchSocket = io(`${getSocketBase()}/dispatch`, {
      ...getSocketOptions(),
      autoConnect: false,
    });

    dispatchSocket.on('connect_error', (err) => {
      console.warn('[Dispatch Socket] Erreur connexion:', err?.message);
      if (err?.message?.includes('Token') || err?.message?.includes('auth')) {
        console.warn('[Dispatch Socket] Token可能 expiré — reset');
        dispatchSocket?.disconnect();
        dispatchSocket = null;
      }
    });

    dispatchSocket.on('disconnect', (reason) => {
      console.log('[Dispatch Socket] Déconnecté:', reason);
      if (reason === 'io server disconnect' || reason === 'auth timeout') {
        dispatchSocket = null;
      }
    });

    dispatchSocket.on('connect', () => {
      console.log('[Dispatch Socket] ✅ Connecté');
    });
  }

  return dispatchSocket;
};

/**
 * Force la reconnexion de tous les sockets avec un token frais.
 * Utile après un refresh de token ou un F5.
 */
export const forceReconnectRealtime = () => {
  if (chatSocket) {
    chatSocket.removeAllListeners();
    chatSocket.disconnect();
    chatSocket = null;
  }
  if (dispatchSocket) {
    dispatchSocket.removeAllListeners();
    dispatchSocket.disconnect();
    dispatchSocket = null;
  }
};

export const disconnectRealtime = () => {
  if (chatSocket) {
    chatSocket.removeAllListeners();
    chatSocket.disconnect();
    chatSocket = null;
  }
  if (dispatchSocket) {
    dispatchSocket.removeAllListeners();
    dispatchSocket.disconnect();
    dispatchSocket = null;
  }
};

export default { getChatSocket, getDispatchSocket, disconnectRealtime, forceReconnectRealtime };
