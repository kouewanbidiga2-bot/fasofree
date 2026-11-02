/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { ConfigService } from '@nestjs/config';

/**
 * Provider de paiement: GeniusPay uniquement
 */
export type PaymentProvider = 'geniuspay';

export const PAYMENT_PROVIDER_KEY = 'PAYMENT_PROVIDER';

/**
 * Résout le provider de paiement actif — toujours GeniusPay.
 */
export function resolvePaymentProvider(
  _configService: ConfigService,
): PaymentProvider {
  return 'geniuspay';
}

export function isMockProvider(_configService: ConfigService): boolean {
  return false;
}

/**
 * URL de base de l'API marchand GenesysPay.
 *
 * Documentation officielle : `https://genesyspay.com/api/v2`.
 * `GENIUSPAY_BASE_URL` permet de surcharger l'URL sans redéployer le code
 * (utile si GenesysPay change de domaine ou de version d'API).
 */
export function resolveGeniusPayBaseUrl(configService: ConfigService): string {
  const explicit = configService.get<string>('GENIUSPAY_BASE_URL');
  if (explicit?.trim()) {
    return explicit.trim().replace(/\/+$/, '');
  }

  return 'https://genesyspay.com/api/v2';
}

