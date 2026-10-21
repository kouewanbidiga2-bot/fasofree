/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // FasoFree Design System — Clair epure : fond craie chaude, cartes blanches,
        // terracotta dosee (CTA + data viz uniquement)
        background: {
          primary: '#FAF7F1',
          secondary: '#F5F1EA',
          tertiary: '#F2ECE2',
          card: '#FFFFFF',
          glass: 'rgba(255,255,255,0.85)',
        },
        text: {
          primary: '#29231E',
          secondary: '#6E6559',
          tertiary: '#9B9286',
          muted: '#B8B0A4',
        },
        border: {
          light: '#ECE6DD',
          medium: '#E0D8CB',
          dark: '#CFC5B6',
          accent: '#C1652E',
        },
        // Accent terracotta FasoFree
        accent: {
          primary: '#C1652E',
          secondary: '#D9753E',
          muted: '#A85526',
          glow: 'rgba(193,101,46,0.18)',
        },
        // Statuts
        status: {
          success: '#22C55E',
          successBg: 'rgba(34,197,94,0.12)',
          warning: '#F59E0B',
          warningBg: 'rgba(245,158,11,0.12)',
          error: '#EF4444',
          errorBg: 'rgba(239,68,68,0.12)',
          info: '#3B82F6',
          infoBg: 'rgba(59,130,246,0.12)',
        },
        // Paiements
        payment: {
          orange: '#FF6600',
          moov: '#0095D9',
          ligdi: '#00B388',
          cash: '#F59E0B',
        },
      },
      fontFamily: {
        sans: ['Manrope', 'system-ui', 'sans-serif'],
        display: ['Clash Display', 'Manrope', 'sans-serif'],
        body: ['Manrope', 'sans-serif'],
        mono: ['IBM Plex Mono', 'Fira Code', 'monospace'],
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
        '18': '72px',
        '20': '80px',
      },
      borderRadius: {
        'none': '0px',
        'sm': '4px',
        'DEFAULT': '6px',
        'md': '8px',
        'lg': '12px',
        'xl': '16px',
        '2xl': '20px',
        'full': '9999px',
        'photo': '8px',
        'card': '14px',
      },
      boxShadow: {
        // Ombres douces sur fond clair — plus de halo terracotta
        'glow': '0 1px 2px rgba(41,35,30,0.06)',
        'glow-sm': '0 1px 2px rgba(41,35,30,0.05)',
        'card': '0 1px 2px rgba(41,35,30,0.04), 0 4px 16px rgba(41,35,30,0.06)',
        'card-hover': '0 2px 4px rgba(41,35,30,0.06), 0 8px 28px rgba(41,35,30,0.10)',
        'modal': '0 24px 64px rgba(41,35,30,0.18)',
        'inner': 'inset 0 1px 0 rgba(255,255,255,0.6)',
      },
      backdropBlur: {
        'glass': '16px',
      },
      animation: {
        'fade-in': 'fadeIn 0.35s ease-out',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16,1,0.3,1)',
        'slide-down': 'slideDown 0.4s cubic-bezier(0.16,1,0.3,1)',
        'scale-in': 'scaleIn 0.3s cubic-bezier(0.16,1,0.3,1)',
        'spin-slow': 'spin 3s linear infinite',
        'shimmer': 'shimmer 1.5s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(24px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-24px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
}
