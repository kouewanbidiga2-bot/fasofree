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
        // FasoFree Design System — Dark Mode Premium
        background: {
          primary: '#0D0D0D',
          secondary: '#161616',
          tertiary: '#1E1E1E',
          card: '#1A1A1A',
          glass: 'rgba(26,26,26,0.85)',
        },
        text: {
          primary: '#F0EDE8',
          secondary: '#A09890',
          tertiary: '#6B6359',
          muted: '#4A4540',
        },
        border: {
          light: '#2A2520',
          medium: '#3A3530',
          dark: '#4A4540',
          accent: '#C1652E',
        },
        // Accent terracotta FasoFree
        accent: {
          primary: '#C1652E',
          secondary: '#D9753E',
          muted: '#8C4520',
          glow: 'rgba(193,101,46,0.25)',
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
        'card': '12px',
      },
      boxShadow: {
        'glow': '0 0 20px rgba(193,101,46,0.25)',
        'glow-sm': '0 0 10px rgba(193,101,46,0.15)',
        'card': '0 4px 24px rgba(0,0,0,0.4)',
        'card-hover': '0 8px 40px rgba(0,0,0,0.6)',
        'modal': '0 20px 60px rgba(0,0,0,0.8)',
        'inner': 'inset 0 1px 0 rgba(255,255,255,0.05)',
      },
      backdropBlur: {
        'glass': '16px',
      },
      animation: {
        'fade-in': 'fadeIn 0.35s ease-out',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16,1,0.3,1)',
        'slide-down': 'slideDown 0.4s cubic-bezier(0.16,1,0.3,1)',
        'scale-in': 'scaleIn 0.3s cubic-bezier(0.16,1,0.3,1)',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
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
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 10px rgba(193,101,46,0.2)' },
          '50%': { boxShadow: '0 0 30px rgba(193,101,46,0.5)' },
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
