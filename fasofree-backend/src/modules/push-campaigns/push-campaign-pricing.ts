/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { PushCampaignAudience } from './entities/push-campaign.entity';

/**
 * 💳 Tarifs des campagnes push AUTO-SERVICE (FCFA par envoi).
 *
 * ⚠️ POURQUOI UN MODULE DÉDIÉ (et non des constantes dans le service) :
 * les tarifs sont modifiables par le SUPER_ADMIN depuis « Paramètres de la
 * plateforme » (`system_settings.pushCampaignPricing`). Or le service de
 * réglages et le service de campagnes ne peuvent pas s'importer mutuellement
 * sans créer un cycle. On reproduit donc le motif éprouvé de
 * `DeliveryPricingService.tiersFromDB` : un cache STATIQUE, alimenté par
 * `SettingsService.syncStaticCaches()` (au boot + après chaque sauvegarde),
 * lu sans requête par `PushCampaignService`.
 */

/** Tarif de repli quand aucun tarif n'est résolu (base historique : 100 F). */
export const PUSH_CAMPAIGN_BASE_PRICE_XOF = 100;

/**
 * Grille par défaut : identique à la colonne `pushCampaignPricing` de
 * `system_settings` (sinon un redémarrage sur base vierge changerait la
 * facturation).
 *
 * ⚠️ `ALL_CLIENTS` est volontairement BEAUCOUP plus cher : viser toute la base
 * client FasoFree pour 100 F rendrait le spam rentable. C'est une audience
 * « premium », pas une audience normale.
 */
export const PUSH_CAMPAIGN_PRICE_DEFAULTS: Record<string, number> = {
  [PushCampaignAudience.OWN_CLIENTS]: 100,
  [PushCampaignAudience.OWN_DRIVERS]: 100,
  [PushCampaignAudience.ALL_CLIENTS]: 2500,
};

/** Cache lu par `PushCampaignService` (précédence : dashboard > env > défauts). */
export const pushCampaignPriceCache: Record<string, number> = {
  ...PUSH_CAMPAIGN_PRICE_DEFAULTS,
};

/** Un tarif utilisable est un entier fini et positif ou nul (0 = gratuit). */
const isValidPrice = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

/**
 * Applique la grille enregistrée par le SUPER_ADMIN.
 *
 * On part TOUJOURS des défauts : une grille partielle (clé absente, valeur
 * invalide, réglage jamais enregistré) ne doit jamais pouvoir rendre une
 * audience GRATUITE par accident.
 */
export function applyPushCampaignPricing(raw: unknown): void {
  const next: Record<string, number> = { ...PUSH_CAMPAIGN_PRICE_DEFAULTS };
  if (raw && typeof raw === 'object') {
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      const parsed = typeof value === 'string' ? Number(value) : value;
      if (isValidPrice(parsed)) next[key] = parsed;
    }
  }
  for (const key of Object.keys(pushCampaignPriceCache)) {
    delete pushCampaignPriceCache[key];
  }
  Object.assign(pushCampaignPriceCache, next);
}

/**
 * Tarif d'une audience, en FCFA, PAR ENVOI (jamais par destinataire).
 *
 * Précédence : grille du dashboard → `PUSH_CAMPAIGN_UNIT_PRICE_FCFA` (repli
 * dev/tests) → défaut de l'audience → 100 F.
 */
export function resolvePushCampaignPrice(
  audience: PushCampaignAudience | string | null | undefined,
  envFallback?: unknown,
): number {
  const key = audience ?? null;
  const fromCache = key ? pushCampaignPriceCache[key] : undefined;
  if (isValidPrice(fromCache)) return fromCache;

  const envValue =
    typeof envFallback === 'string' ? Number(envFallback) : envFallback;
  if (isValidPrice(envValue)) return envValue;

  const fallback = key ? PUSH_CAMPAIGN_PRICE_DEFAULTS[key] : undefined;
  return isValidPrice(fallback) ? fallback : PUSH_CAMPAIGN_BASE_PRICE_XOF;
}

/** Grille complète (pour l'exposer aux interfaces avant création). */
export function pushCampaignPricingTable(): Record<string, number> {
  return { ...pushCampaignPriceCache };
}
