/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
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
