import { io } from 'socket.io-client';

const API_URL =
  import.meta.env.VITE_API_BASE_URL ||
  'https://unbridle-deferral-staleness.ngrok-free.dev/api/v1';

const getSocketBase = () => {
  try {
    return new URL(API_URL).origin;
  } catch {
    return 'http://localhost:3100';
  }
};

const getSocketOptions = () => {
  const token = localStorage.getItem('access_token');
  return {
    auth: { token },
    transports: ['websocket'],
  };
};

let chatSocket = null;
let dispatchSocket = null;

/**
 * 🔌 Socket du namespace /chat (messagerie éphémère des commandes).
 */
export const getChatSocket = () => {
  if (!chatSocket) {
    chatSocket = io(`${getSocketBase()}/chat`, getSocketOptions());
    chatSocket.on('connect_error', () => {
      // Reconnexion automatique gérée par socket.io
    });
  }
  return chatSocket;
};

/**
 * 🛰️ Socket du namespace /dispatch (suivi live GPS des livreurs).
 */
export const getDispatchSocket = () => {
  if (!dispatchSocket) {
    dispatchSocket = io(`${getSocketBase()}/dispatch`, getSocketOptions());
    dispatchSocket.on('connect_error', () => {
      // Reconnexion automatique gérée par socket.io
    });
  }
  return dispatchSocket;
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
};

export default {
  getChatSocket,
  getDispatchSocket,
  disconnectRealtime,
};
