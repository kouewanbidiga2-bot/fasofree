/**
 * Copyright (c) 2026 BIDIGA Imrane - Koliwa. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: {
          primary: '#E8F6BD',
          secondary: '#DCECAA',
          tertiary: '#C9E294',
          card: '#F7FCE2',
        },
        text: {
          primary: '#1D2A11',
          secondary: '#3F5028',
          tertiary: '#4A5B31',
          muted: '#4A5B31',
        },
        border: {
          light: '#B7D07F',
          subtle: '#B7D07F',
          medium: '#9FBD66',
          dark: '#5C7434',
        },
        accent: {
          primary: 'rgb(var(--kw-brand-rgb) / <alpha-value>)',
          secondary: '#4D6A1C',
          muted: '#3A5213',
        },
        // Status colors
        success: '#4D6A1C',
        warning: '#A87A22',
        error: '#A94A28',
        info: '#4E6A52',
        // Namespace `status-*` (utilisé par Badge, Input, P2PDelivery...)
        status: {
          success: '#4D6A1C',
          warning: '#A87A22',
          error: '#A94A28',
          info: '#4E6A52',
        },
      },
      fontFamily: {
        sans: ['Geist', 'system-ui', 'sans-serif'],
        display: ['Bricolage Grotesque', 'system-ui', 'sans-serif'],
        body: ['Geist', 'system-ui', 'sans-serif'],
        serif: ['Georgia', 'serif'],
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
        'subtle': '0 8px 24px rgba(40, 58, 24, 0.08)',
        'medium': '0 14px 34px rgba(40, 58, 24, 0.11)',
        'elevated': '0 20px 48px rgba(40, 58, 24, 0.14)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'slide-down': 'slideDown 0.4s ease-out',
        'scale-in': 'scaleIn 0.3s ease-out',
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
      },
    },
  },
  plugins: [],
}
