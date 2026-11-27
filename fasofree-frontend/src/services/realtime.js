/**
 * Copyright (c) 2026 BIDIGA Imrane - Koliwa. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

/**
 * Koliwa Coursier — socket temps réel (namespace `/dispatch`).
 *
 * Le JWT est fourni via une fonction `auth` : socket.io la rappelle à chaque
 * tentative de reconnexion, donc un token rafraîchi est toujours utilisé
 * (un token capturé une fois pour toutes laissait le livreur muet après un
 * changement de session).
 */
import { io } from 'socket.io-client';
import { SOCKET_BASE, TOKEN_KEY } from './api';

let socket = null;

export const getDispatchSocket = () => {
  if (socket && socket.connected) return socket;

  // Socket mort (reconnexion abandonnée) : on repart d'une instance neuve.
  if (socket && socket.disconnected && !socket.active) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  if (!socket) {
    socket = io(`${SOCKET_BASE}/dispatch`, {
      auth: (cb) => cb({ token: localStorage.getItem(TOKEN_KEY) }),
      transports: ['websocket', 'polling'],
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1500,
      reconnectionDelayMax: 8000,
      timeout: 15000,
    });
  }

  return socket;
};

export const connectDispatch = () => {
  const s = getDispatchSocket();
  if (!s.connected && !s.active) s.connect();
  return s;
};

export const disconnectDispatch = () => {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
};

/**
 * Envoie la position courante au serveur.
 * `orderId` permet au backend de relayer la position au client qui suit
 * cette course précise.
 */
export const emitLocation = ({ orderId, latitude, longitude, heading }) => {
  const s = getDispatchSocket();
  if (!s.connected) return Promise.resolve(false);
  return new Promise((resolve) => {
    s.timeout(3500).emit('updateDriverLocation', { orderId, latitude, longitude, heading },
      (error, response) => resolve(!error && response?.status === 'ok'));
  });
};

export const isConnected = () => Boolean(socket?.connected);
