/**
 * FasoFree — Page Accueil (Client)
 * Commerces proches via API /businesses/nearby (GPS réel)
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, ShoppingBag, RefreshCw, AlertCircle, Star, Clock, Bike } from 'lucide-react';
import useCartStore from '../store/cartStore';
import useAuthStore from '../store/authStore';
import { getNearbyBusinesses } from '../services/businessService';
import Footer from '../components/Footer';

const DEFAULT_LAT = 12.3714;  // Ouagadougou
const DEFAULT_LNG = -1.5197;

const Skeleton = ({ className = '' }) => (
  <div className={`skeleton rounded-card ${className}`} />
);

// ─── Carte commerce ─────────────────────────────────────────────────────
const BusinessCard = ({ business, onClick }) => (
  <div
    onClick={onClick}
    className="card-hover overflow-hidden cursor-pointer group animate-scale-in"
  >
    {/* Image */}
    <div className="relative h-40 overflow-hidden bg-background-tertiary">
      {business.imageUrl || business.coverImage ? (
        <img
          src={business.imageUrl || business.coverImage}
          alt={business.name}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <ShoppingBag size={32} className="text-text-tertiary" />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-background-primary/80 to-transparent" />
      {business.distance && (
        <div className="absolute top-2 right-2 px-2 py-1 bg-black/60 backdrop-blur-sm rounded-full flex items-center gap-1">
          <MapPin size={10} className="text-accent-primary" />
          <span className="text-white text-xs font-semibold">{business.distance?.toFixed(1)} km</span>
        </div>
      )}
    </div>

    {/* Infos */}
    <div className="p-4">
      <h3 className="font-bold text-text-primary text-sm mb-1 truncate">{business.name}</h3>
      {business.address && (
        <p className="text-text-tertiary text-xs flex items-center gap-1 mb-2 truncate">
          <MapPin size={10} /> {business.address}
        </p>
      )}
      <div className="flex items-center gap-3 text-xs text-text-secondary">
        <span className="flex items-center gap-1">
          <Clock size={11} /> 20-40 min
        </span>
        <span className="flex items-center gap-1">
          <Bike size={11} /> Livraison
        </span>
      </div>
    </div>
  </div>
);

const Home = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const cartItems = useCartStore(s => s.items || []);

  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [location, setLocation] = useState({ lat: DEFAULT_LAT, lng: DEFAULT_LNG, fromGPS: false });
  const [radius, setRadius] = useState(5);

  const loadBusinesses = useCallback(async (lat, lng, r) => {
    setLoading(true);
    setError('');
    try {
      const data = await getNearbyBusinesses(lat, lng, r);
      setBusinesses(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
      setBusinesses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Tenter GPS, sinon fallback Ouagadougou
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setLocation({ lat, lng, fromGPS: true });
          loadBusinesses(lat, lng, radius);
        },
        () => {
          loadBusinesses(DEFAULT_LAT, DEFAULT_LNG, radius);
        },
        { timeout: 5000 }
      );
    } else {
      loadBusinesses(DEFAULT_LAT, DEFAULT_LNG, radius);
    }
  }, []);

  // Filtrage local par nom
  const filteredBusinesses = businesses.filter(b =>
    !searchQuery ||
    b.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.address?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const cartCount = cartItems.reduce((s, i) => s + (i.quantity || 1), 0);

  return (
    <div className="min-h-screen bg-background-primary">
      {/* ─── HEADER ──────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-background-card/90 backdrop-blur-glass border-b border-border-light">
        <div className="content-wrapper py-4">
          <div className="flex items-center gap-4">
            {/* Logo */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <svg width="32" height="32" viewBox="0 0 140 140" fill="none">
                <ellipse cx="70" cy="70" rx="44" ry="52" stroke="#C1652E" strokeWidth="2" fill="none" />
                <path d="M50 62 Q58 56 66 62 Q58 68 50 62Z" fill="#C1652E" />
                <path d="M74 62 Q82 56 90 62 Q82 68 74 62Z" fill="#C1652E" />
                <path d="M56 96 Q70 104 84 96" stroke="#C1652E" strokeWidth="1.5" fill="none" strokeLinecap="round" />
              </svg>
              <span className="font-bold text-text-primary text-sm hidden sm:block" style={{ fontFamily: 'Clash Display, sans-serif' }}>
                FasoFree
              </span>
            </div>

            {/* Localisation */}
            <div className="flex items-center gap-1 text-xs text-text-secondary hidden sm:flex">
              <MapPin size={12} className="text-accent-primary" />
              {location.fromGPS ? 'Ma position' : 'Ouagadougou'}
            </div>

            {/* Barre de recherche */}
            <div className="flex-1 relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
              <input
                type="text"
                placeholder="Rechercher un commerce..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="input-field pl-9 py-2.5 text-sm"
              />
            </div>

            {/* Panier */}
            <button
              onClick={() => navigate('/cart')}
              className="btn-icon relative flex-shrink-0"
            >
              <ShoppingBag size={17} />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-accent-primary text-white text-xs rounded-full flex items-center justify-center font-bold">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="content-wrapper py-6">
        {/* Bienvenue */}
        <div className="mb-6 animate-slide-up">
          <h1 className="text-xl font-bold text-text-primary">
            Bonjour{user?.fullName ? `, ${user.fullName.split(' ')[0]}` : ''} 👋
          </h1>
          <p className="text-text-secondary text-sm mt-0.5">
            Que souhaitez-vous commander aujourd'hui ?
          </p>
        </div>

        {/* Rayon de recherche */}
        <div className="flex items-center gap-3 mb-6">
          <span className="text-text-secondary text-xs">Rayon :</span>
          {[2, 5, 10, 20].map(r => (
            <button
              key={r}
              onClick={() => { setRadius(r); loadBusinesses(location.lat, location.lng, r); }}
              className={`px-3 py-1 text-xs font-semibold rounded-full transition-all ${
                radius === r ? 'bg-accent-primary text-white' : 'bg-background-secondary text-text-secondary hover:text-text-primary'
              }`}
            >
              {r} km
            </button>
          ))}
          <button onClick={() => loadBusinesses(location.lat, location.lng, radius)} className="btn-icon ml-auto" title="Actualiser">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Erreur */}
        {error && (
          <div className="mb-5 p-3 bg-status-warningBg border border-status-warning/30 rounded-md text-status-warning text-sm flex items-center gap-2">
            <AlertCircle size={14} />
            <span>{error} — Vérifiez que le backend est démarré.</span>
          </div>
        )}

        {/* Titre section */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-text-secondary uppercase tracking-wider">
            Commerces à proximité
          </h2>
          <span className="text-text-tertiary text-xs">
            {loading ? '...' : `${filteredBusinesses.length} trouvé${filteredBusinesses.length !== 1 ? 's' : ''}`}
          </span>
        </div>

        {/* Grille commerces */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1,2,3,4,5,6,7,8].map(i => (
              <div key={i} className="animate-slide-up">
                <Skeleton className="h-40 w-full mb-3" />
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : filteredBusinesses.length === 0 ? (
          <div className="card flex flex-col items-center justify-center py-16 text-center">
            <MapPin size={48} className="text-text-tertiary mb-4" strokeWidth={1} />
            <p className="text-text-secondary font-semibold mb-1">Aucun commerce trouvé</p>
            <p className="text-text-tertiary text-sm mb-4">
              {searchQuery ? 'Essayez un autre terme de recherche.' : 'Essayez d\'agrandir le rayon de recherche.'}
            </p>
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="btn-secondary">
                Effacer la recherche
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredBusinesses.map(business => (
              <BusinessCard
                key={business.id}
                business={business}
                onClick={() => navigate(`/restaurant/${business.id}`)}
              />
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default Home;
