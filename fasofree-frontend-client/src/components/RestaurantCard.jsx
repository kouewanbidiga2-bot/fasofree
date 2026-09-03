import React, { useState } from 'react';
import { getAbsoluteImageUrl, getCategoryFallbackImage } from '../utils/images';

const getInitials = (name) => {
  if (!name) return '??';
  const words = name.trim().split(' ');
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
};

const RestaurantCard = ({ restaurant, onClick }) => {
  const [mainImageError, setMainImageError] = useState(false);
  
  let signatureImage = restaurant.signatureImage || restaurant.coverImage;
  if (!signatureImage && restaurant.menu && restaurant.menu.length > 0 && restaurant.menu[0]?.image) {
    signatureImage = restaurant.menu[0].image;
  }
  
  const imageUrl = signatureImage ? getAbsoluteImageUrl(signatureImage) : getCategoryFallbackImage(restaurant.cuisineType);

  return (
    <article 
      className="w-full cursor-pointer group"
      onClick={onClick}
    >
      {/* Visuel carré style Pinterest : le logo seul, bord à bord, coins légèrement arrondis */}
      <div className="relative w-full aspect-square bg-white border border-[#E9E0D5] overflow-hidden rounded-xl group-hover:border-[#C1652E]/60 transition-colors">
        {!mainImageError ? (
          <img
            src={imageUrl}
            alt={restaurant.name}
            className="w-full h-full object-contain group-hover:scale-[1.03] transition-transform duration-300"
            onError={() => setMainImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-[#29231e] p-4 text-center">
             <span className="text-white text-2xl font-display font-bold">{getInitials(restaurant.name)}</span>
          </div>
        )}
        
        {/* Promo Badge */}
        {restaurant.promo && (
          <div className="absolute top-2.5 left-2.5 bg-[#C1652E] px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider rounded">
            {restaurant.promo}
          </div>
        )}
      </div>

      {/* Infos compactes sous le visuel — typographie du système */}
      <div className="pt-2.5 px-0.5">
        <h3 className="font-display text-sm sm:text-[15px] font-bold tracking-tight text-[#29231e] leading-tight truncate group-hover:text-[#C1652E] transition-colors">
          {restaurant.name}
        </h3>
        <div className="flex items-center gap-2 mt-1">
          <p className="font-mono text-[11px] sm:text-xs text-[#74695F] font-medium truncate">
            {restaurant.deliveryTime}
          </p>
          {restaurant.isBrand && restaurant.branchCount > 1 && (
            <span className="text-[10px] font-bold text-[#C1652E] bg-[#C1652E]/10 px-1.5 py-0.5 rounded">
              {restaurant.branchCount} agences
            </span>
          )}
        </div>
      </div>
    </article>
  );
};

export default RestaurantCard;
