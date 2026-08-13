import { create } from 'zustand';

const useCartStore = create((set, get) => ({
  items: [],
  restaurantId: null,

  addItem: (item, restaurantId) =>
    set((state) => {
      // CORRECTION : Si changement de restaurant, on remplace le panier entier
      if (state.restaurantId && state.restaurantId !== restaurantId) {
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

  removeItem: (itemId) =>
    set((state) => {
      const newItems = state.items.filter((i) => i.id !== itemId);
      return {
        items: newItems,
        restaurantId: newItems.length === 0 ? null : state.restaurantId,
      };
    }),

  updateQuantity: (itemId, quantity) =>
    set((state) => {
      // CORRECTION : Ajout de la virgule manquante dans { ...i, quantity }
      const updatedItems = state.items
        .map((i) => (i.id === itemId ? { ...i, quantity: Math.max(0, quantity) } : i))
        .filter((i) => i.quantity > 0);

      return {
        items: updatedItems,
        restaurantId: updatedItems.length === 0 ? null : state.restaurantId,
      };
    }),

  clearCart: () => set({ items: [], restaurantId: null }),

  getTotal: () => {
    const state = get();
    return state.items.reduce((total, item) => total + item.price * item.quantity, 0);
  },

  getTotalItems: () => {
    const state = get();
    return state.items.reduce((total, item) => total + item.quantity, 0);
  },
}));

export default useCartStore;