import api from './api';

export const getUsers = async () => {
  const response = await api.get('/users');
  return response.data;
};

export const createUser = async (data) => {
  const response = await api.post('/users', data);
  return response.data;
};

export const updateUserStatus = async (id, isActive, banReason) => {
  const response = await api.patch(`/users/${id}/status`, { isActive, banReason });
  return response.data;
};

export const updateUserRole = async (id, role) => {
  const response = await api.patch(`/users/${id}/role`, { role });
  return response.data;
};

export const deleteUser = async (id) => {
  const response = await api.delete(`/users/${id}`);
  return response.data;
};

// ─── Ban Requests ──────────────────────────────────────────────
export const getBanRequests = async (status) => {
  const params = status ? { status } : {};
  const response = await api.get('/ban-requests', { params });
  return response.data;
};

export const createBanRequest = async (data) => {
  const response = await api.post('/ban-requests', data);
  return response.data;
};

export const reviewBanRequest = async (id, data) => {
  const response = await api.post(`/ban-requests/${id}/review`, data);
  return response.data;
};

export const getBanRequestPendingCount = async () => {
  const response = await api.get('/ban-requests/pending-count');
  return response.data;
};

// ─── Chat (Admin/Support) ──────────────────────────────────────
export const getActiveConversations = async () => {
  const response = await api.get('/chat');
  return response.data;
};

export const getChatHistory = async (orderId, channel) => {
  const params = channel ? { channel } : {};
  const response = await api.get(`/chat/${orderId}`, { params });
  return response.data;
};
