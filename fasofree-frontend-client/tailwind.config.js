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
          primary: '#F5F6F1',
          secondary: '#EEF0E9',
          tertiary: '#E2E7D8',
          card: '#FFFFFF',
        },
        text: {
          primary: '#181A12',
          secondary: '#383D31',
          tertiary: '#51564A',
          muted: '#51564A',
        },
        border: {
          light: '#DCE0D4',
          subtle: '#DCE0D4',
          medium: '#BAC1AD',
          dark: '#777F68',
        },
        accent: {
          primary: 'rgb(var(--kw-brand-rgb) / <alpha-value>)',
          secondary: '#617427',
          muted: '#4C5B2D',
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
        sans: ['Instrument Sans', 'system-ui', 'sans-serif'],
        display: ['Manrope', 'system-ui', 'sans-serif'],
        body: ['Instrument Sans', 'system-ui', 'sans-serif'],
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
        'subtle': '0 8px 24px rgba(77, 53, 35, 0.07)',
        'medium': '0 14px 34px rgba(77, 53, 35, 0.10)',
        'elevated': '0 20px 48px rgba(77, 53, 35, 0.13)',
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
