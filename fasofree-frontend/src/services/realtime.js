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

export const getChatSocket = () => {
  if (!chatSocket) {
    chatSocket = io(`${getSocketBase()}/chat`, {
      ...getSocketOptions(),
      autoConnect: false,
    });
    chatSocket.on('connect_error', (err) => {
      console.warn('[Chat Socket] Erreur connexion:', err?.message);
    });
  }
  return chatSocket;
};

export const getDispatchSocket = () => {
  if (!dispatchSocket) {
    dispatchSocket = io(`${getSocketBase()}/dispatch`, {
      ...getSocketOptions(),
      autoConnect: false,
    });
    dispatchSocket.on('connect_error', (err) => {
      console.warn('[Dispatch Socket] Erreur connexion:', err?.message);
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

export default { getChatSocket, getDispatchSocket, disconnectRealtime };
