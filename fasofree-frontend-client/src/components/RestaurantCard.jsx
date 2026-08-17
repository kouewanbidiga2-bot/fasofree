import React from 'react';
import { ArrowUpRight, Clock, Star } from 'lucide-react';
import ImageWithFallback from './ImageWithFallback';

const getRestaurantTheme = (name) => ({ cesar: '#B5502E', chitir: '#7A2E1A', gusto: '#5C6B3C', belchiken: '#B8862E' }[name.toLowerCase()] || '#B95B2B');

const RestaurantCard = ({ restaurant, onClick }) => {
  const themeColor = getRestaurantTheme(restaurant.name);
  return (
    <article className="restaurant-card group cursor-pointer" onClick={onClick}>
      <div className="restaurant-image-wrap">
        <ImageWithFallback src={restaurant.logo} alt={restaurant.name} className="restaurant-image" />
        <span className="restaurant-open" style={{ color: themeColor }}>Ouvert</span>
        <span className="restaurant-arrow" aria-hidden="true"><ArrowUpRight size={19} strokeWidth={2} /></span>
      </div>
      <div className="flex items-start justify-between gap-4 pt-4">
        <div>
          <h3 className="font-serif text-[1.45rem] font-semibold leading-tight tracking-tight text-text-primary">{restaurant.name}</h3>
          <p className="mt-2 text-sm leading-5 text-text-secondary">{restaurant.cuisineType}</p>
        </div>
        <div className="shrink-0 text-right text-xs font-semibold text-text-secondary">
          <span className="flex items-center justify-end gap-1"><Star size={13} fill={themeColor} color={themeColor} /> {restaurant.rating}</span>
          <span className="mt-1 flex items-center justify-end gap-1"><Clock size={13} /> {restaurant.deliveryTime}</span>
        </div>
      </div>
      {restaurant.promo && <p className="mt-4 border-l-2 pl-2 text-xs font-bold uppercase tracking-[0.1em]" style={{ borderColor: themeColor, color: themeColor }}>{restaurant.promo}</p>}
    </article>
  );
};

export default RestaurantCard;
