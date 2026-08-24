import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, ShoppingBag, History, Briefcase, LogOut, ChevronDown } from 'lucide-react';
import useAuthStore from '../store/authStore';

const ROLE_LABELS = {
  CLIENT: 'Client',
  BUSINESS_ADMIN: 'Commerçant',
  DRIVER: 'Livreur',
  COURIER: 'Coursier',
  SUPER_ADMIN: 'Administrateur',
  ADMIN: 'Administrateur',
  SUPPORT: 'Support',
};

const ROLE_ROUTES = {
  CLIENT: '/',
  BUSINESS_ADMIN: '/merchant-dashboard',
  DRIVER: 'https://admin.fasofree.site/livreur',
  COURIER: 'https://admin.fasofree.site/livreur',
  SUPER_ADMIN: '/',
  ADMIN: '/',
  SUPPORT: '/',
};

export default function UserMenu() {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuthStore();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!isAuthenticated || !user) return null;

  const currentRole = (user.role || 'CLIENT').toUpperCase();
  const displayName = user.firstName || user.fullName || user.email || 'Compte';
  const initials = displayName.slice(0, 1).toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-full border border-border-light bg-white px-3 py-2 text-sm font-semibold text-text-primary shadow-subtle transition hover:border-accent-primary"
      >
        <span
          className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white"
          style={{ background: '#B95B2B' }}
        >
          {initials}
        </span>
        <span className="hidden sm:inline max-w-[100px] truncate">{displayName}</span>
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-border-light bg-white py-2 shadow-elevated"
          style={{ animation: 'fadeIn 0.15s ease-out' }}
        >
          <div className="border-b border-border-light px-4 py-3">
            <p className="text-sm font-semibold text-text-primary truncate">{displayName}</p>
            <p className="text-xs text-text-secondary mt-0.5">{user.email}</p>
            <span
              className="mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white"
              style={{ background: '#B95B2B' }}
            >
              {ROLE_LABELS[currentRole] || currentRole}
            </span>
          </div>

          <button
            onClick={() => { setOpen(false); navigate('/profile'); }}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-text-primary hover:bg-background-secondary transition-colors"
          >
            <User size={15} /> Mon Profil
          </button>
          <button
            onClick={() => { setOpen(false); navigate('/order-history'); }}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-text-primary hover:bg-background-secondary transition-colors"
          >
            <History size={15} /> Mes Commandes
          </button>

          {currentRole === 'CLIENT' && (
            <button
              onClick={() => { setOpen(false); navigate('/register?pro=1'); }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-text-primary hover:bg-background-secondary transition-colors"
            >
              <Briefcase size={15} /> Espace Pro
            </button>
          )}

          {(currentRole === 'DRIVER' || currentRole === 'COURIER') && (
            <a
              href="https://admin.fasofree.site/livreur"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-text-primary hover:bg-background-secondary transition-colors"
            >
              <ShoppingBag size={15} /> Espace Livreur
            </a>
          )}

          {currentRole === 'BUSINESS_ADMIN' && (
            <button
              onClick={() => { setOpen(false); navigate('/merchant-dashboard'); }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-text-primary hover:bg-background-secondary transition-colors"
            >
              <Briefcase size={15} /> Espace Marchand
            </button>
          )}

          <div className="my-1 border-t border-border-light" />

          <button
            onClick={() => { setOpen(false); logout(); navigate('/'); }}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-error hover:bg-background-secondary transition-colors"
          >
            <LogOut size={15} /> Déconnexion
          </button>
        </div>
      )}
    </div>
  );
}
