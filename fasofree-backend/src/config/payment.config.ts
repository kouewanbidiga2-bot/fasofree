/**
 * Copyright (c) 2026 BIDIGA Imrane - Koliwa. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { ConfigService } from '@nestjs/config';

/**
 * URL de base de l'API SasPay (encaissements, retraits, soldes).
 * `SASPAY_BASE_URL` permet de surcharger l'URL sans redéployer le code.
 */
export function resolveSasPayBaseUrl(configService: ConfigService): string {
  const explicit = configService.get<string>('SASPAY_BASE_URL');
  if (explicit?.trim()) {
    return explicit.trim().replace(/\/+$/, '');
  }

  return 'https://api.saspay.me/api/v1';
}

/**
 * SasPay attend un code pays ISO2 exact (`BF`). Une valeur collée dans le
dashboard avec un espace, une casse mixte ou un libellé complet fait
réchouer l'appel en 400 ; on retombe donc sur `BF` si la valeur est invalide.
 */
export function resolveSasPayCountry(configService: ConfigService): string {
  const raw = configService.get<string>('SASPAY_COUNTRY')?.trim().toUpperCase() ?? '';
  return /^[A-Z]{2}$/.test(raw) ? raw : 'BF';
}
