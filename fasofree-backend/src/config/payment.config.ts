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
