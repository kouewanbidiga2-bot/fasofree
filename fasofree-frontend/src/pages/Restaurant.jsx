/**
 * FasoFree — Page Restaurant (Client)
 * Affiche le catalogue d'un restaurant via l'API
 */
import React, { useState, useEffect, useCallback } from 'react';
// ✅ CORRECT
import { useNavigate, useLocation, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Star, Clock, MapPin, Search, AlertCircle, ShoppingBag } from 'lucide-react';
import Footer from '../components/Footer';
import { getBusinessById } from '../services/businessService';
import { getProductsByBusiness } from '../services/productService';
import useCartStore from '../store/cartStore';

// ─── Skeletons ───────────────────────────────────────────────────────────
const HeaderSkeleton = () => (
  <div className="flex flex-col sm:flex-row gap-6 mb-8 animate-pulse">
    <div className="w-32 h-32 rounded-photo bg-background-secondary" />
    <div className="flex-1 space-y-3 pt-2">
      <div className="h-6 w-1/3 bg-background-secondary rounded" />
      <div className="h-4 w-1/4 bg-background-secondary rounded" />
      <div className="flex gap-4 pt-2">
        <div className="h-4 w-16 bg-background-secondary rounded" />
        <div className="h-4 w-16 bg-background-secondary rounded" />
      </div>
    </div>
  </div>
);

const ProductSkeleton = () => (
  <div className="flex gap-4 py-5 border-b border-border-light animate-pulse">
    <div className="w-28 h-28 rounded-photo bg-background-secondary" />
    <div className="flex-1 flex flex-col justify-between">
      <div className="space-y-2">
        <div className="h-5 w-1/2 bg-background-secondary rounded" />
        <div className="h-4 w-full bg-background-secondary rounded" />
      </div>
      <div className="flex justify-between items-end mt-4">
        <div className="h-5 w-20 bg-background-secondary rounded" />
        <div className="h-9 w-24 bg-background-secondary rounded" />
      </div>
    </div>
  </div>
);

// ─── Composant ──────────────────────────────────────────────────────────
const Restaurant = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addItem, getTotalItems } = useCartStore();

  const [restaurant, setRestaurant] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [bizData, prodData] = await Promise.all([
        getBusinessById(id),
        getProductsByBusiness(id)
      ]);
      setRestaurant(bizData);
      setProducts(Array.isArray(prodData) ? prodData : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Extraction dynamique des catégories
  const categories = ['all', ...new Set(products.map(p => p.category).filter(Boolean))];

  // Filtrage
  const filteredProducts = products.filter(item => {
    if (!item.isAvailable) return false;
    const matchesCat = selectedCategory === 'all' || item.category === selectedCategory;
    const matchesSearch = !searchQuery || 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-background-primary flex flex-col">
      {/* ─── HEADER FIXE ────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-background-card/90 backdrop-blur-glass border-b border-border-light">
        <div className="content-wrapper py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="btn-icon">
              <ArrowLeft size={18} />
            </button>
            <h1 className="text-lg font-bold text-text-primary hidden sm:block">
              {restaurant?.name || 'Restaurant'}
            </h1>
          </div>
          <button onClick={() => navigate('/cart')} className="btn-icon relative">
            <ShoppingBag size={18} />
            {getTotalItems() > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-accent-primary text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                {getTotalItems()}
              </span>
            )}
          </button>
        </div>
      </header>

      <main className="flex-1 content-wrapper py-6">
        {error && (
          <div className="mb-6 p-4 bg-status-errorBg border border-status-error/30 rounded-md text-status-error flex items-center gap-2">
            <AlertCircle size={18} /> {error}
          </div>
        )}

        {loading ? (
          <>
            <HeaderSkeleton />
            <div className="mt-8">
              {[1, 2, 3].map(i => <ProductSkeleton key={i} />)}
            </div>
          </>
        ) : !restaurant ? (
          <div className="card flex flex-col items-center justify-center py-20 text-center">
            <Star size={48} className="text-text-tertiary mb-4" strokeWidth={1} />
            <p className="text-text-secondary font-semibold">Restaurant introuvable</p>
          </div>
        ) : (
          <div className="animate-slide-up">
            {/* ─── INFOS RESTAURANT ─────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row gap-6 mb-8">
              <div className="w-full sm:w-32 h-40 sm:h-32 rounded-card overflow-hidden flex-shrink-0 relative">
                {restaurant.imageUrl || restaurant.coverImage || restaurant.logo ? (
                  <img
                    src={restaurant.imageUrl || restaurant.coverImage || restaurant.logo}
                    alt={restaurant.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-background-secondary flex items-center justify-center">
                    <ShoppingBag size={32} className="text-text-tertiary" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent sm:hidden" />
                <h1 className="absolute bottom-4 left-4 text-xl font-bold text-white sm:hidden">{restaurant.name}</h1>
              </div>

              <div className="flex-1 flex flex-col justify-center">
                <h1 className="text-2xl font-bold text-text-primary hidden sm:block mb-1">{restaurant.name}</h1>
                {restaurant.description && (
                  <p className="text-text-secondary text-sm mb-4 line-clamp-2">{restaurant.description}</p>
                )}
                <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-text-secondary">
                  <span className="flex items-center gap-1.5 px-2 py-1 bg-background-secondary rounded-md text-accent-primary">
                    <Star size={13} className="fill-current" /> 4.5
                  </span>
                  <span className="flex items-center gap-1.5 px-2 py-1 bg-background-secondary rounded-md">
                    <Clock size={13} /> 20-40 min
                  </span>
                  <span className="flex items-center gap-1.5 px-2 py-1 bg-background-secondary rounded-md">
                    <MapPin size={13} /> {restaurant.address || 'Ouagadougou'}
                  </span>
                </div>
              </div>
            </div>

            {/* ─── RECHERCHE & FILTRES ──────────────────────────────── */}
            <div className="sticky top-[73px] z-30 bg-background-primary pt-2 pb-4 border-b border-border-light mb-6">
              <div className="relative mb-4">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
                <input
                  type="text"
                  placeholder="Rechercher un plat..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="input-field pl-10"
                />
              </div>

              <div className="tabs-bar overflow-x-auto scrollbar-hide border-none">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`tab-btn flex-shrink-0 ${selectedCategory === cat ? 'active' : ''}`}
                  >
                    {cat === 'all' ? 'Tout le menu' : cat}
                  </button>
                ))}
              </div>
            </div>

            {/* ─── LISTE PRODUITS ───────────────────────────────────── */}
            <div className="mb-20">
              {filteredProducts.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-text-secondary text-sm">Aucun plat ne correspond à votre recherche.</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredProducts.map(item => (
                    <div key={item.id} className="flex gap-4 py-5 border-b border-border-light group">
                      <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-photo overflow-hidden flex-shrink-0 bg-background-secondary">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ShoppingBag size={24} className="text-text-tertiary" />
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1 flex flex-col justify-between">
                        <div>
                          <h3 className="text-sm sm:text-base font-bold text-text-primary mb-1">{item.name}</h3>
                          {item.description && (
                            <p className="text-xs text-text-secondary line-clamp-2 leading-relaxed">{item.description}</p>
                          )}
                        </div>
                        
                        <div className="flex items-end justify-between mt-3">
                          <span className="font-mono font-bold text-accent-primary">
                            {(item.price || 0).toLocaleString()} FCFA
                          </span>
                          <button
                            onClick={() => addItem(item, restaurant.id)}
                            className="btn-secondary py-1.5 px-3 sm:px-4 sm:py-2 text-xs"
                          >
                            Ajouter
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ─── FLOATING CART BUTTON ─────────────────────────────────── */}
      {getTotalItems() > 0 && (
        <div className="fixed bottom-6 inset-x-0 px-4 sm:px-0 sm:left-auto sm:right-6 z-50 animate-slide-up max-w-sm w-full mx-auto sm:mx-0">
          <button
            onClick={() => navigate('/cart')}
            className="w-full btn-primary py-4 shadow-elevated flex items-center justify-between"
          >
            <span className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">
                {getTotalItems()}
              </span>
              <span>Voir le panier</span>
            </span>
            <span className="font-mono font-bold bg-black/20 px-2 py-1 rounded">
              Commander
            </span>
          </button>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default Restaurant;
