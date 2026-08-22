import { ConfigService } from '@nestjs/config';

/**
 * Providers de paiement supportés par FasoFree.
 * - `mock`     : simulateur de paiement (aucune clé requise, crédit immédiat du wallet)
 * - `ligdicash`: Orange Money / Moov Money via LigdiCash
 * - `cinetpay` : passerelle CinetPay
 * - `wave`     : Wave Mobile Money
 * - `yengapay` : Mobile Money via YengaPay (Orange, Moov, Telecel, Coris, Sank)
 */
export type PaymentProvider = 'mock' | 'ligdicash' | 'cinetpay' | 'wave' | 'yengapay';

export const PAYMENT_PROVIDER_KEY = 'PAYMENT_PROVIDER';

/**
 * Résout le provider de paiement actif.
 * 1. `PAYMENT_PROVIDER` explicite (mock | ligdicash | cinetpay | wave | yengapay) gagne.
 * 2. Si YENGAPAY_API_KEY est défini → `yengapay`.
 * 3. En dev, si les clés LigdiCash ne sont PAS renseignées (placeholders), on
 *    bascule automatiquement sur `mock` pour ne jamais bloquer les tests.
 * 4. Sinon, le provider réel par défaut est LigdiCash.
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

  // YengaPay si les clés sont présentes
  const yengaKey = configService.get<string>('YENGAPAY_API_KEY', '');
  if (yengaKey && !yengaKey.includes('votre_') && !yengaKey.includes('replace_')) {
    return 'yengapay';
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
