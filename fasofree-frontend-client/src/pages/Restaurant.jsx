import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Star, Clock, MapPin, Check, ChevronDown, Navigation } from 'lucide-react';
import Footer from '../components/Footer';
import ImageWithFallback from '../components/ImageWithFallback';
import VoiceOrderButton from '../components/VoiceOrderButton';
import useCartStore from '../store/cartStore';
import { useVoiceOrder } from '../hooks/useVoiceOrder';
import { api } from '../services/api';
import { getAbsoluteImageUrl, getCategoryFallbackImage, getBrandImage, getBrandName } from '../utils/images';

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
  const [isFavorited, setIsFavorited] = useState(false);
  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const { addItem, getTotalItems } = useCartStore();

  const menu = restaurant?.menu || [];

  const handleVoiceItemsMatched = useCallback((matched) => {
    if (!restaurant) return;
    matched.forEach(({ item, quantity }) => {
      for (let i = 0; i < quantity; i++) {
        addItem(item, restaurant.id);
      }
    });
  }, [restaurant, addItem]);

  const voiceOrder = useVoiceOrder(menu, handleVoiceItemsMatched);

  // Fetch user location for branch sorting
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {} // Silently fail
      );
    }
  }, []);

  useEffect(() => {
    // Check if this restaurant is favorited
    api.getFavoriteIds().then((ids) => {
      if (Array.isArray(ids) && ids.includes(id)) setIsFavorited(true);
    }).catch(() => {});
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    const loadBusiness = async () => {
      try {
        if (!restaurant) setLoading(true);
        const business = await api.getBusiness(id);
        if (cancelled) return;
        const menu = (business.products || []).map((p) => {
          const itemImage = p.imageUrl || p.image_url || p.image || p.photo || p.photoUrl || p.photo_url;
          const category = p.category || 'Général';
          return {
            id: p.id,
            name: p.name,
            description: p.description || '',
            price: p.price,
            category,
            image: itemImage ? getAbsoluteImageUrl(itemImage) : getCategoryFallbackImage(category),
            available: p.isAvailable !== false,
          };
        });
        const signatureField = business.signatureImage || business.signature_image;
        const signatureImage = signatureField ? getAbsoluteImageUrl(signatureField) : null;
        
        setRestaurant({
          id: business.id,
          name: getBrandName(business.name) || business.name,
          tagline: business.category || 'Restaurant',
          description: business.name,
          logo: business.logo || business.logoUrl || business.logo_url || getBrandImage(business.name),
          coverImage: getAbsoluteImageUrl(business.coverImage || business.coverUrl || business.cover_url || business.banner || business.cover_image) || getCategoryFallbackImage(business.category || 'default'),
          signatureImage,
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
          brandId: business.brandId,
        });

        // Load branches if this restaurant has a brand
        if (business.brandId) {
          try {
            const branchesData = await api.getBrandBranches(
              business.brandId,
              userLocation?.lat,
              userLocation?.lng
            );
            if (!cancelled && Array.isArray(branchesData)) {
              setBranches(branchesData);
              setSelectedBranchId(business.id);
            }
          } catch {
            // Silently fail - branch selector won't show
          }
        }
      } catch {
        if (!cancelled) setRestaurant(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadBusiness();
    return () => { cancelled = true; };
  }, [id, userLocation]);

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

  const toggleFavorite = async () => {
    // Optimistic UI: flip instantly
    const prev = isFavorited;
    setIsFavorited(!prev);
    try {
      const result = await api.toggleFavorite(restaurant.id);
      if (result && typeof result.isFavorited === 'boolean') {
        setIsFavorited(result.isFavorited);
      }
    } catch {
      setIsFavorited(prev); // rollback on error
    }
  };

  return (
    <>
      <div className="app-page">
      {/* Header */}
      <header className="app-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={() => navigate('/')}
              className="p-2 hover:bg-background-secondary transition-colors flex-shrink-0"
            >
              <ArrowLeft size={18} className="text-text-primary" strokeWidth={1.5} />
            </button>
            <h1 className="text-base sm:text-lg font-display font-bold text-text-primary truncate min-w-0 flex-1">{restaurant.name}</h1>
            <button
              onClick={toggleFavorite}
              className="p-2 hover:bg-background-secondary rounded-full transition-colors flex-shrink-0"
              aria-label={isFavorited ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            >
              <FavoriteIcon filled={isFavorited} color={restaurantColor} size={22} />
            </button>
          </div>
        </div>
      </header>

      {/* Restaurant Info */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-32">
        <div className="app-panel mb-6 flex flex-col gap-6 rounded-xl p-5 sm:flex-row sm:items-start">
          <ImageWithFallback
            src={restaurant.logo}
            alt={restaurant.name}
            className="w-24 h-24 sm:w-32 sm:h-32 object-cover rounded-photo flex-shrink-0"
          />
          <div className="flex-1">
            <h2 className="text-base font-medium text-text-secondary mb-3">{restaurant.tagline}</h2>
            <div className="flex items-center gap-3 sm:gap-6 text-sm text-text-secondary flex-wrap">
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
          
          <div className="flex flex-col items-start sm:items-end gap-3 mt-4 sm:mt-0 min-w-0">
            {restaurant.promo && (
              <div 
                className="px-3 py-1.5 text-sm font-medium border-b-2"
                style={{ color: restaurantColor, borderColor: restaurantColor }}
              >
                {restaurant.promo}
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-text-secondary max-w-full">
              <MapPin size={14} strokeWidth={1.5} className="flex-shrink-0" />
              <span className="break-words">{restaurant.location}</span>
            </div>
          </div>
        </div>

        {/* Branch Selector (Multi-agences) */}
        {branches.length > 1 && (
          <div className="mb-6">
            <div className="app-panel rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Navigation size={16} style={{ color: restaurantColor }} />
                <span className="text-sm font-medium text-text-primary">Choisir une agence</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {branches.map((branch) => {
                  const isSelected = selectedBranchId === branch.id;
                  const distance = branch.distanceMeters
                    ? branch.distanceMeters < 1000
                      ? `${branch.distanceMeters} m`
                      : `${(branch.distanceMeters / 1000).toFixed(1)} km`
                    : null;
                  return (
                    <button
                      key={branch.id}
                      onClick={() => {
                        setSelectedBranchId(branch.id);
                        // Reload menu from selected branch
                        navigate(`/restaurant/${branch.id}`, { replace: true });
                      }}
                      className={`p-3 rounded-lg text-left transition-all ${
                        isSelected
                          ? 'ring-2'
                          : 'bg-background-secondary hover:bg-background-primary'
                      }`}
                      style={{
                        backgroundColor: isSelected ? restaurantColor + '15' : undefined,
                        borderColor: isSelected ? restaurantColor : 'transparent',
                        ringColor: isSelected ? restaurantColor : undefined,
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className={`text-sm font-medium truncate ${isSelected ? 'text-text-primary' : 'text-text-secondary'}`}>
                            {branch.name}
                          </p>
                          <p className="text-xs text-text-secondary mt-0.5 truncate">{branch.address}</p>
                        </div>
                        {distance && (
                          <span className="text-xs font-mono flex-shrink-0" style={{ color: restaurantColor }}>
                            {distance}
                          </span>
                        )}
                      </div>
                      {branch.isOpen === false && (
                        <span className="text-xs text-red-500 mt-1">Fermé</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

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

      {/* Voice Order Button */}
      <VoiceOrderButton
        isListening={voiceOrder.isListening}
        transcript={voiceOrder.transcript}
        results={voiceOrder.results}
        supported={voiceOrder.supported}
        error={voiceOrder.error}
        onToggle={voiceOrder.toggleListening}
        onDismiss={() => voiceOrder.stopListening()}
      />

      {/* Floating Cart Button */}
      {getTotalItems() > 0 && (
        <div className="fixed bottom-24 right-4 sm:right-6 z-50">
          <button
            onClick={() => navigate('/cart')}
            className="app-action flex gap-3 shadow-medium"
          >
            <span>Panier</span>
            <span
              key={getTotalItems()}
              className="bg-white/20 px-2 py-0.5 text-xs"
              style={{ animation: 'cartPop 0.35s ease' }}
            >
              {getTotalItems()}
            </span>
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
  const [justAdded, setJustAdded] = useState(false);

  const handleAdd = () => {
    onAddToCart(item);
    // Feedback visuel discret sur le bouton (pas de message) : ✓ puis retour
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1200);
  };

  return (
    <div className="app-panel mb-4 flex gap-3 sm:gap-4 rounded-lg p-3 sm:p-4">
      <div className="w-24 h-24 sm:w-28 sm:h-28 flex-shrink-0 overflow-hidden">
        <ImageWithFallback
          src={item.image}
          alt={item.name}
          className="w-full h-full object-cover rounded-photo"
        />
      </div>
      
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div>
          <h3 className="text-base font-medium text-text-primary truncate">{item.name}</h3>
          <p className="text-sm text-text-secondary line-clamp-2 mt-1">{item.description}</p>
        </div>
        
        <div className="flex items-center justify-between flex-wrap gap-2 mt-2">
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
              onClick={handleAdd}
              aria-label="Ajouter au panier"
              className={`min-w-[92px] px-4 py-2 rounded-md text-sm font-medium border flex items-center justify-center gap-1.5 transition-all duration-200 active:scale-95 ${
                justAdded ? 'text-white' : 'app-action-secondary'
              }`}
              style={
                justAdded
                  ? { backgroundColor: restaurantColor, borderColor: restaurantColor }
                  : { borderColor: restaurantColor }
              }
            >
              {justAdded ? (
                <>
                  <Check size={16} strokeWidth={2.5} />
                  <span>Ajouté</span>
                </>
              ) : (
                'Ajouter'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Restaurant;
