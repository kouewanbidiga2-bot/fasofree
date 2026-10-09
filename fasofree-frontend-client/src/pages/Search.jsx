import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search as SearchIcon, X, Mic, Loader2 } from 'lucide-react';
import RestaurantCard from '../components/RestaurantCard';
import api from '../services/api';
import { getAbsoluteImageUrl, getCategoryFallbackImage, getBrandImage, getBrandName } from '../utils/images';
import { tokenize, matchTokens } from '../utils/searchMatch';

// ─────────────────────────────────────────────────────────────
// 🔍 Recherche intelligente : index des plats construit à la volée
// à partir des menus (/products/business/:id), mis en cache par session.
// « poulet » doit trouver les restaurants qui vendent un poulet, même si
// le nom du restaurant ne contient pas le mot — et même si l'utilisateur
// écrit « poulets » ou se trompe d'une lettre.
// Le matching (accents, préfixe, pluriel, fautes) vit dans utils/searchMatch.
// ─────────────────────────────────────────────────────────────
const DISH_INDEX = new Map(); // businessId -> string[] (noms de plats bruts, pour l'affichage)
const DISH_WORDS = new Map(); // businessId -> string[] (mots indexés, pour la comparaison)
const INDEX_CACHE_KEY = 'fasofree_dish_index_v1';
let dishIndexPromise = null;

// 💾 Cache de session : la 2ᵉ visite ne relance aucune requête de menu
function loadIndexCache() {
  if (DISH_INDEX.size) return;
  try {
    const raw = sessionStorage.getItem(INDEX_CACHE_KEY);
    if (!raw) return;
    const obj = JSON.parse(raw);
    for (const id of Object.keys(obj)) {
      DISH_INDEX.set(id, obj[id].names || []);
      DISH_WORDS.set(id, obj[id].words || []);
    }
  } catch {
    /* cache illisible : on repart d zéro */
  }
}

function saveIndexCache() {
  try {
    const obj = {};
    for (const [id, names] of DISH_INDEX) {
      obj[id] = { names, words: DISH_WORDS.get(id) || [] };
    }
    sessionStorage.setItem(INDEX_CACHE_KEY, JSON.stringify(obj));
  } catch {
    /* quota dépassé : l'index reste valable en mémoire */
  }
}

async function buildDishIndex(restaurants) {
  if (dishIndexPromise) return dishIndexPromise;
  dishIndexPromise = (async () => {
    loadIndexCache();
    const ids = (restaurants || []).map((r) => r.id).filter(Boolean);
    const queue = ids.filter((id) => !DISH_INDEX.has(id));
    // 8 requêtes en parallèle : l'index se construit ~2× plus vite qu'avant
    const workers = Array.from({ length: Math.min(8, queue.length) }, async () => {
      while (queue.length) {
        const id = queue.shift();
        if (!id) continue;
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
        DISH_WORDS.set(id, Array.from(new Set(tokenize(names.join(' ')))));
      }
    });
    await Promise.all(workers);
    saveIndexCache();
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
  // Incrémenté quand l'index des menus est complet → force le recalcul des résultats
  const [dishVersion, setDishVersion] = useState(0);

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

  // 🔍 Préchauffe l'index des menus dès l'ouverture de la page (au lieu d'attendre
  //    2 lettres tapées) : la première recherche est déjà prête/ses résultats s'affichent.
  useEffect(() => {
    if (!allRestaurants.length || dishReady) return;
    setDishLoading(true);
    buildDishIndex(allRestaurants)
      .catch(() => {})
      .finally(() => {
        setDishLoading(false);
        setDishReady(true);
        setDishVersion((v) => v + 1); // ← déclenche le recalcul avec les plats
      });
  }, [allRestaurants, dishReady]);

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    const tokens = tokenize(q);
    if (!tokens.length) return [];

    // Passe 1 : correspondance exacte (préfixe / pluriel).
    // Passe 2 (tolérante aux fautes de frappe) seulement si la passe 1 ne
    // trouve rien — on ne perd pas en précision quand la saisie est correcte.
    const run = (fuzzy) => {
      const scored = [];
      for (const r of allRestaurants) {
        const dishes = DISH_INDEX.get(r.id) || [];
        const nameWords = tokenize(
          `${r.name} ${r.cuisineType || ''} ${r.tagline || ''} ${r.location || ''}`,
        );
        const dishWords = DISH_WORDS.get(r.id) || [];

        const inName = matchTokens(tokens, nameWords, fuzzy);
        const inDish = matchTokens(tokens, dishWords, fuzzy);
        if (!inName && !inDish) continue;

        // Plat correspondant, affiché en indice (« Poulet braisé »)
        let matchHint = '';
        if (inDish) {
          const hit = dishes.find((d) => matchTokens(tokens, tokenize(d), fuzzy));
          if (hit) matchHint = `« ${hit} » sur le menu`;
        }

        scored.push({ restaurant: r, matchHint, inName, inDish });
      }
      return scored;
    };

    let scored = run(false);
    if (!scored.length) scored = run(true);

    // Nom/catégorie d'abord, puis matchs par plat, puis alphabétique
    scored.sort((a, b) => {
      if (a.inName !== b.inName) return a.inName ? -1 : 1;
      if (a.inDish !== b.inDish) return a.inDish ? -1 : 1;
      return a.restaurant.name.localeCompare(b.restaurant.name, 'fr');
    });

    return scored.map((s) => ({ ...s.restaurant, matchHint: s.matchHint }));
  }, [allRestaurants, query, dishVersion]);

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
            className="absolute right-9 top-1/2 -translate-y-1/2 grid h-8 w-8 place-items-center rounded-full bg-accent-primary/10 text-accent-primary transition hover:bg-accent-primary hover:text-white"
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
          <>
            {results.length > 0 ? (
              <>
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
                {dishLoading && (
                  <p className="mt-4 flex items-center justify-center gap-2 text-xs text-[#a09388]">
                    <Loader2 size={13} className="animate-spin" />
                    Recherche dans les menus… d'autres résultats arrivent
                  </p>
                )}
              </>
            ) : dishLoading ? (
              // ⚠️ On n'affiche jamais « aucun résultat » pendant que les menus se chargent
              <div className="flex flex-col items-center justify-center py-20 text-[#70645C]">
                <Loader2 size={36} strokeWidth={1.4} className="mb-3 animate-spin text-accent-primary" />
                <p className="text-sm font-medium">Recherche dans les menus des restaurants…</p>
                <p className="text-xs text-[#a09388] mt-1">
                  On regarde aussi ce que chaque restaurant propose à la carte
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-[#70645C]">
                <SearchIcon size={40} strokeWidth={1.2} className="mb-3 text-[#d6cfc4]" />
                <p className="text-sm font-medium">Aucun resultat pour "{query}"</p>
                <p className="text-xs text-[#a09388] mt-1">
                  Essayez un autre terme : « burger », « poulet », « pizza »…
                </p>
              </div>
            )}
          </>
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