import api from './api';

// Coordonnées par défaut : centre de Ouagadougou (fallback si pas de position GPS)
export const DEFAULT_DELIVERY_COORDS = { latitude: 12.3714, longitude: -1.5197 };

// Règles de tarification miroir du backend (fallback hors-ligne uniquement)
const MIN_DELIVERY_FEE = 800;
const PLATFORM_FEE = 100;

/**
 * 🔢 Sous-total du panier (source locale : prix catalogue affichés).
 * Le backend recalcule et verrouille tous les montants au POST /orders.
 */
export const getCartSubtotal = (items) =>
  (items || []).reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0);

/**
 * 💬 Devis tarifaire depuis l'API : { subtotal, deliveryFee, platformFee, total }.
 * Le backend applique DELIVERY_FEE = max(distance GPS, 800 FCFA) et PLATFORM_FEE = 100 FCFA.
 * En cas d'échec (offline / non connecté), fallback sur la même règle en local.
 */
export const fetchQuote = async ({ restaurant, items, deliveryCoords }) => {
  const subtotal = getCartSubtotal(items);

  try {
    const quote = await api.quoteOrder({
      orderType: 'DELIVERY',
      businessLatitude: restaurant?.latitude,
      businessLongitude: restaurant?.longitude,
      deliveryLatitude:
        deliveryCoords?.latitude ?? DEFAULT_DELIVERY_COORDS.latitude,
      deliveryLongitude:
        deliveryCoords?.longitude ?? DEFAULT_DELIVERY_COORDS.longitude,
      subtotal,
    });
    return {
      subtotal: Number(quote.subtotal) || subtotal,
      deliveryFee: Number(quote.deliveryFee) || MIN_DELIVERY_FEE,
      platformFee: Number(quote.platformFee) || PLATFORM_FEE,
      total: Number(quote.total) || subtotal + MIN_DELIVERY_FEE + PLATFORM_FEE,
      currency: quote.currency || 'FCFA',
      fromApi: true,
    };
  } catch (error) {
    console.warn('[Pricing] Devis API indisponible, fallback règle locale :', error.message);
    const deliveryFee = MIN_DELIVERY_FEE;
    const platformFee = PLATFORM_FEE;
    return {
      subtotal,
      deliveryFee,
      platformFee,
      total: subtotal + deliveryFee + platformFee,
      currency: 'FCFA',
      fromApi: false,
    };
  }
};

export default { fetchQuote, getCartSubtotal, DEFAULT_DELIVERY_COORDS };
