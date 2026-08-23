const API_BASE =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
  (typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_URL) ||
  'https://api.fasofree.site/api/v1';

const API_ORIGIN = (() => {
  try { return new URL(API_BASE).origin; } catch { return 'https://api.fasofree.site'; }
})();

const PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'%3E%3Crect fill='%23f3f4f6' width='200' height='200'/%3E%3Ctext fill='%239ca3af' font-family='system-ui,sans-serif' font-size='14' x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle'%3EImage indisponible%3C/text%3E%3C/svg%3E";

// Generic category fallback images (Unsplash for demo - replace with your own assets)
const CATEGORY_FALLBACKS = {
  'fast-food': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&h=600&fit=crop',
  'fast food': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&h=600&fit=crop',
  'cuisine locale': 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=600&fit=crop',
  'cuisine': 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=600&fit=crop',
  'pâtisseries & desserts': 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=800&h=600&fit=crop',
  'pâtisseries': 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=800&h=600&fit=crop',
  'patisseries': 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=800&h=600&fit=crop',
  'desserts': 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=800&h=600&fit=crop',
  'supermarchés & épiceries': 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&h=600&fit=crop',
  'supermarchés': 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&h=600&fit=crop',
  'supermarches': 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&h=600&fit=crop',
  'épiceries': 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&h=600&fit=crop',
  'epiceries': 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&h=600&fit=crop',
  'général': 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=600&fit=crop',
  'general': 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=600&fit=crop',
  'default': 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=600&fit=crop',
};

// Images de marque par restaurant (hébergées sur Cloudinary)
// La correspondance se fait par le nom du restaurant.
const BRAND_IMAGES = [
  { match: ['belchicken', 'belchiken', 'bel chicken'], image: 'https://res.cloudinary.com/ihflbjcg/image/upload/v1787523023/fasofree/logos/logos/1787523022811-255754.jpg', displayName: 'Belchicken' },
  { match: ['cesar', 'césar'], image: 'https://res.cloudinary.com/ihflbjcg/image/upload/v1787523013/fasofree/logos/logos/1787523013324-156438.jpg' },
  { match: ['chitir', 'chikir'], image: 'https://res.cloudinary.com/ihflbjcg/image/upload/v1787525129/chitirchiken.jpg' },
  { match: ['gusto'], image: 'https://res.cloudinary.com/ihflbjcg/image/upload/v1787523018/fasofree/logos/logos/1787523017828-947810.jpg', displayName: 'Gusto' },
];

export function getBrandImage(name) {
  if (!name) return null;
  const lowerName = name.toLowerCase();
  const brand = BRAND_IMAGES.find((b) => b.match.some((m) => lowerName.includes(m)));
  return brand ? brand.image : null;
}

// Nom d'affichage officiel du restaurant (ex: "Maquis Gusto" → "Gusto")
export function getBrandName(name) {
  if (!name) return null;
  const lowerName = name.toLowerCase();
  const brand = BRAND_IMAGES.find((b) => b.match.some((m) => lowerName.includes(m)));
  return brand?.displayName || null;
}

export function getCategoryFallbackImage(category) {
  if (!category) return CATEGORY_FALLBACKS.default;
  const normalizedCategory = category.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return CATEGORY_FALLBACKS[normalizedCategory] || CATEGORY_FALLBACKS['general'] || CATEGORY_FALLBACKS.default;
}

export function getAbsoluteImageUrl(url) {
  if (!url) return PLACEHOLDER;
  if (url.startsWith('data:')) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/uploads/')) return API_ORIGIN + url;
  if (url.startsWith('/assets/')) {
    try { return window.location.origin + url; } catch { return url; }
  }
  if (url.startsWith('/')) return API_ORIGIN + url;
  return url;
}

export function onImgError(e) {
  e.target.onerror = null;
  e.target.src = PLACEHOLDER;
}

export { PLACEHOLDER as PLACEHOLDER_SVG };
