/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // FasoFree Design System - warm, food-first editorial palette
        background: {
          primary: '#FBF8F3',
          secondary: '#F4EEE5',
          tertiary: '#ECE2D4',
          card: '#FFFDFC',
        },
        text: {
          primary: '#29231E',
          secondary: '#74695F',
          tertiary: '#5E554D',
          muted: '#4C443D',
        },
        border: {
          light: '#E9E0D5',
          medium: '#D8CDBF',
          dark: '#C4B7A8',
        },
        // Global accent - terracotta
        accent: {
          primary: '#B95B2B',
          secondary: '#D17843',
          muted: '#91461F',
        },
        // Restaurant-specific colors
        restaurant: {
          cesar: '#B5502E',
          chitir: '#7A2E1A',
          gusto: '#5C6B3C',
          belchiken: '#B8862E'
        },
        // Status colors
        success: '#5C6B3C',
        warning: '#B8862E',
        error: '#B5502E',
        info: '#5C6B7A',
        // Namespace `status-*` (utilisé par Badge, Input, P2PDelivery...)
        status: {
          success: '#5C6B3C',
          warning: '#B8862E',
          error: '#B5502E',
          info: '#5C6B7A',
        },
      },
      fontFamily: {
        sans: ['Nexa', 'Manrope', 'system-ui', 'sans-serif'],
        display: ['Manrope', 'sans-serif'],
        body: ['Nexa', 'Manrope', 'sans-serif'],
        serif: ['Playfair Display', 'Georgia', 'serif'],
        mono: ['IBM Plex Mono', 'monospace'],
      },
      spacing: {
        '1': '4px',
        '2': '8px',
        '3': '12px',
        '4': '16px',
        '5': '20px',
        '6': '24px',
        '8': '32px',
        '10': '40px',
        '12': '48px',
        '16': '64px',
      },
      borderRadius: {
        'none': '0px',
        'sm': '0',
        'DEFAULT': '8px',
        'md': '10px',
        'lg': '14px',
        'xl': '18px',
        '2xl': '24px',
        '3xl': '30px',
        'full': '9999px',
        'photo': '14px',
        'img': '10px',
      },
      boxShadow: {
        'subtle': '0 8px 24px rgba(77, 53, 35, 0.07)',
        'medium': '0 14px 34px rgba(77, 53, 35, 0.10)',
        'elevated': '0 20px 48px rgba(77, 53, 35, 0.13)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'slide-down': 'slideDown 0.4s ease-out',
        'scale-in': 'scaleIn 0.3s ease-out',
        'cart-pop': 'cartPop 0.35s ease',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        patternShift: {
          '0%': { backgroundPosition: '0 0' },
          '100%': { backgroundPosition: '20px 20px' },
        },
        cartPop: {
          '0%': { transform: 'scale(0.8)' },
          '50%': { transform: 'scale(1.2)' },
          '100%': { transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
}
