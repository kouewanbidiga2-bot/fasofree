import { ConfigService } from '@nestjs/config';

/**
 * Providers de paiement supportés par FasoFree.
 * - `mock`     : simulateur de paiement (aucune clé requise, crédit immédiat du wallet)
 * - `ligdicash`: Orange Money / Moov Money via LigdiCash
 * - `cinetpay` : passerelle CinetPay
 * - `wave`     : Wave Mobile Money
 * - `yengapay` : Mobile Money via YengaPay (Orange, Moov, Telecel, Coris, Sank)
 */
export type PaymentProvider = 'mock' | 'ligdicash' | 'cinetpay' | 'wave' | 'yengapay' | 'paydunya';

export const PAYMENT_PROVIDER_KEY = 'PAYMENT_PROVIDER';

/**
 * Résout le provider de paiement actif.
 * 1. `PAYMENT_PROVIDER` explicite (mock | ligdicash | cinetpay | wave | yengapay | paydunya) gagne.
 * 2. Si PAYDUNYA_MASTER_KEY est défini → `paydunya`.
 * 3. Si YENGAPAY_API_KEY est défini → `yengapay`.
 * 4. En dev, si les clés LigdiCash ne sont PAS renseignées (placeholders), on
 *    bascule automatiquement sur `mock` pour ne jamais bloquer les tests.
 * 5. Sinon, le provider réel par défaut est LigdiCash.
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

  // PayDunya si les clés sont présentes
  const paydunyaKey = configService.get<string>('PAYDUNYA_MASTER_KEY', '');
  if (paydunyaKey && !paydunyaKey.includes('votre_') && !paydunyaKey.includes('replace_')) {
    return 'paydunya';
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
