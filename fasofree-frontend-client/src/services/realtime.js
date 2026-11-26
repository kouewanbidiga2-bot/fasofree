/**
 * Copyright (c) 2026 BIDIGA Imrane - Koliwa. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { io } from 'socket.io-client';

import { API_ORIGIN } from './apiBase';

const getSocketOptions = () => {
  const token = localStorage.getItem('access_token');
  return {
    auth: { token },
    transports: ['polling', 'websocket'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 3000,
    reconnectionDelayMax: 10000,
    timeout: 10000,
  };
};

let chatSocket = null;
let dispatchSocket = null;
let supportSocket = null;

/**
 * Socket du namespace /chat (messagerie ephemere des commandes).
 */
export const getChatSocket = () => {
  if (!chatSocket) {
    chatSocket = io(`${API_ORIGIN}/chat`, {
      ...getSocketOptions(),
      autoConnect: false,
    });
    chatSocket.on('connect_error', (err) => {
      console.warn('[Chat Socket] Erreur connexion:', err?.message);
    });
  }
  return chatSocket;
};

/**
 * Socket du namespace /dispatch (suivi live GPS des livreurs).
 */
export const getDispatchSocket = () => {
  if (!dispatchSocket) {
    dispatchSocket = io(`${API_ORIGIN}/dispatch`, {
      ...getSocketOptions(),
      autoConnect: false,
    });
    dispatchSocket.on('connect_error', (err) => {
      console.warn('[Dispatch Socket] Erreur connexion:', err?.message);
    });
  }
  return dispatchSocket;
};

/**
 * Socket du namespace /support (chat support des litiges).
 */
export const getSupportSocket = () => {
  if (!supportSocket) {
    supportSocket = io(`${API_ORIGIN}/support`, {
      ...getSocketOptions(),
      autoConnect: false,
    });
    supportSocket.on('connect_error', (err) => {
      console.warn('[Support Socket] Erreur connexion:', err?.message);
    });
  }
  return supportSocket;
};

export const disconnectRealtime = () => {
  if (chatSocket) {
    chatSocket.disconnect();
    chatSocket = null;
  }
  if (dispatchSocket) {
    dispatchSocket.disconnect();
    dispatchSocket = null;
  }
  if (supportSocket) {
    supportSocket.disconnect();
    supportSocket = null;
  }
};

export default {
  getChatSocket,
  getDispatchSocket,
  getSupportSocket,
  disconnectRealtime,
};
