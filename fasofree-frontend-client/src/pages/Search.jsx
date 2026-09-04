import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search as SearchIcon, X } from 'lucide-react';
import RestaurantCard from '../components/RestaurantCard';
import api from '../services/api';
import { getAbsoluteImageUrl, getCategoryFallbackImage, getBrandImage, getBrandName } from '../utils/images';

const mapBusinessToRestaurant = (b) => {
  const category = b.category || 'Fast Food';
  const rawName = b.name || b.fullName || 'Restaurant';
  const name = b.isBrand ? rawName : (getBrandName(rawName) || rawName);
  const brandImage = getBrandImage(rawName);
  const coverUrl = b.coverImage || b.coverUrl || b.cover_url || b.banner || b.cover_image || brandImage;

  return {
    id: b.id,
    name,
    tagline: category,
    description: name,
    isBrand: b.isBrand || false,
    branchCount: b.branchCount || 0,
    branches: b.branches || [],
    logo: b.logo || b.logoUrl || b.logo_url || brandImage,
    coverImage: coverUrl ? (coverUrl.startsWith('/') ? coverUrl : getAbsoluteImageUrl(coverUrl)) : getCategoryFallbackImage(category),
    rating: b.rating ?? 4.0,
    deliveryTime: b.deliveryTime || '25-40 min',
    deliveryFee: b.deliveryFee ?? 500,
    minOrder: b.minOrder ?? 1500,
    location: b.address || 'Ouagadougou',
    cuisineType: category,
  };
};

const SearchPage = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [allRestaurants, setAllRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.getGroupedBusinesses(12.37, -1.52);
        if (Array.isArray(data)) setAllRestaurants(data.map(mapBusinessToRestaurant));
      } catch {
        setAllRestaurants([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const lower = query.toLowerCase();
    return allRestaurants.filter(
      (r) =>
        r.name.toLowerCase().includes(lower) ||
        r.cuisineType.toLowerCase().includes(lower) ||
        r.location.toLowerCase().includes(lower)
    );
  }, [allRestaurants, query]);

  const handleClear = () => setQuery('');

  return (
    <div className="min-h-screen bg-[#FBF8F3]">
      <div className="sticky top-0 z-20 bg-white border-b border-[#e8e0d4] px-4 py-3">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a09388]" size={18} />
          <input
            autoFocus
            type="text"
            placeholder="Rechercher un plat, un restaurant..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-xl border border-[#e8e0d4] bg-[#FBF8F3] py-3 pl-10 pr-10 text-sm text-[#29231e] placeholder:text-[#a09388] outline-none focus:border-[#C1652E] transition-colors"
          />
          {query && (
            <button onClick={handleClear} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a09388]">
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-[#C1652E] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : query.trim() ? (
          results.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {results.map((r) => (
                <RestaurantCard
                  key={r.id}
                  restaurant={r}
                  onClick={() => navigate(`/restaurant/${r.id}`)}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-[#70645C]">
              <SearchIcon size={40} strokeWidth={1.2} className="mb-3 text-[#d6cfc4]" />
              <p className="text-sm font-medium">Aucun resultat pour "{query}"</p>
              <p className="text-xs text-[#a09388] mt-1">Essayez un autre terme</p>
            </div>
          )
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-[#70645C]">
            <SearchIcon size={40} strokeWidth={1.2} className="mb-3 text-[#d6cfc4]" />
            <p className="text-sm font-medium">Recherchez un restaurant ou un plat</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchPage;
