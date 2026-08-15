import { create } from 'zustand';

export const useCartStore = create((set, get) => ({
  cart: [],
  businessId: null,

  addToCart: (item, businessId) => {
    const currentBusinessId = get().businessId;
    
    // If adding from a different business, clear cart first
    if (currentBusinessId && currentBusinessId !== businessId) {
      if (!confirm('Ce panier contient des articles d\'un autre commerce. Voulez-vous le vider ?')) {
        return;
      }
      set({ cart: [], businessId });
    }

    set((state) => {
      const existingItemIndex = state.cart.findIndex(
        (cartItem) => cartItem.id === item.id
      );

      if (existingItemIndex >= 0) {
        const updatedCart = [...state.cart];
        updatedCart[existingItemIndex] = {
          ...updatedCart[existingItemIndex],
          quantity: updatedCart[existingItemIndex].quantity + (item.quantity || 1),
        };
        return { cart: updatedCart, businessId };
      }

      return {
        cart: [...state.cart, { ...item, quantity: item.quantity || 1 }],
        businessId,
      };
    });
  },

  removeFromCart: (itemId) => {
    set((state) => ({
      cart: state.cart.filter((item) => item.id !== itemId),
    }));
  },

  updateQuantity: (itemId, quantity) => {
    if (quantity <= 0) {
      get().removeFromCart(itemId);
      return;
    }

    set((state) => ({
      cart: state.cart.map((item) =>
        item.id === itemId ? { ...item, quantity } : item
      ),
    }));
  },

  clearCart: () => {
    set({ cart: [], businessId: null });
  },

  getCartTotal: () => {
    return get().cart.reduce(
      (total, item) => total + (item.price || 0) * item.quantity,
      0
    );
  },

  getCartItemCount: () => {
    return get().cart.reduce((count, item) => count + item.quantity, 0);
  },
}));
