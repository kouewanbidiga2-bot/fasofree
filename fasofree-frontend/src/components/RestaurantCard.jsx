import React from 'react';
import { Star, Clock } from 'lucide-react';

const getRestaurantTheme = (name) => {
  const lowerName = name.toLowerCase();
  if (lowerName.includes('cesar') || lowerName.includes('césar')) return '#B5502E';
  if (lowerName.includes('chitir')) return '#7A2E1A';
  if (lowerName.includes('gusto')) return '#5C6B3C';
  if (lowerName.includes('belchiken')) return '#B8862E';
  return '#C1652E';
};

const RestaurantCard = ({ restaurant, onClick }) => {
  const themeColor = getRestaurantTheme(restaurant.name);

  return (
    <div
      onClick={onClick}
      className="relative flex flex-col items-center cursor-pointer group transition-all duration-300 py-6"
    >
      <div className="relative w-32 h-32 mb-4">
        {/* Animated African pattern ring */}
        <div 
          className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{
            background: `repeating-linear-gradient(
              0deg,
              ${themeColor}15,
              ${themeColor}15 2px,
              transparent 2px,
              transparent 8px
            ),
            repeating-linear-gradient(
              90deg,
              ${themeColor}15,
              ${themeColor}15 2px,
              transparent 2px,
              transparent 8px
            )`,
            animation: 'patternShift 2s linear infinite'
          }}
        />
        
        {/* Subtle glow effect on hover */}
        <div 
          className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{
            boxShadow: `0 0 30px ${themeColor}40`,
            background: `radial-gradient(circle, ${themeColor}20 0%, transparent 70%)`
          }}
        />
        
        {/* Restaurant image circle with elegant border */}
        <div className="relative w-full h-full rounded-full overflow-hidden border-2 transition-all duration-500 group-hover:scale-105" style={{
          borderColor: `${themeColor}30`
        }}>
          <img
            src={restaurant.logo}
            alt={restaurant.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        </div>
        
        {/* Subtle ring indicator */}
        <div 
          className="absolute inset-0 rounded-full pointer-events-none transition-all duration-500"
          style={{
            border: `2px solid ${themeColor}`,
            opacity: '0',
            transform: 'scale(1.1)',
            boxShadow: `0 0 20px ${themeColor}30`
          }}
        />
      </div>
      
      {/* Elegant typography for restaurant name */}
      <h3 
        className="text-lg font-serif font-medium text-text-primary text-center mb-1 transition-colors duration-300 group-hover:text-accent-primary"
        style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
      >
        {restaurant.name}
      </h3>
      
      <div className="flex items-center gap-2 text-sm text-text-secondary">
        <Star size={12} fill="currentColor" style={{ color: themeColor }} />
        <span className="font-mono">{restaurant.rating}</span>
        <span className="text-text-secondary mx-1">•</span>
        <Clock size={12} className="text-text-secondary" strokeWidth={1.5} />
        <span className="font-mono">{restaurant.deliveryTime}</span>
      </div>

      {restaurant.promo && (
        <div className="mt-2 px-3 py-1 rounded-full text-xs font-medium transition-all duration-300 group-hover:scale-105" style={{
          backgroundColor: `${themeColor}20`,
          color: themeColor
        }}>
          {restaurant.promo}
        </div>
      )}
    </div>
  );
};

export default RestaurantCard;
