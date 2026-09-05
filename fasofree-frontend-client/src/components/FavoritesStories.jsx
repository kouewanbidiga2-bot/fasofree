import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { api } from '../services/api';
import { getAbsoluteImageUrl, getBrandImage, getBrandName } from '../utils/images';
import useAuthStore from '../store/authStore';

const getInitials = (name) => {
  if (!name) return '??';
  const words = name.trim().split(' ');
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
};

const FavoriteStory = ({ favorite, onClick }) => {
  const [imageError, setImageError] = useState(false);
  const initials = getInitials(favorite.name);

  return (
    <button
      onClick={() => onClick(favorite)}
      className="flex flex-col items-center gap-2 flex-shrink-0 group hover-scale"
    >
      <div className="relative p-0.5 rounded-full bg-gradient-to-tr from-[#C1652E] to-[#e8a379] shadow-subtle hover:shadow-medium transition-shadow duration-200">
        <div className="w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-full bg-background-secondary flex items-center justify-center border-2 border-background-card overflow-hidden">
          {favorite.image && !imageError ? (
            <img
              src={favorite.image}
              alt={favorite.name}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              onError={() => setImageError(true)}
            />
          ) : (
            <span className="text-[#C1652E] font-bold text-lg">
              {initials}
            </span>
          )}
        </div>
      </div>
      <span className="text-xs font-semibold text-[#29231e] truncate max-w-[80px] text-center group-hover:text-[#C1652E] transition-colors">
        {favorite.name}
      </span>
    </button>
  );
};

const AddButton = ({ onClick }) => (
  <button
    onClick={onClick}
    className="flex flex-col items-center gap-2 flex-shrink-0 group hover-scale"
  >
    <div className="relative p-0.5 rounded-full border-2 border-dashed border-[#C1652E]/50 hover:border-[#C1652E] transition-colors duration-200">
      <div className="w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-full bg-white/50 flex items-center justify-center">
        <Plus size={24} className="text-[#C1652E] group-hover:scale-110 transition-transform duration-200" strokeWidth={2.5} />
      </div>
    </div>
    <span className="text-xs font-semibold text-[#70645C] group-hover:text-[#C1652E] transition-colors">Ajouter</span>
  </button>
);

export default function FavoritesStories({ onFavoriteClick, onAddClick }) {
  const { isAuthenticated } = useAuthStore();
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    
    let cancelled = false;
    const loadFavorites = async () => {
      setLoading(true);
      try {
        const data = await api.getFavorites();
        if (!cancelled && Array.isArray(data)) {
          const mappedFavorites = data.map((f) => ({
            id: f.businessId,
            name: getBrandName(f.business?.name) || f.business?.name || 'Commerce',
            image: getBrandImage(f.business?.name) || getAbsoluteImageUrl(f.business?.logo || f.business?.logoUrl || f.business?.logo_url),
          }));
          setFavorites(mappedFavorites);
        }
      } catch {
        if (!cancelled) setFavorites([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadFavorites();
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  if (!isAuthenticated || favorites.length === 0) {
    return null;
  }

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
      <div className="flex gap-4 overflow-x-auto scrollbar-none pb-2">
        {favorites.map((favorite) => (
          <FavoriteStory
            key={favorite.id}
            favorite={favorite}
            onClick={onFavoriteClick}
          />
        ))}
        <AddButton onClick={onAddClick} />
      </div>
    </section>
  );
}