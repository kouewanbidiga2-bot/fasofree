import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Star, Clock, MapPin } from 'lucide-react';
import Footer from '../components/Footer';
import ImageWithFallback from '../components/ImageWithFallback';
import useCartStore from '../store/cartStore';
import api from '../services/api';

const FavoriteIcon = ({ filled, color, inactiveColor = '#8C8275', size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <defs>
      <linearGradient id={`heart-gradient-${filled ? 'filled' : 'empty'}`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor={filled ? color : inactiveColor} stopOpacity={filled ? 1 : 0.3} />
        <stop offset="100%" stopColor={filled ? color : inactiveColor} stopOpacity={filled ? 0.8 : 0.1} />
      </linearGradient>
    </defs>
    <path
      d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
      fill={filled ? `url(#heart-gradient-filled)` : 'none'}
      stroke={filled ? color : inactiveColor}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transition: 'all 0.3s ease' }}
    />
  </svg>
);

const Restaurant = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const { addItem, getTotalItems } = useCartStore();

  useEffect(() => {
    let cancelled = false;
    const loadBusiness = async () => {
      try {
        if (!restaurant) setLoading(true);
        const business = await api.getBusiness(id);
        if (cancelled) return;
        const menu = (business.products || []).map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description || '',
          price: p.price,
          category: p.category || 'Général',
          image: p.imageUrl || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600',
          available: p.isAvailable !== false,
        }));
        setRestaurant({
          id: business.id,
          name: business.name,
          tagline: business.category || 'Restaurant',
          description: business.name,
          logo: business.logo || '/assets/cesar.jpeg',
          coverImage: business.coverImage || '/assets/cesar.jpeg',
          rating: business.rating ?? 4.0,
          deliveryTime: business.deliveryTime || '25-40 min',
          deliveryFee: business.deliveryFee ?? 500,
          minOrder: business.minOrder ?? 1500,
          latitude: business.latitude ?? business.location?.coordinates?.[1] ?? 12.37,
          longitude: business.longitude ?? business.location?.coordinates?.[0] ?? -1.52,
          location: business.address || 'Ouagadougou',
          phone: business.phone || '',
          cuisineType: business.category || 'Fast Food',
          promo: business.promo || null,
          categories: [...new Set(menu.map((m) => m.category))],
          menu,
        });
      } catch {
        if (!cancelled) setRestaurant(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadBusiness();
    return () => { cancelled = true; };
  }, [id]);

  const getRestaurantColor = (name) => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('cesar') || lowerName.includes('césar')) return '#B5502E';
    if (lowerName.includes('chitir')) return '#7A2E1A';
    if (lowerName.includes('gusto')) return '#5C6B3C';
    if (lowerName.includes('belchiken')) return '#B8862E';
    return '#C1652E';
  };

  const restaurantColor = restaurant ? getRestaurantColor(restaurant.name) : '#C1652E';

  if (loading) {
    return (
      <div className="min-h-screen bg-background-primary flex items-center justify-center">
        <p className="text-text-secondary">Chargement du restaurant...</p>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen bg-background-primary flex items-center justify-center">
        <p className="text-text-secondary">Restaurant non trouvé</p>
      </div>
    );
  }

  const filteredMenu = restaurant.menu.filter((item) => {
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch && item.available;
  });

  const popularItems = restaurant.menu.filter((item) => item.popular && item.available);

  const handleAddToCart = (item) => {
    addItem(item, restaurant.id);
  };

  return (
    <>
      <div className="app-page">
      {/* Header */}
      <header className="app-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="p-2 hover:bg-background-secondary transition-colors"
            >
              <ArrowLeft size={18} className="text-text-primary" strokeWidth={1.5} />
            </button>
            <h1 className="text-lg font-display font-bold text-text-primary">{restaurant.name}</h1>
          </div>
        </div>
      </header>

      {/* Restaurant Info */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-32">
        <div className="app-panel mb-6 flex flex-col gap-6 rounded-xl p-5 sm:flex-row sm:items-start">
          <ImageWithFallback
            src={restaurant.logo}
            alt={restaurant.name}
            className="w-32 h-32 object-cover rounded-photo"
          />
          <div className="flex-1">
            <h2 className="text-base font-medium text-text-secondary mb-3">{restaurant.tagline}</h2>
            <div className="flex items-center gap-6 text-sm text-text-secondary">
              <div className="flex items-center gap-2">
                <Star size={14} fill="currentColor" style={{ color: restaurantColor }} />
                <span className="font-mono text-text-primary">{restaurant.rating}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock size={14} strokeWidth={1.5} />
                <span className="font-mono">{restaurant.deliveryTime}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono">{restaurant.deliveryFee} FCFA</span>
              </div>
            </div>
            <p className="text-text-secondary text-sm mt-4 line-clamp-2 max-w-xl">{restaurant.description}</p>
          </div>
          
          <div className="flex flex-col items-end gap-3 mt-4 sm:mt-0">
            {restaurant.promo && (
              <div 
                className="px-3 py-1.5 text-sm font-medium border-b-2"
                style={{ color: restaurantColor, borderColor: restaurantColor }}
              >
                {restaurant.promo}
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <MapPin size={14} strokeWidth={1.5} />
              <span>{restaurant.location}</span>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Rechercher un plat..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="app-input truncate"
          />
        </div>

        {/* Categories */}
        <div className="flex gap-1 overflow-x-auto pb-2 mb-6">
          <button
            onClick={() => setSelectedCategory('all')}
            className="px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2"
            style={{
              color: selectedCategory === 'all' ? restaurantColor : '#8C8275',
              borderColor: selectedCategory === 'all' ? restaurantColor : 'transparent'
            }}
          >
            Tous
          </button>
          {restaurant.categories.map((category) => {
            const isActive = selectedCategory === category;
            return (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className="px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2"
                style={{
                  color: isActive ? restaurantColor : '#8C8275',
                  borderColor: isActive ? restaurantColor : 'transparent'
                }}
              >
                {category}
              </button>
            );
          })}
        </div>

        {/* Popular Items */}
        {selectedCategory === 'all' && popularItems.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-medium text-text-secondary mb-4">Populaires</h2>
            <div>
              {popularItems.map((item) => (
                <MenuItemCard key={item.id} item={item} onAddToCart={handleAddToCart} restaurantColor={restaurantColor} />
              ))}
            </div>
          </div>
        )}

        {/* Menu Items */}
        <div>
          <h2 className="text-sm font-medium text-text-secondary mb-4">
            {selectedCategory === 'all' ? 'Menu' : selectedCategory}
          </h2>
          <div>
            {filteredMenu.map((item) => (
              <MenuItemCard key={item.id} item={item} onAddToCart={handleAddToCart} restaurantColor={restaurantColor} />
            ))}
          </div>

          {filteredMenu.length === 0 && (
            <div className="text-center py-12">
              <p className="text-text-secondary text-sm">Aucun plat trouvé</p>
            </div>
          )}
        </div>
      </div>

      {/* Floating Cart Button */}
      {getTotalItems() > 0 && (
        <div className="fixed bottom-24 right-6 z-50">
          <button
            onClick={() => navigate('/cart')}
            className="app-action flex gap-3 shadow-medium"
          >
            <span>Panier</span>
            <span className="bg-white/20 px-2 py-0.5 text-xs">{getTotalItems()}</span>
          </button>
        </div>
      )}
    </div>
    <Footer />
    </>
  );
};

const MenuItemCard = ({ item, onAddToCart, restaurantColor }) => {
  const [isLiked, setIsLiked] = useState(false);

  return (
    <div className="app-panel mb-4 flex gap-4 rounded-lg p-4">
      <div className="w-28 h-28 flex-shrink-0 overflow-hidden">
        <ImageWithFallback
          src={item.image}
          alt={item.name}
          className="w-full h-full object-cover rounded-photo"
        />
      </div>
      
      <div className="flex-1 flex flex-col justify-between">
        <div>
          <h3 className="text-base font-medium text-text-primary truncate">{item.name}</h3>
          <p className="text-sm text-text-secondary line-clamp-2 mt-1">{item.description}</p>
        </div>
        
        <div className="flex items-center justify-between mt-2">
          <span className="text-base font-mono text-text-primary">
            {item.price.toLocaleString()} FCFA
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsLiked(!isLiked)}
              className="rounded-md p-2 hover:bg-background-secondary transition-colors"
            >
              <FavoriteIcon
                filled={isLiked}
                color={restaurantColor}
              />
            </button>
            <button
              onClick={() => onAddToCart(item)}
              className="app-action-secondary px-4 py-2"
              style={{ borderColor: restaurantColor }}
            >
              Ajouter
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Restaurant;
