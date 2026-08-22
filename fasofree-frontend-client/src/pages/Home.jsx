import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, Bell, ShoppingBag, Package, Car, LogIn } from 'lucide-react';
import Footer from '../components/Footer';
import RestaurantCard from '../components/RestaurantCard';
import HeroBanner from '../components/HeroBanner';
import UserMenu from '../components/UserMenu';
import NotificationDropdown from '../components/NotificationDropdown';
import api from '../services/api';
import useAuthStore from '../store/authStore';
import useNotificationStore from '../store/notificationStore';
import { getAbsoluteImageUrl } from '../utils/images';

const mapBusinessToRestaurant = (b) => ({
  id: b.id,
  name: b.name || b.fullName || 'Restaurant',
  tagline: b.category || 'Restaurant',
  description: b.name || b.fullName || 'Restaurant',
  logo: getAbsoluteImageUrl(b.logo || b.logoUrl || b.logo_url),
  coverImage: getAbsoluteImageUrl(b.coverImage || b.coverUrl || b.cover_url || b.banner || b.cover_image),
  rating: b.rating ?? 4.0,
  deliveryTime: b.deliveryTime || '25-40 min',
  deliveryFee: b.deliveryFee ?? 500,
  minOrder: b.minOrder ?? 1500,
  latitude: b.latitude ?? b.location?.coordinates?.[1] ?? 12.37,
  longitude: b.longitude ?? b.location?.coordinates?.[0] ?? -1.52,
  location: b.address || 'Ouagadougou',
  phone: b.phone || '',
  cuisineType: b.category || 'Fast Food',
  promo: b.promo || null,
  categories: b.categories || [],
  menu: b.menu || [],
});

const Home = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [allRestaurants, setAllRestaurants] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const { unreadCount } = useNotificationStore();

  useEffect(() => {
    let cancelled = false;
    const loadBusinesses = async () => {
      try {
        const data = await api.getNearbyBusinesses(12.37, -1.52, 10000);
        if (!cancelled && Array.isArray(data)) {
          setAllRestaurants(data.map(mapBusinessToRestaurant));
        }
      } catch {
        // API failed — list stays empty
      }
    };
    loadBusinesses();
    return () => { cancelled = true; };
  }, []);

  const categories = ['all', 'Fast-Food', 'Cuisine Locale', 'Pâtisseries & Desserts', 'Supermarchés & Épiceries'];

  const filteredRestaurants = useMemo(() => {
    let filtered = allRestaurants;
    if (selectedCategory !== 'all') {
      filtered = filtered.filter((r) => r.cuisineType === selectedCategory);
    }
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
  }, [allRestaurants, selectedCategory, searchQuery]);

  const handleSearch = useCallback((query) => {
    setSearchQuery(query);
  }, []);

  const handleCategoryChange = useCallback((category) => {
    setSelectedCategory(category);
  }, []);

  return (
    <div className="app-page text-text-primary font-sans">
      {/* Header Lumineux */}
      <header className="app-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            
            {/* Logo & Localisation */}
            <button type="button" className="flex items-center gap-3 text-left" onClick={() => navigate('/')} aria-label="Retour à l'accueil">
              <svg
                style={{ width: '38px', height: '38px' }}
                viewBox="0 0 140 140"
                fill="none"
              >
                <ellipse cx="70" cy="70" rx="44" ry="52" stroke="#C1652E" strokeWidth="2" fill="none"/>
                <path d="M38 50 Q70 22 102 50" stroke="#C1652E" strokeWidth="1.5" fill="none" opacity="0.6"/>
                <line x1="70" y1="22" x2="70" y2="38" stroke="#C1652E" strokeWidth="1" opacity="0.4"/>
                <path d="M50 62 Q58 56 66 62 Q58 68 50 62Z" fill="#C1652E" opacity="0.85"/>
                <path d="M74 62 Q82 56 90 62 Q82 68 74 62Z" fill="#C1652E" opacity="0.85"/>
                <path d="M70 62 L64 84 L76 84 Z" fill="#8B7355" opacity="0.7"/>
                <path d="M56 96 Q70 104 84 96" stroke="#C1652E" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                <circle cx="70" cy="70" r="3" fill="#C1652E" opacity="0.2"/>
              </svg>
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold tracking-wider text-[#C1652E] uppercase">Livraison Premium</span>
                <p className="text-xs text-[#70645C] flex items-center gap-1 font-medium">
                  <MapPin size={12} className="text-[#C1652E]" />
                  Ouagadougou
                </p>
              </div>
            </button>

            {/* Barre de Recherche */}
            <div className="hidden flex-1 max-w-xl md:block">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-[#A09388]" size={16} />
                <input
                  type="text"
                  placeholder="Rechercher un plat, un restaurant..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-full rounded-md border border-border-light bg-white py-3 pl-11 pr-4 text-sm text-text-primary placeholder:text-text-secondary shadow-subtle transition-[border-color,box-shadow] duration-200 focus:border-accent-primary focus:outline-none focus:shadow-medium"
                />
              </div>
            </div>

            {/* Boutons d'action */}
            <div className="flex items-center gap-2">
              {isAuthenticated ? (
                <UserMenu />
              ) : (
                <button
                  type="button"
                  aria-label="Se connecter"
                  onClick={() => navigate('/auth')}
                  className="inline-flex items-center gap-2 rounded-full border border-border-light bg-white px-4 py-2.5 text-sm font-semibold text-text-primary shadow-subtle transition hover:border-accent-primary"
                >
                  <LogIn size={16} strokeWidth={1.8} />
                  <span className="sm:inline">Connexion</span>
                </button>
              )}
              <button
                aria-label="Notifications"
                onClick={() => setNotifOpen(true)}
                className="relative rounded-full border border-border-light bg-white p-2.5 text-text-primary shadow-subtle transition hover:border-accent-primary"
              >
                <Bell size={18} strokeWidth={1.8} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-accent-primary text-white text-[9px] font-bold flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              <button aria-label="Ouvrir le panier" onClick={() => navigate('/cart')} className="rounded-full border border-border-light bg-white p-2.5 text-text-primary shadow-subtle transition hover:border-accent-primary">
                <ShoppingBag size={18} strokeWidth={1.8} />
              </button>
            </div>
          </div>

          {/* Catégories de recherche */}
          <div className="mt-4 flex gap-2 overflow-x-auto scrollbar-none pt-2">
            {categories.map((category) => {
              const isActive = selectedCategory === category;
              return (
                <button
                  key={category}
                  onClick={() => handleCategoryChange(category)}
                  className={`px-4 py-2 text-xs font-bold rounded-md transition-[transform,background-color,border-color,color,box-shadow] duration-200 whitespace-nowrap border active:scale-[0.96] ${
                    isActive
                      ? 'bg-accent-primary border-accent-primary text-white shadow-subtle'
                      : 'bg-white border-border-light text-text-secondary hover:border-accent-primary hover:text-text-primary'
                  }`}
                >
                  {category === 'all' ? 'Tous les restaurants' : category}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Bannière Hero */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 pb-2">
        <HeroBanner />
      </section>

      {/* Grille de Restaurants */}
      <main id="restaurants" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-9 flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-primary">Aujourd'hui à Ouaga</p>
            <h2 className="mt-2 text-balance text-4xl font-display font-semibold tracking-[-0.05em] text-text-primary">
              Les adresses du moment.
            </h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-text-secondary">
              Commandez auprès des meilleurs établissements à Ouagadougou
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/ride')}
            className="app-action gap-2"
            style={{ marginRight: '0.5rem' }}
          >
            <Car size={16} strokeWidth={2} />
            FasoFree Ride
          </button>
          <button
            type="button"
            onClick={() => navigate('/p2p-delivery')}
            className="app-action gap-2"
          >
            <Package size={16} strokeWidth={2} />
            Envoyer un colis
          </button>
        </div>

        <div className="restaurant-grid grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 lg:gap-6">
          {filteredRestaurants.map((restaurant) => (
            <RestaurantCard
              key={restaurant.id}
              restaurant={restaurant}
              onClick={() => navigate(`/restaurant/${restaurant.id}`)}
            />
          ))}
        </div>

        {filteredRestaurants.length === 0 && (
          <div className="app-panel rounded-xl text-center py-16">
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
