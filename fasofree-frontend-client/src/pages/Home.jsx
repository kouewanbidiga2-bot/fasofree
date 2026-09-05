import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, Bell, ShoppingBag, Package, Car, LogIn, User } from 'lucide-react';
import Footer from '../components/Footer';
import RestaurantCard from '../components/RestaurantCard';
import HeroBanner from '../components/HeroBanner';
import StoryStrip from '../components/stories/StoryStrip';
import NotificationDropdown from '../components/NotificationDropdown';
import api from '../services/api';
import useAuthStore from '../store/authStore';
import useCartStore from '../store/cartStore';
import useNotificationStore from '../store/notificationStore';
import { getAbsoluteImageUrl, getCategoryFallbackImage, getBrandImage, getBrandName } from '../utils/images';

const mapBusinessToRestaurant = (b) => {
  const category = b.category || 'Fast Food';
  const rawName = b.name || b.fullName || 'Restaurant';
  const name = b.isBrand ? rawName : (getBrandName(rawName) || rawName);
  const brandImage = getBrandImage(rawName);
  // Priorité aux URLs hébergées (Cloudinary/DB), fallback sur l'image locale de marque
  const coverUrl = b.coverImage || b.coverUrl || b.cover_url || b.banner || b.cover_image || brandImage;
  const signatureUrl = b.signatureImage || b.signature_image || brandImage;
  
  return {
    id: b.id,
    brandId: b.brandId || null,
    name: name,
    tagline: category,
    description: name,
    isBrand: b.isBrand || false,
    branchCount: b.branchCount || 0,
    branches: b.branches || [],
    logo: b.logo || b.logoUrl || b.logo_url || brandImage,
    coverImage: coverUrl ? (coverUrl.startsWith('/') ? coverUrl : getAbsoluteImageUrl(coverUrl)) : getCategoryFallbackImage(category),
    signatureImage: signatureUrl ? (signatureUrl.startsWith('/') ? signatureUrl : getAbsoluteImageUrl(signatureUrl)) : null,
    rating: b.rating ?? 4.0,
    deliveryTime: b.deliveryTime || '25-40 min',
    deliveryFee: b.deliveryFee ?? 500,
    minOrder: b.minOrder ?? 1500,
    latitude: b.latitude ?? b.location?.coordinates?.[1] ?? 12.37,
    longitude: b.longitude ?? b.location?.coordinates?.[0] ?? -1.52,
    location: b.address || 'Ouagadougou',
    phone: b.phone || '',
    cuisineType: category,
    promo: b.promo || null,
    categories: b.categories || [],
    menu: b.menu || [],
  };
};

const Home = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [allRestaurants, setAllRestaurants] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const { unreadCount } = useNotificationStore();
  const cartItems = useCartStore((s) => s.items);
  const cartCount = cartItems.reduce((n, i) => n + (i.quantity || 1), 0);

  // Refetch businesses when selectedCategory changes OR when returning via browser back button
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const handlePopState = () => setRefreshKey((k) => k + 1);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadBusinesses = async () => {
      try {
        const data = await api.getGroupedBusinesses(12.37, -1.52);
        if (!cancelled && Array.isArray(data)) {
          setAllRestaurants(data.map(mapBusinessToRestaurant));
        }
      } catch {
        if (!cancelled) setAllRestaurants([]);
      }
    };
    loadBusinesses();
    return () => { cancelled = true; };
  }, [selectedCategory, refreshKey]);

  const categories = ['all', 'Fast-Food', 'Cuisine Locale', 'Pâtisseries & Desserts', 'Supermarchés & Épiceries'];

  const filteredRestaurants = useMemo(() => {
    let filtered = allRestaurants;
    // Category filtering is now handled by the backend!
    // We only filter locally by search query:
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.name.toLowerCase().includes(lowerQuery) ||
          r.description.toLowerCase().includes(lowerQuery) ||
          r.cuisineType.toLowerCase().includes(lowerQuery)
      );
    }
    return filtered;
  }, [allRestaurants, searchQuery]);

  const handleSearch = useCallback((query) => {
    setSearchQuery(query);
  }, []);

  const handleCategoryChange = useCallback((category) => {
    setSelectedCategory(category);
  }, []);

  return (
    <div className="app-page text-text-primary font-sans">
      {/* Header simplifié pour mobile */}
      <header className="app-header relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            
            {/* Logo & Localisation */}
            <button type="button" className="flex items-center gap-2 sm:gap-3 text-left min-w-0 flex-1 md:flex-none" onClick={() => navigate('/')} aria-label="Retour à l'accueil">
              <svg
                className="w-8 h-8 sm:w-[38px] sm:h-[38px] flex-shrink-0"
                viewBox="0 0 140 140"
                fill="none"
              >
                <ellipse cx="70" cy="70" rx="44" ry="52" stroke="#B95B2B" strokeWidth="2" fill="none"/>
                <path d="M38 50 Q70 22 102 50" stroke="#B95B2B" strokeWidth="1.5" fill="none" opacity="0.6"/>
                <line x1="70" y1="22" x2="70" y2="38" stroke="#B95B2B" strokeWidth="1" opacity="0.4"/>
                <path d="M50 62 Q58 56 66 62 Q58 68 50 62Z" fill="#B95B2B" opacity="0.85"/>
                <path d="M74 62 Q82 56 90 62 Q82 68 74 62Z" fill="#B95B2B" opacity="0.85"/>
                <path d="M70 62 L64 84 L76 84 Z" fill="#8B7355" opacity="0.7"/>
                <path d="M56 96 Q70 104 84 96" stroke="#B95B2B" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                <circle cx="70" cy="70" r="3" fill="#B95B2B" opacity="0.2"/>
              </svg>
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] font-bold tracking-widest text-[#70645C] uppercase">Livraison à</span>
                <p className="text-sm text-[#29231e] flex items-center gap-1 font-bold truncate">
                  Ouagadougou, Zone du Bois
                </p>
              </div>
            </button>

            {/* Barre de Recherche - cachée sur mobile */}
            <div className="hidden flex-1 max-w-xl md:block">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-[#A09388]" size={16} />
                <input
                  type="text"
                  placeholder="Rechercher un plat, un restaurant..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-full rounded-md border border-border-light bg-white py-3 pl-11 pr-4 text-sm text-text-primary placeholder:text-text-secondary shadow-subtle transition-[border-color,box-shadow] duration-200 focus:border-[#B95B2B] focus:outline-none focus:shadow-medium"
                />
              </div>
            </div>

            {/* Boutons d'action */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              {isAuthenticated ? (
                <button
                  type="button"
                  aria-label="Profil"
                  onClick={() => navigate('/profile')}
                  className="rounded-lg border border-border-light bg-white p-2 sm:p-2.5 text-text-primary shadow-subtle transition hover:border-[#B95B2B]"
                >
                  <User size={17} strokeWidth={1.8} />
                </button>
              ) : (
                <button
                  type="button"
                  aria-label="Se connecter"
                  onClick={() => navigate('/auth')}
                  className="inline-flex items-center gap-2 rounded-lg border border-border-light bg-white px-3 sm:px-4 py-2 sm:py-2.5 text-sm font-semibold text-text-primary shadow-subtle transition hover:border-[#B95B2B]"
                >
                  <LogIn size={16} strokeWidth={1.8} />
                  <span className="hidden sm:inline">Connexion</span>
                </button>
              )}
              <button
                aria-label="Notifications"
                onClick={() => setNotifOpen(true)}
                className="relative rounded-lg border border-border-light bg-white p-2 sm:p-2.5 text-text-primary shadow-subtle transition hover:border-[#B95B2B]"
              >
                <Bell size={17} strokeWidth={1.8} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#B95B2B] text-white text-[9px] font-bold flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              <button aria-label="Ouvrir le panier" onClick={() => navigate('/cart')} className="relative rounded-lg border border-border-light bg-white p-2 sm:p-2.5 text-text-primary shadow-subtle transition hover:border-[#B95B2B]">
                <ShoppingBag size={17} strokeWidth={1.8} />
                {cartCount > 0 && (
                  <span key={cartCount} className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#B95B2B] text-white text-[9px] font-bold flex items-center justify-center" style={{ animation: 'cartPop 0.35s ease' }}>
                    {cartCount > 9 ? '9+' : cartCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Catégories de recherche - optimisées mobile */}
          <div className="mt-4 flex gap-2 overflow-x-auto scrollbar-none pt-2">
            {categories.map((category) => {
              const isActive = selectedCategory === category;
              return (
                <button
                  key={category}
                  onClick={() => handleCategoryChange(category)}
                  className={`px-4 py-2 text-xs font-bold rounded-md transition-[transform,background-color,border-color,color,box-shadow] duration-200 whitespace-nowrap border active:scale-[0.96] ${
                    isActive
                      ? 'bg-[#B95B2B] border-[#B95B2B] text-white shadow-subtle'
                      : 'bg-white border-border-light text-text-secondary hover:border-[#B95B2B] hover:text-text-primary'
                  }`}
                >
                  {category === 'all' ? 'Tous les restaurants' : category}
                </button>
              );
            })}
          </div>

          {/* Mobile search bar */}
          <div className="mt-3 md:hidden">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-[#A09388]" size={16} />
              <input
                type="text"
                placeholder="Rechercher un plat, un restaurant..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full rounded-md border border-border-light bg-white py-3 pl-11 pr-4 text-sm text-text-primary placeholder:text-text-secondary shadow-subtle transition-[border-color,box-shadow] duration-200 focus:border-[#B95B2B] focus:outline-none focus:shadow-medium"
              />
            </div>
          </div>
        </div>
      </header>

      {/* Bannière Hero */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 pb-2">
        <HeroBanner />
      </div>

      {/* Section Stories */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <StoryStrip />
      </section>

      {/* Grille de Restaurants */}
      <main id="restaurants" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-9 flex flex-wrap items-end justify-between gap-6">
          <div>
            <h2 className="text-xs font-bold tracking-[0.2em] text-[#70645C] uppercase mb-4 ml-1">
              Tous les restaurants
            </h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => navigate('/ride')}
              className="inline-flex items-center gap-2 bg-[#B95B2B] hover:bg-[#D17843] text-white px-4 py-2.5 rounded-md text-sm font-semibold transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.97]"
            >
              <Car size={16} strokeWidth={2} />
              FasoFree Ride
            </button>
            
            <button
              type="button"
              onClick={() => navigate('/p2p-delivery')}
              className="inline-flex items-center gap-2 bg-[#D17843] hover:bg-[#B95B2B] text-white px-4 py-2.5 rounded-md text-sm font-semibold transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.97]"
            >
              <Package size={16} strokeWidth={2} />
              Envoyer un colis
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:gap-6 max-w-4xl mx-auto">
          {filteredRestaurants.map((restaurant) => (
            <RestaurantCard
              key={restaurant.id}
              restaurant={restaurant}
              onClick={() => navigate(`/restaurant/${restaurant.id}`)}
            />
          ))}
        </div>

        {filteredRestaurants.length === 0 && (
          <div className="app-panel rounded-lg text-center py-16">
            <p className="text-[#70645C] text-sm font-medium mb-3">Aucun restaurant ne correspond à votre recherche</p>
            <button
              className="app-action mt-3"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
              }}
            >
              Réinitialiser les filtres
            </button>
          </div>
        )}
      </main>

      <NotificationDropdown open={notifOpen} onClose={() => setNotifOpen(false)} />
      <Footer />
    </div>
  );
};

export default Home;
