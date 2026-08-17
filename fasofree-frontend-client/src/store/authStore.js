import { create } from 'zustand';

const loadInitial = () => {
  try {
    const token = localStorage.getItem('access_token');
    const userRaw = localStorage.getItem('fasofree_user');
    if (token && userRaw) {
      return { user: JSON.parse(userRaw), isAuthenticated: true };
    }
  } catch {}
  return { user: null, isAuthenticated: false };
};

const useAuthStore = create((set) => ({
  user: loadInitial().user,
  isAuthenticated: loadInitial().isAuthenticated,
  isLoading: false,
  orders: [],
  receipts: [],
  
  loginWithPhone: (phone, userData = {}) => {
    const user = {
      phone,
      name: userData.name || '',
      email: userData.email || '',
      role: userData.role || 'CLIENT',
      createdAt: new Date().toISOString(),
    };
    localStorage.setItem('fasofree_user', JSON.stringify(user));
    set({ user, isAuthenticated: true });
  },
  
  loginWithToken: (token, userData = {}) => {
    localStorage.setItem('access_token', token);
    const user = {
      id: userData.id,
      email: userData.email,
      phone: userData.phone,
      firstName: userData.firstName,
      lastName: userData.lastName,
      role: userData.role || 'CLIENT',
      isPremium: !!userData.isPremium,
      createdAt: new Date().toISOString(),
    };
    localStorage.setItem('fasofree_user', JSON.stringify(user));
    set({ user, isAuthenticated: true });
  },
  
  setPremium: (isPremium) => set((state) => ({
    user: state.user ? { ...state.user, isPremium: !!isPremium } : state.user,
  })),
  
  updateUser: (userData) => set((state) => { 
    const updated = { ...state.user, ...userData };
    localStorage.setItem('fasofree_user', JSON.stringify(updated));
    return { user: updated };
  }),
  
  logout: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('fasofree_user');
    set({ user: null, isAuthenticated: false, orders: [], receipts: [] });
  },
  
  setLoading: (isLoading) => set({ isLoading }),
  
  addOrder: (order) => set((state) => ({
    orders: [...state.orders, { ...order, createdAt: new Date().toISOString() }]
  })),
  
  addReceipt: (receipt) => set((state) => ({
    receipts: [...state.receipts, { ...receipt, createdAt: new Date().toISOString() }]
  })),
}));

export default useAuthStore;
