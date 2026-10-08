import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search as SearchIcon, X, Mic } from 'lucide-react';
import RestaurantCard from '../components/RestaurantCard';
import api from '../services/api';
import { getAbsoluteImageUrl, getCategoryFallbackImage, getBrandImage, getBrandName } from '../utils/images';

// ─────────────────────────────────────────────────────────────
// 🔍 Recherche intelligente : index des plats construit à la volée
// à partir des menus (/products/business/:id), mis en cache par session.
// « burger » doit trouver les restaurants qui vendent un burger, même si
// le nom du restaurant ne contient pas le mot.
// ─────────────────────────────────────────────────────────────
const DISH_INDEX = new Map(); // businessId -> string[] (noms de plats bruts)
let dishIndexPromise = null;

const normalizeText = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

async function buildDishIndex(restaurants) {
  if (dishIndexPromise) return dishIndexPromise;
  dishIndexPromise = (async () => {
    const ids = (restaurants || []).map((r) => r.id).filter(Boolean);
    const batchSize = 4;
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (id) => {
          if (DISH_INDEX.has(id)) return;
          const names = [];
          try {
            const data = await api.getBusinessProducts(id);
            const list = Array.isArray(data) ? data : data?.products || [];
            for (const p of list) {
              if (p?.name) names.push(p.name);
              if (typeof p?.category === 'string' && p.category) names.push(p.category);
              if (Array.isArray(p?.categories)) {
                for (const c of p.categories) if (c?.name) names.push(c.name);
              }
            }
          } catch {
            /* business sans menu accessible : on ignore */
          }
          DISH_INDEX.set(id, names);
        }),
      );
    }
  })();
  return dishIndexPromise;
}

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
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get('q') || '');
  const [allRestaurants, setAllRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dishLoading, setDishLoading] = useState(false);
  const [dishReady, setDishReady] = useState(false);

const getUserLocation = () => {
      return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve({ lat: 12.37, lng: -1.52 }); // Fallback Ouaga
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve({ lat: 12.37, lng: -1.52 }), // Fallback Ouaga
        { timeout: 5000, maximumAge: 300000 }
      );
    });
  };

  useEffect(() => {
    const load = async () => {
      try {
        const { lat, lng } = await getUserLocation();
        const data = await api.getGroupedBusinesses(lat, lng);
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
    const q = query.trim();
    if (!q) return [];
    const norm = normalizeText(q);
    const tokens = norm.split(/\s+/).filter(Boolean);
    if (!tokens.length) return [];

    const scored = [];
    for (const r of allRestaurants) {
      const dishes = DISH_INDEX.get(r.id) || [];
      const nameNorm = normalizeText(
        `${r.name} ${r.cuisineType || ''} ${r.tagline || ''} ${r.location || ''}`,
      );
      const dishNorm = normalizeText(dishes.join(' '));

      // Chaque mot doit apparaître dans le nom/catégorie OU dans les plats
      const inName = tokens.every((tk) => nameNorm.includes(tk));
      const inDish = tokens.every((tk) => dishNorm.includes(tk));
      if (!inName && !inDish) continue;

      // Plat correspondant, à afficher en hint (« Burger Classique »)
      let matchHint = '';
      if (inDish) {
        const hit = dishes.find((d) =>
          tokens.some((tk) => normalizeText(d).includes(tk)),
        );
        if (hit) matchHint = `« ${hit} » sur le menu`;
      }

      scored.push({ restaurant: r, matchHint, inName, inDish });
    }

    // Nom/catégorie d'abord, puis matchs par plat, puis alphabétique
    scored.sort((a, b) => {
      if (a.inName !== b.inName) return a.inName ? -1 : 1;
      if (a.inDish !== b.inDish) return a.inDish ? -1 : 1;
      return a.restaurant.name.localeCompare(b.restaurant.name, 'fr');
    });

    return scored.map((s) => ({ ...s.restaurant, matchHint: s.matchHint }));
  }, [allRestaurants, query]);

  // 🔍 Construit l'index des plats en arrière-plan dès qu'on tape (≥ 2 lettres)
  useEffect(() => {
    if (query.trim().length < 2 || dishReady || !allRestaurants.length) return;
    setDishLoading(true);
    buildDishIndex(allRestaurants)
      .catch(() => {})
      .finally(() => {
        setDishLoading(false);
        setDishReady(true);
      });
  }, [query, dishReady, allRestaurants]);

  const handleClear = () => setQuery('');

  // 🎤 Ouvre l'assistant vocal en écoute directe
  const requestVoiceCommand = () => {
    window.dispatchEvent(new CustomEvent('fasofree:voice-command'));
  };

  return (
    <div className="min-h-screen bg-background-primary">
      <div className="sticky top-0 z-20 bg-background-primary border-b border-border-light px-4 py-3">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={18} />
          <input
            autoFocus
            type="text"
            placeholder="Rechercher un plat, un restaurant..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-xl border border-border-light bg-background-secondary py-3 pl-10 pr-16 text-sm text-text-primary placeholder:text-text-secondary outline-none focus:border-accent-primary transition-colors"
          />
          <button
            type="button"
            aria-label="Recherche vocale"
            title="Recherche vocale"
            onClick={requestVoiceCommand}
            className="absolute right-9 top-1/2 -translate-y-1/2 grid h-8 w-8 place-items-center rounded-full bg-[#2E9B5B]/10 text-[#2E9B5B] transition hover:bg-[#2E9B5B] hover:text-white"
          >
            <Mic size={16} />
          </button>
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
                  matchHint={r.matchHint}
                  onClick={() => navigate(`/restaurant/${r.id}`)}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-[#70645C]">
              <SearchIcon size={40} strokeWidth={1.2} className="mb-3 text-[#d6cfc4]" />
              <p className="text-sm font-medium">Aucun resultat pour "{query}"</p>
              <p className="text-xs text-[#a09388] mt-1">
                Essayez un autre terme : « burger », « poulet », « pizza »…
              </p>
              {dishLoading && (
                <p className="text-xs text-[#a09388] mt-3 animate-pulse">
                  Recherche dans les menus des restaurants…
                </p>
              )}
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
