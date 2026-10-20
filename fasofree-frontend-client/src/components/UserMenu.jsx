import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
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
  BUSINESS_ADMIN: 'https://admin.fasofree.site',
  DRIVER: 'https://admin.fasofree.site/livreur',
  COURIER: 'https://admin.fasofree.site/livreur',
  SUPER_ADMIN: '/',
  ADMIN: '/',
  SUPPORT: '/',
};

// Menu utilisateur — Radix DropdownMenu (primitif headless) : apporte la
// navigation clavier (flèches), la fermeture Échap et le retour de focus,
// SANS changer le visuel (classes tokens FasoFree d'origine conservées).
export default function UserMenu() {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuthStore();
  const [open, setOpen] = useState(false);

  if (!isAuthenticated || !user) return null;

  const currentRole = (user.role || 'CLIENT').toUpperCase();
  const displayName = user.firstName || user.fullName || user.email || 'Compte';
  const initials = displayName.slice(0, 1).toUpperCase();

  // Les classes des items sont celles des anciens <button> : on ajoute
  // uniquement cursor-pointer (les div de Radix n'ont pas le curseur
  // natif des boutons) et outline-none (focus clavier sans cadre).
  const itemClass =
    'flex w-full items-center gap-3 px-4 py-2.5 text-sm text-text-primary hover:bg-background-secondary transition-colors cursor-pointer outline-none';

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild>
        <button
          className="flex items-center gap-2 rounded-full border border-border-light bg-background-card px-3 py-2 text-sm font-semibold text-text-primary shadow-subtle transition hover:border-accent-primary"
        >
          <span
            className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white"
            style={{ background: '#C1652E' }}
          >
            {initials}
          </span>
          <span className="hidden sm:inline max-w-[100px] truncate">{displayName}</span>
          <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          sideOffset={8}
          align="end"
          className="z-50 w-56 rounded-xl border border-border-light bg-background-card py-2 shadow-elevated outline-none"
          style={{ animation: 'fadeIn 0.15s ease-out' }}
        >
          <div className="border-b border-border-light px-4 py-3">
            <p className="text-sm font-semibold text-text-primary truncate">{displayName}</p>
            <p className="text-xs text-text-secondary mt-0.5">{user.email}</p>
            <span
              className="mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white"
              style={{ background: '#C1652E' }}
            >
              {ROLE_LABELS[currentRole] || currentRole}
            </span>
          </div>

          {/* Radix ferme le menu automatiquement après chaque sélection. */}
          <DropdownMenu.Item
            onSelect={() => navigate('/profile')}
            className={itemClass}
          >
            <User size={15} /> Mon Profil
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={() => navigate('/order-history')}
            className={itemClass}
          >
            <History size={15} /> Mes Commandes
          </DropdownMenu.Item>

          {currentRole === 'CLIENT' && (
            <DropdownMenu.Item
              onSelect={() => navigate('/register?pro=1')}
              className={itemClass}
            >
              <Briefcase size={15} /> Espace Pro
            </DropdownMenu.Item>
          )}

          {(currentRole === 'DRIVER' || currentRole === 'COURIER') && (
            <DropdownMenu.Item asChild>
              <a
                href="https://admin.fasofree.site/livreur"
                target="_blank"
                rel="noopener noreferrer"
                className={itemClass}
              >
                <ShoppingBag size={15} /> Espace Livreur
              </a>
            </DropdownMenu.Item>
          )}

          {currentRole === 'BUSINESS_ADMIN' && (
            <DropdownMenu.Item asChild>
              <a
                href="https://admin.fasofree.site"
                target="_blank"
                rel="noopener noreferrer"
                className={itemClass}
              >
                <Briefcase size={15} /> Espace Marchand
              </a>
            </DropdownMenu.Item>
          )}

          <div className="my-1 border-t border-border-light" />

          <DropdownMenu.Item
            onSelect={() => {
              logout();
              navigate('/');
            }}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-error hover:bg-background-secondary transition-colors cursor-pointer outline-none"
          >
            <LogOut size={15} /> Déconnexion
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
