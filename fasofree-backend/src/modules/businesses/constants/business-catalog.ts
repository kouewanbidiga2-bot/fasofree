/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { BusinessCategory } from '../entities/business.entity';

/**
 * 🏷️ Catalogue à DEUX niveaux des commerces.
 *
 * Niveau 1 — `category`    : la verticale (Restaurant, Épicerie, Pharmacie…)
 * Niveau 2 — `subCategory` : le type précis DANS la verticale
 *                            (Fast-Food, Cuisine Locale, Épicerie…)
 *
 * Pourquoi deux niveaux : le client filtrait sur `category` en l'affichant
 * comme un type de cuisine (« Fast-Food »), alors que la base stocke la
 * verticale (« RESTAURANT »). Le client envoyait donc une valeur qui
 * n'existait nulle part → filtre sans effet, mêmes commerces affichés.
 *
 * `enabledByDefault` pilote les interrupteurs du Super Admin : la pharmacie
 * est livrée ÉTEINTE, elle s'active « en temps voulu » sans redéploiement.
 */
export interface BusinessCategoryDefinition {
  value: BusinessCategory;
  label: string;
  enabledByDefault: boolean;
  subCategories: string[];
}

export const BUSINESS_CATALOG: BusinessCategoryDefinition[] = [
  {
    value: BusinessCategory.RESTAURANT,
    label: 'Restaurants',
    enabledByDefault: true,
    subCategories: [
      'Fast-Food',
      'Cuisine Locale',
      'Pâtisseries & Desserts',
      'Grillades',
      'Pizzas',
      'Boissons & Jus',
    ],
  },
  {
    value: BusinessCategory.SUPERMARKET,
    label: 'Supermarchés & Épiceries',
    enabledByDefault: true,
    // L'épicerie n'a PAS de sous-famille distincte : une seule valeur.
    subCategories: ['Épicerie'],
  },
  {
    value: BusinessCategory.BAKERY,
    label: 'Boulangeries',
    enabledByDefault: true,
    subCategories: ['Boulangerie & Viennoiserie'],
  },
  {
    value: BusinessCategory.RETAIL,
    label: 'Boutiques',
    enabledByDefault: true,
    subCategories: ['Boutique'],
  },
  {
    value: BusinessCategory.PHARMACY,
    label: 'Pharmacies',
    // ⛔ Livrée ÉTEINTE volontairement : à activer depuis le Super Admin.
    enabledByDefault: false,
    subCategories: ['Pharmacie'],
  },
  {
    value: BusinessCategory.SERVICES,
    label: 'Services',
    enabledByDefault: true,
    subCategories: ['Services'],
  },
];

/** Toutes les sous-catégories connues, toutes verticales confondues. */
export const ALL_SUB_CATEGORIES: string[] = Array.from(
  new Set(BUSINESS_CATALOG.flatMap((c) => c.subCategories)),
);

/** Toutes les valeurs de verticales connues (univers complet du catalogue). */
export const ALL_CATEGORY_VALUES: string[] = BUSINESS_CATALOG.map(
  (c) => c.value,
);

/** Verticales livrées ALLUMÉES (celles que `enabledByDefault` marque actives). */
export const DEFAULT_ENABLED_CATEGORIES: string[] = BUSINESS_CATALOG.filter(
  (c) => c.enabledByDefault,
).map((c) => c.value);

/**
 * 🎛️ Cache statique des verticales activées par le Super Admin.
 *
 * Même pattern que `DeliveryPricingService.tiersFromDB` : on évite une
 * requête base à chaque appel du catalogue client. Alimenté par
 * `SettingsService.syncStaticCaches()`.
 *
 * `null` = aucun réglage enregistré → on retombe sur `enabledByDefault`.
 */
export const BusinessCatalogCache: { enabledCategories: string[] | null } = {
  enabledCategories: null,
};

/**
 * Verticales actuellement activées.
 *
 * Si le réglage est absent OU vide, on retombe sur les valeurs par défaut :
 * une liste vide (toutes éteintes) laisserait le client sans aucun filtre,
 * ce qui n'est jamais un état souhaitable.
 */
export function getActiveCategoryValues(): string[] {
  const cached = BusinessCatalogCache.enabledCategories;
  return Array.isArray(cached) && cached.length > 0
    ? cached
    : DEFAULT_ENABLED_CATEGORIES;
}

/** Catalogue filtré sur les verticales actives (ce que voit le client). */
export function getActiveCatalog(): BusinessCategoryDefinition[] {
  const active = new Set(getActiveCategoryValues());
  return BUSINESS_CATALOG.filter((c) => active.has(c.value));
}

/** Sous-catégories valides pour une verticale donnée. */
export function subCategoriesFor(category: BusinessCategory): string[] {
  return BUSINESS_CATALOG.find((c) => c.value === category)?.subCategories ?? [];
}

/**
 * Vérifie qu'une sous-catégorie appartient bien à la verticale fournie.
 * Sans verticale connue, on accepte toute sous-catégorie du catalogue.
 */
export function isValidSubCategory(
  category: BusinessCategory | undefined,
  subCategory: string | undefined,
): boolean {
  if (!subCategory) return true;
  if (!category) return ALL_SUB_CATEGORIES.includes(subCategory);
  return subCategoriesFor(category).includes(subCategory);
}
