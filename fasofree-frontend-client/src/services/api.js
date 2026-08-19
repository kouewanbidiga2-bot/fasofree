const API_URL = import.meta.env.VITE_API_BASE_URL || 'https://fasofree-3nh8.onrender.com/api/v1';

export async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem('access_token');

  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

  const defaultHeaders = {
    'Accept': 'application/json',
  };

  // ⚠️ Ne PAS forcer Content-Type pour un FormData (multipart) :
  // le navigateur pose automatiquement la bonne boundary.
  if (!isFormData) {
    defaultHeaders['Content-Type'] = 'application/json';
  }

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

  // Stringify body if it's an object (mais jamais un FormData)
  if (!isFormData && config.body && typeof config.body === 'object') {
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
  login: (phoneOrEmail, password) => apiFetch('/auth/login', { method: 'POST', body: { email: phoneOrEmail, password } }),
  getProfile: () => apiFetch('/users/me', { method: 'GET' }),
  updateProfile: (data) => apiFetch('/users/me', { method: 'PATCH', body: data }),
  forgotPassword: (email) => apiFetch('/auth/forgot-password', { method: 'POST', body: { email } }),
  resetPassword: (token, newPassword) => apiFetch('/auth/reset-password', { method: 'POST', body: { token, newPassword } }),

  // OTP Verification
  sendOtp: () => apiFetch('/auth/send-otp', { method: 'POST' }),
  verifyOtp: (code) => apiFetch('/auth/verify-otp', { method: 'POST', body: { code } }),
  checkVerification: () => apiFetch('/auth/check-verification', { method: 'POST' }),

  // Candidature Marchand / Livreur (multipart, avec fichiers KYC)
  apply: (formData) => apiFetch('/auth/apply', { method: 'POST', body: formData }),
  
  // Businesses
  getMyBusiness: () => apiFetch('/businesses/me', { method: 'GET' }),
  getNearbyBusinesses: (lat, lng, radius = 10000, category = 'RESTAURANT') => 
    apiFetch(`/businesses/nearby?lat=${lat}&lng=${lng}&radius=${radius}&category=${category}`, { method: 'GET' }),
  getBusiness: (businessId) => apiFetch(`/businesses/${businessId}`, { method: 'GET' }),
  updateBusiness: (businessId, data) => apiFetch(`/businesses/${businessId}`, { method: 'PATCH', body: data }),
  
  // Products
  getBusinessProducts: (businessId) => apiFetch(`/products/business/${businessId}`, { method: 'GET' }),
  createProduct: (data) => apiFetch('/products', { method: 'POST', body: data }),
  updateProduct: (id, data) => apiFetch(`/products/${id}`, { method: 'PATCH', body: data }),
  deleteProduct: (id) => apiFetch(`/products/${id}`, { method: 'DELETE' }),
  toggleProductAvailability: (id) => apiFetch(`/products/${id}/toggle-availability`, { method: 'PATCH' }),
  
  // Merchant Orders
  getBusinessOrders: (businessId) => apiFetch(`/orders/business/${businessId}`, { method: 'GET' }),
  updateOrderStatus: (id, status) => apiFetch(`/orders/${id}/status`, { method: 'PATCH', body: { status } }),
  
  // Merchant Wallet
  getMerchantWallet: (userId) => apiFetch(`/wallets/MERCHANT/${userId}`, { method: 'GET' }),
  getWalletTransactions: (walletId, limit = 20) => apiFetch(`/wallets/${walletId}/transactions?limit=${limit}`, { method: 'GET' }),
  
  // Orders
  createOrder: (orderData) => apiFetch('/orders', { method: 'POST', body: orderData }),
  quoteOrder: (quoteData) => apiFetch('/orders/quote', { method: 'POST', body: quoteData }),
  getMyOrders: () => apiFetch('/orders/my-orders', { method: 'GET' }),
  getOrder: (orderId) => apiFetch(`/orders/${orderId}`, { method: 'GET' }),
  getOrderTracking: (orderId) => apiFetch(`/orders/${orderId}/tracking`, { method: 'GET' }),
  updateOrderStatus: (id, status) => apiFetch(`/orders/${id}/status`, { method: 'PATCH', body: { status } }),
  acceptOrder: (id) => apiFetch(`/orders/${id}/accept`, { method: 'POST' }),
  driverValidateDelivery: (id) => apiFetch(`/orders/${id}/driver-validate`, { method: 'POST' }),
  clientValidateWithPin: (id, pinCode) => apiFetch(`/orders/${id}/client-validate`, { method: 'POST', body: { pinCode } }),
  updateDriverStatus: (data) => apiFetch('/users/me/driver-status', { method: 'PATCH', body: data }),

  // Chat éphémère
  getChatHistory: (orderId, channel = 'driver') => apiFetch(`/chat/${orderId}?channel=${channel}`, { method: 'GET' }),
  
  // Disputes
  openDispute: (orderId, data) => apiFetch(`/disputes/orders/${orderId}`, { method: 'POST', body: data }),

  // FasoFree Pass VIP (abonnements)
  getPlans: (subjectType) =>
    apiFetch(`/subscriptions/plans${subjectType ? `?subjectType=${subjectType}` : ''}`, { method: 'GET' }),
  getVipStatus: () => apiFetch('/subscriptions/me', { method: 'GET' }),
  subscribeVip: (planCode = 'VIP', autoRenew = true) =>
    apiFetch('/subscriptions/subscribe', { method: 'POST', body: { planCode, autoRenew } }),

  // Portefeuille FasoFree
  getWallet: (userId) => apiFetch(`/wallets/CUSTOMER/${userId}`, { method: 'GET' }),
  topupWallet: (data) => apiFetch('/payments/topup', { method: 'POST', body: data }),

  // KYC
  uploadKycDocument: (type, formData) => apiFetch(`/kyc/documents/${type}`, { method: 'POST', body: formData }),
  getMyKyc: () => apiFetch('/kyc/me', { method: 'GET' }),
  getKycDocumentUrl: (id) => apiFetch(`/kyc/documents/${id}/url`, { method: 'GET' }),

  // Reviews
  submitReview: (data) => apiFetch('/reviews', { method: 'POST', body: data }),
  getTargetReviews: (targetId) => apiFetch(`/reviews/target/${targetId}`, { method: 'GET' }),
  getTargetAverage: (targetId) => apiFetch(`/reviews/target/${targetId}/average`, { method: 'GET' }),
  getOrderReview: (orderId) => apiFetch(`/reviews/order/${orderId}`, { method: 'GET' }),

  // Disputes
  getMyDispute: (id) => apiFetch(`/disputes/me/${id}`, { method: 'GET' }),

  // Promotions
  getPromotionQuote: (data) => apiFetch('/promotions/quote', { method: 'GET', body: data }),

  // Subscriptions marchand
  subscribeMerchant: (businessId, planCode = 'PRO', autoRenew = true) =>
    apiFetch('/subscriptions/merchant/subscribe', { method: 'POST', body: { businessId, planCode, autoRenew } }),

  // Orders
  cancelOrder: (id, reason) => apiFetch(`/orders/${id}/status`, { method: 'PATCH', body: { status: 'CANCELLED' } }),
  disputeOrder: (id, data) => apiFetch(`/disputes/orders/${id}`, { method: 'POST', body: data }),

  // Notifications
  registerFcmToken: (token) => apiFetch('/notifications/fcm-token', { method: 'POST', body: { fcmToken: token } }),

  // OTP Verification
  sendOtp: () => apiFetch('/auth/send-otp', { method: 'POST' }),
  verifyOtp: (code) => apiFetch('/auth/verify-otp', { method: 'POST', body: { code } }),
  checkVerification: () => apiFetch('/auth/check-verification', { method: 'POST' }),
  getMe: () => apiFetch('/auth/me', { method: 'GET' }),
};

export default api;
