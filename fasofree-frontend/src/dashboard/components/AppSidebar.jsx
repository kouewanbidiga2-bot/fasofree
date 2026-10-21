/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

/**
 * FasoFree — Sidebar du back-office (refonte structure + identité).
 *
 * - Desktop : fixe à gauche, repliable en rail d'icônes (état persisté par le parent).
 * - Mobile : tiroir (drawer) ouvert depuis le hamburger du header (state du parent).
 * - Recherche pour filtrer les entrées.
 *
 * Haut : masque de marque + wordmark deux tons + label BACK-OFFICE.
 * Corps : sections groupées avec tuiles icônes, actif = pill neutre + liseré terracotta.
 * Pied : carte utilisateur + déconnexion.
 *
 * Aucune entrée n'est codée en dur : chaque dashboard passe ses `sections`.
 * Convention item : { id, label, icon, badge?, dot?, active?, onClick? }
 * — `onClick` absent → appel de `onSelect(id)` (onglet local).
 */
import React, { useMemo, useState } from 'react';
import { LogOut, Search, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { FasoFreeMask } from '../../components/FasoFreeLogo';

export function AppSidebar({
  sections = [],
  user,
  roleLabel = '',
  onSelect,
  onLogout,
  collapsed = false,
  onCollapsedChange,
  open = false,
  onOpenChange,
}) {
  const fullName = user?.fullName || user?.name || 'Admin';
  const initial = fullName.charAt(0).toUpperCase();
  const subtitle = roleLabel || user?.email || '';
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sections;
    return sections
      .map((s) => ({ ...s, items: s.items.filter((i) => i.label.toLowerCase().includes(q)) }))
      .filter((s) => s.items.length > 0);
  }, [sections, query]);

  const handleSelect = (item) => {
    if (item.onClick) item.onClick();
    else onSelect?.(item.id);
    // Sur mobile, la navigation ferme le tiroir.
    onOpenChange?.(false);
  };

  return (
    <>
      {/* Backdrop mobile */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          aria-hidden="true"
          onClick={() => onOpenChange?.(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-border-light bg-background-card transition-transform duration-200 lg:translate-x-0 lg:transition-[width] ${
          open ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        } ${collapsed ? 'w-[76px]' : 'w-64'}`}
      >
        {/* ── Identité de marque + repli ── */}
        <div
          className={`flex items-center border-b border-border-light ${
            collapsed ? 'justify-center px-3 py-4' : 'gap-3 px-4 py-4'
          }`}
        >
          <FasoFreeMask size={collapsed ? 34 : 36} />
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-text-primary font-extrabold text-[15px] leading-none tracking-[-0.02em]">
                Faso<span className="text-accent-primary">Free</span>
              </p>
              <p className="mt-1 font-mono text-[9px] tracking-[0.18em] text-text-tertiary">BACK-OFFICE</p>
            </div>
          )}
          {onCollapsedChange && (
            <button
              onClick={() => onCollapsedChange(!collapsed)}
              aria-label={collapsed ? 'Déplier la barre latérale' : 'Replier la barre latérale'}
              title={collapsed ? 'Déplier' : 'Replier'}
              className="hidden shrink-0 rounded-md p-1.5 text-text-tertiary transition-colors hover:bg-background-secondary hover:text-text-primary lg:flex"
            >
              {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            </button>
          )}
        </div>

        {/* ── Recherche (masquée en mode replié) ── */}
        {!collapsed && (
          <div className="px-3 pt-3">
            <div className="flex items-center gap-2 rounded-lg border border-border-light bg-background-secondary px-2.5 py-1.5">
              <Search size={14} className="shrink-0 text-text-tertiary" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher…"
                className="w-full bg-transparent text-[13px] text-text-primary placeholder:text-text-tertiary focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* ── Sections ── */}
        <nav className={`flex-1 space-y-3.5 overflow-y-auto ${collapsed ? 'px-2.5 py-3' : 'px-3 py-3'}`}>
          {filtered.length === 0 && <p className="px-2 text-xs text-text-tertiary">Aucun résultat</p>}
          {filtered.map((section) => (
            <div key={section.label}>
              {!collapsed && (
                <p className="px-2 pb-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                  {section.label}
                </p>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = Boolean(item.active);
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelect(item)}
                      title={collapsed ? item.label : undefined}
                      className={`relative flex w-full items-center rounded-lg transition-colors ${
                        collapsed ? 'justify-center px-0 py-1.5' : 'gap-2.5 px-2 py-1.5'
                      } ${active ? 'bg-background-tertiary' : 'hover:bg-background-secondary'}`}
                    >
                      {active && (
                        <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full bg-accent-primary" />
                      )}
                      <span
                        className={`relative flex shrink-0 items-center justify-center rounded-lg ${
                          collapsed ? 'h-8 w-8' : 'h-7 w-7'
                        } ${
                          active
                            ? 'bg-background-card shadow-[0_1px_2px_rgba(41,35,30,0.07)]'
                            : 'bg-background-tertiary'
                        }`}
                      >
                        {Icon && (
                          <Icon
                            size={15}
                            strokeWidth={1.6}
                            className={active ? 'text-accent-primary' : 'text-text-secondary'}
                          />
                        )}
                        {item.badge > 0 && collapsed && (
                          <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent-primary px-1 text-[9px] font-bold leading-none text-white">
                            {item.badge}
                          </span>
                        )}
                      </span>
                      {!collapsed && (
                        <>
                          <span
                            className={`min-w-0 flex-1 truncate text-left text-[13px] ${
                              active ? 'font-bold text-text-primary' : 'font-medium text-text-secondary'
                            }`}
                          >
                            {item.label}
                          </span>
                          {item.dot && <span className="h-2 w-2 shrink-0 rounded-full bg-status-success" />}
                          {item.badge > 0 && (
                            <span className="min-w-[20px] shrink-0 rounded-full bg-accent-primary px-1.5 py-[3px] text-center text-[10px] font-bold leading-none text-white">
                              {item.badge}
                            </span>
                          )}
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* ── Utilisateur + déconnexion ── */}
        <div className="border-t border-border-light p-2.5">
          <div
            className={`flex items-center rounded-xl border border-border-light bg-background-secondary ${
              collapsed ? 'justify-center p-2' : 'gap-2.5 px-2.5 py-2'
            }`}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-primary text-sm font-bold text-white">
              {initial}
            </span>
            {!collapsed && (
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-bold text-text-primary">{fullName}</span>
                <span className="mt-0.5 block truncate font-mono text-[9.5px] uppercase tracking-[0.08em] text-text-tertiary">
                  {subtitle}
                </span>
              </span>
            )}
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
    </>
  );
}

export default AppSidebar;
