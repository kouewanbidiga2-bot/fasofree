import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const restaurantColors = {
  cesar: '#B5502E',
  chitir: '#7A2E1A',
  gusto: '#5C6B3C',
  belchiken: '#B8862E',
  default: '#d79a4b' // FasoFree brass
};

export const ThemeProvider = ({ children }) => {
  const [activeRestaurant, setActiveRestaurant] = useState(null);
  
  // Computed theme color based on active restaurant
  const themeColor = activeRestaurant 
    ? (restaurantColors[activeRestaurant.toLowerCase()] || restaurantColors.default) 
    : restaurantColors.default;

  return (
    <ThemeContext.Provider value={{ activeRestaurant, setActiveRestaurant, themeColor }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
