/**
 * FasoFree — Sidebar du back-office (refonte structure + identité).
 *
 * Haut : masque de marque + wordmark deux tons + label BACK-OFFICE.
 * Corps : sections groupées (PILOTAGE / OPÉRATIONS / …) avec tuiles icônes,
 * état actif = pill neutre + liseré terracotta + tuile blanche.
 * Pied : carte utilisateur + déconnexion.
 *
 * Aucune entrée n'est codée en dur : chaque dashboard passe ses `sections`.
 * Convention item : { id, label, icon, badge?, dot?, active?, onClick? }
 * — `onClick` absent → appel de `onSelect(id)` (onglet local).
 */
import React from 'react';
import { LogOut } from 'lucide-react';
import { FasoFreeMask } from '../../components/FasoFreeLogo';

export function AppSidebar({ sections = [], user, roleLabel = '', onSelect, onLogout }) {
  const fullName = user?.fullName || user?.name || 'Admin';
  const initial = fullName.charAt(0).toUpperCase();
  const subtitle = roleLabel || user?.email || '';

  return (
    <aside className="hidden lg:flex flex-col w-64 bg-background-card border-r border-border-light fixed h-full z-20 overflow-y-auto">
      {/* ── Identité de marque ── */}
      <div className="px-5 pt-5 pb-4 border-b border-border-light">
        <div className="flex items-center gap-3">
          <FasoFreeMask size={38} />
          <div>
            <p className="text-text-primary font-extrabold text-[15.5px] leading-none tracking-[-0.02em]">
              Faso<span className="text-accent-primary">Free</span>
            </p>
            <p className="font-mono text-[9px] tracking-[0.18em] text-text-tertiary mt-1.5">
              BACK-OFFICE
            </p>
          </div>
        </div>
      </div>

      {/* ── Sections ── */}
      <nav className="flex-1 px-3 py-4 space-y-5">
        {sections.map((section) => (
          <div key={section.label}>
            <p className="px-2 pb-2 font-mono text-[9.5px] font-semibold tracking-[0.14em] text-text-tertiary uppercase">
              {section.label}
            </p>
            <div className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = Boolean(item.active);
                return (
                  <button
                    key={item.id}
                    onClick={() => (item.onClick ? item.onClick() : onSelect?.(item.id))}
                    className={`relative flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors ${
                      active ? 'bg-background-tertiary' : 'hover:bg-background-secondary'
                    }`}
                  >
                    {active && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-accent-primary" />
                    )}
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] ${
                        active
                          ? 'bg-background-card shadow-[0_1px_2px_rgba(41,35,30,0.07)]'
                          : 'bg-background-tertiary'
                      }`}
                    >
                      {Icon && (
                        <Icon
                          size={16}
                          strokeWidth={1.6}
                          className={active ? 'text-accent-primary' : 'text-text-secondary'}
                        />
                      )}
                    </span>
                    <span
                      className={`min-w-0 flex-1 truncate text-left ${
                        active ? 'font-bold text-text-primary' : 'font-medium text-text-secondary'
                      }`}
                    >
                      {item.label}
                    </span>
                    {item.dot && (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-status-success" />
                    )}
                    {item.badge > 0 && (
                      <span className="min-w-[22px] shrink-0 rounded-full bg-accent-primary px-1.5 py-[3px] text-center text-[10px] font-bold leading-none text-white">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* ── Utilisateur + déconnexion ── */}
      <div className="border-t border-border-light p-3">
        <div className="flex items-center gap-3 rounded-xl border border-border-light bg-background-secondary px-3 py-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-primary text-sm font-bold text-white">
            {initial}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-bold text-text-primary">{fullName}</span>
            <span className="mt-0.5 block truncate font-mono text-[9.5px] uppercase tracking-[0.08em] text-text-tertiary">
              {subtitle}
            </span>
          </span>
          <button
            onClick={onLogout}
            aria-label="Déconnexion"
            title="Déconnexion"
            className="shrink-0 rounded-md p-1.5 text-text-tertiary transition-colors hover:bg-status-errorBg hover:text-status-error"
          >
            <LogOut size={15} strokeWidth={1.7} />
          </button>
        </div>
      </div>
    </aside>
  );
}

export default AppSidebar;
