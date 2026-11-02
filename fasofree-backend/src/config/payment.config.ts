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
 * URL de base de l'API marchand GenesysPay (ex-GeniusPay).
 *
 * L'hôte est centralisé ici : le dashboard est sur `www.genesyspay.com` mais
 * l'API marchand peut être servie sur un sous-domaine différent. La variable
 * `GENIUSPAY_BASE_URL` permet de corriger l'URL sans redéployer le code.
 */
export function resolveGeniusPayBaseUrl(configService: ConfigService): string {
  const explicit = configService.get<string>('GENIUSPAY_BASE_URL');
  if (explicit?.trim()) {
    return explicit.trim().replace(/\/+$/, '');
  }

  const paymentEnv = configService.get<string>('PAYMENT_ENV', 'production');
  return paymentEnv === 'sandbox'
    ? 'https://www.genesyspay.com/sandbox'
    : 'https://www.genesyspay.com/api/v1/merchant';
}

