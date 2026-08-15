const API_URL = import.meta.env.VITE_API_BASE_URL || 'https://unbridle-deferral-staleness.ngrok-free.dev/api/v1';

export async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem('access_token');

  const defaultHeaders = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  // Stringify body if it's an object
  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }

  try {
    const response = await fetch(`${API_URL}${endpoint}`, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Une erreur est survenue');
    }

    return data;
  } catch (error) {
    console.error(`[API Error] on ${endpoint}:`, error);
    throw error;
  }
}

export const api = {
  // Auth
  register: (data) => apiFetch('/auth/register', { method: 'POST', body: data }),
  login: (phoneOrEmail, password) => apiFetch('/auth/login', { method: 'POST', body: { phone: phoneOrEmail, password } }),
  getProfile: () => apiFetch('/auth/profile', { method: 'GET' }),
  
  // Businesses
  getNearbyBusinesses: (lat, lng, radius = 10000, category = 'RESTAURANT') => 
    apiFetch(`/businesses/nearby?lat=${lat}&lng=${lng}&radius=${radius}&category=${category}`, { method: 'GET' }),
  getBusiness: (businessId) => apiFetch(`/businesses/${businessId}`, { method: 'GET' }),
  
  // Products
  getBusinessProducts: (businessId) => apiFetch(`/products/business/${businessId}`, { method: 'GET' }),
  createProduct: (data) => apiFetch('/products', { method: 'POST', body: data }),
  updateProduct: (id, data) => apiFetch(`/products/${id}`, { method: 'PATCH', body: data }),
  deleteProduct: (id) => apiFetch(`/products/${id}`, { method: 'DELETE' }),
  toggleProductAvailability: (id) => apiFetch(`/products/${id}/toggle-availability`, { method: 'PATCH' }),
  
  // Orders
  createOrder: (orderData) => apiFetch('/orders', { method: 'POST', body: orderData }),
  getMyOrders: () => apiFetch('/orders/my-orders', { method: 'GET' }),
  getOrder: (orderId) => apiFetch(`/orders/${orderId}`, { method: 'GET' }),
  updateOrderStatus: (id, status) => apiFetch(`/orders/${id}/status`, { method: 'PATCH', body: { status } }),
  
  // Disputes
  openDispute: (orderId, data) => apiFetch(`/disputes/orders/${orderId}`, { method: 'POST', body: data }),
};

export default api;
