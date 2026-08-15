import { ConfigService } from '@nestjs/config';

/**
 * 🧪 Providers de paiement supportés par FasoFree.
 * - `mock`     : simulateur de paiement (aucune clé requise, crédit immédiat du wallet)
 * - `ligdicash`: Orange Money / Moov Money via LigdiCash
 * - `cinetpay` : passerelle CinetPay
 * - `wave`     : Wave Mobile Money
 */
export type PaymentProvider = 'mock' | 'ligdicash' | 'cinetpay' | 'wave';

export const PAYMENT_PROVIDER_KEY = 'PAYMENT_PROVIDER';

/**
 * Résout le provider de paiement actif.
 * 1. `PAYMENT_PROVIDER` explicite (mock | ligdicash | cinetpay | wave) gagne.
 * 2. En dev, si les clés LigdiCash ne sont PAS renseignées (placeholders), on
 *    bascule automatiquement sur `mock` pour ne jamais bloquer les tests.
 * 3. Sinon, le provider réel par défaut est LigdiCash.
 */
export function resolvePaymentProvider(
  configService: ConfigService,
): PaymentProvider {
  const explicit = configService
    .get<string>(PAYMENT_PROVIDER_KEY)
    ?.trim()
    .toLowerCase();

  if (explicit) {
    return explicit as PaymentProvider;
  }

  const apiKey = configService.get<string>('LIGDICASH_API_KEY', '');
  const authToken = configService.get<string>('LIGDICASH_AUTH_TOKEN', '');
  const isPlaceholder = (v: string) =>
    !v || v.includes('votre_') || v.includes('replace_');

  if (!isPlaceholder(apiKey) && !isPlaceholder(authToken)) {
    return 'ligdicash';
  }

  return 'mock';
}

export function isMockProvider(configService: ConfigService): boolean {
  return resolvePaymentProvider(configService) === 'mock';
}
