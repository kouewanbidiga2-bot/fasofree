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
