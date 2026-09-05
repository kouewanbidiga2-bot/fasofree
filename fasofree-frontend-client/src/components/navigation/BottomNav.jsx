import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Search, ShoppingCart, ClipboardList, User } from 'lucide-react';
import useCartStore from '../../store/cartStore';
import useAuthStore from '../../store/authStore';
import { useLanguage } from '../../contexts/LanguageContext';

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuthStore();
  const { t } = useLanguage();
  const cartItems = useCartStore((s) => s.items);
  const cartCount = cartItems.reduce((n, i) => n + (i.quantity || 1), 0);

  const tabs = [
    { key: 'home', label: t('home'), icon: Home, path: '/' },
    { key: 'search', label: t('search'), icon: Search, path: '/search' },
    { key: 'cart', label: t('cart'), icon: ShoppingCart, path: '/cart' },
    { key: 'orders', label: t('orders'), icon: ClipboardList, path: '/order-history' },
    { key: 'profile', label: t('profile'), icon: User, path: '/profile' },
  ];

  const currentPath = location.pathname;

  const isActive = (tab) => {
    if (tab.key === 'home') return currentPath === '/';
    if (tab.key === 'cart') return currentPath === '/cart' || currentPath === '/checkout';
    if (tab.key === 'orders') return currentPath === '/order-history' || currentPath.startsWith('/order-tracking');
    if (tab.key === 'profile') return currentPath === '/profile' || currentPath === '/vip-pass';
    if (tab.key === 'search') return false;
    return currentPath === tab.path;
  };

  const handleTap = (tab) => {
    if (tab.key === 'cart' || tab.key === 'orders' || tab.key === 'profile') {
      if (!isAuthenticated) {
        navigate('/auth');
        return;
      }
    }
    navigate(tab.path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background-primary border-t border-border-light safe-area-bottom md:hidden">
      <div className="flex items-center justify-around h-16 px-2">
        {tabs.map((tab) => {
          const active = isActive(tab);
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => handleTap(tab)}
              className="flex flex-col items-center gap-0.5 py-1 px-3 relative"
              aria-label={tab.label}
            >
              <div className="relative">
                <Icon
                  size={22}
                  strokeWidth={active ? 2.2 : 1.6}
                  className={`transition-colors duration-200 ${
                    active ? 'text-[#C1652E]' : 'text-[#a09388]'
                  }`}
                />
                {tab.key === 'cart' && cartCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 w-4 h-4 rounded-full bg-[#C1652E] text-white text-[9px] font-bold flex items-center justify-center">
                    {cartCount > 9 ? '9+' : cartCount}
                  </span>
                )}
              </div>
              <span
                className={`text-[10px] font-medium transition-colors duration-200 ${
                  active ? 'text-[#C1652E]' : 'text-[#a09388]'
                }`}
              >
                {tab.label}
              </span>
              {active && (
                <div className="absolute -bottom-0.5 w-5 h-[2px] rounded-full bg-[#C1652E]" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
