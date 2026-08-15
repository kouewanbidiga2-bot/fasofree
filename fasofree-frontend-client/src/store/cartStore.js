import { create } from 'zustand';

const useCartStore = create((set) => ({
  items: [],
  restaurantId: null,
  
  addItem: (item, restaurantId) => set((state) => {
    if (state.restaurantId && state.restaurantId !== restaurantId) {
      // Clear cart if adding from different restaurant
      return { items: [{ ...item, quantity: 1 }], restaurantId };
    }
    
    const existingItem = state.items.find((i) => i.id === item.id);
    if (existingItem) {
      return {
        items: state.items.map((i) =>
          i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
        ),
        restaurantId,
      };
    }
    
    return {
      items: [...state.items, { ...item, quantity: 1 }],
      restaurantId,
    };
  }),
  
  removeItem: (itemId) => set((state) => ({
    items: state.items.filter((i) => i.id !== itemId),
  })),
  
  updateQuantity: (itemId, quantity) => set((state) => ({
    items: state.items.map((i) =>
      i.id === itemId ? { ...i, quantity: Math.max(0, quantity) } : i
    ).filter((i) => i.quantity > 0),
  })),
  
  clearCart: () => set({ items: [], restaurantId: null }),
  
  getTotal: () => {
    const state = useCartStore.getState();
    return state.items.reduce((total, item) => total + item.price * item.quantity, 0);
  },
  
  getTotalItems: () => {
    const state = useCartStore.getState();
    return state.items.reduce((total, item) => total + item.quantity, 0);
  },
}));

export default useCartStore;
