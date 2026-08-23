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

const getSocketOptions = () => {
  const token = localStorage.getItem('fasofree_token');
  return {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
  };
};

let chatSocket = null;

export const getChatSocket = () => {
  if (!chatSocket) {
    chatSocket = io(`${getSocketBase()}/chat`, getSocketOptions());
    chatSocket.on('connect_error', (err) => {
      console.warn('[Chat Socket] Erreur connexion:', err?.message);
    });
  }
  return chatSocket;
};

export const disconnectRealtime = () => {
  if (chatSocket) {
    chatSocket.disconnect();
    chatSocket = null;
  }
};

export default { getChatSocket, disconnectRealtime };
