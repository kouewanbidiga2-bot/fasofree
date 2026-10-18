import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export interface PayoutTransferResult {
  success: boolean;
  message: string;
  providerReference?: string;
  disburseToken?: string;
}

/**
 * Provider de retrait (payout) — PayDunya PER (Disburse v2).
 *
 * Utilise l'API v2 de décaissement PayDunya en 2 étapes :
 * 1. GET-INVOICE : crée un token de déboursement (disburse_token)
 * 2. SUBMIT-INVOICE : exécute le transfert vers le Mobile Money
 *
 * ⚠️ L'API v2 Disburse utilise TOUJOURS l'URL LIVE
 * (https://app.paydunya.com/api/v2/disburse/...), même en mode test.
 *
 * Mapping de nos providers vers les withdraw_mode PayDunya :
 * - ORANGE_MONEY / orange_money → 'orange-money-burkina'
 * - MOOV_MONEY / moov_money → 'moov-burkina-faso'
 * - WAVE / wave → 'wave-burkina'
 * - PAYDUNYA / paydunya → 'paydunya'
 */
@Injectable()
export class PaydunyaPayoutProvider {
  private readonly logger = new Logger(PaydunyaPayoutProvider.name);

  constructor(private readonly configService: ConfigService) {}

  private get mode(): string {
    return (this.configService.get<string>('PAYDUNYA_MODE') || 'live').toLowerCase();
  }

  private get masterKey(): string {
    return this.configService.get<string>('PAYDUNYA_MASTER_KEY') || '';
  }

  private get publicKey(): string {
    return this.configService.get<string>('PAYDUNYA_PUBLIC_KEY') || '';
  }

  private get privateKey(): string {
    return this.configService.get<string>('PAYDUNYA_PRIVATE_KEY') || '';
  }

  private get token(): string {
    return this.configService.get<string>('PAYDUNYA_TOKEN') || '';
  }

  private get backendUrl(): string {
    return this.configService.get<string>('BACKEND_URL') || 'https://fasofree-3nh8.onrender.com';
  }

  /**
   * Vérifie si PayDunya est configuré (4 clés requises)
   */
  isConfigured(): boolean {
    return Boolean(this.masterKey && this.publicKey && this.privateKey && this.token);
  }

  /**
   * Headers d'authentification PayDunya
   */
  private getHeaders(): Record<string, string> {
    if (!this.isConfigured()) {
      throw new BadRequestException('PayDunya non configuré sur le serveur.');
    }
    return {
      'Content-Type': 'application/json',
      'PAYDUNYA-MASTER-KEY': this.masterKey,
      'PAYDUNYA-PUBLIC-KEY': this.publicKey,
      'PAYDUNYA-PRIVATE-KEY': this.privateKey,
      'PAYDUNYA-TOKEN': this.token,
    };
  }

  /**
   * Mappe nos providers vers les withdraw_mode PayDunya.
   * Accepte les valeurs de l'enum PayoutProvider (ORANGE_MONEY, MOOV_MONEY, WAVE, TELECEL_MONEY)
   * et les strings normalisées (orange_money, moov_money, wave).
   */
  private mapWithdrawMode(provider: string): string {
    const normalized = provider.toLowerCase().replace(/_/g, '-');
    const map: Record<string, string> = {
      'orange-money': 'orange-money-burkina',
      'orange_money': 'orange-money-burkina',
      'orange_money_burkina': 'orange-money-burkina',
      'orange-money-burkina': 'orange-money-burkina',
      'moov-money': 'moov-burkina-faso',
      'moov_money': 'moov-burkina-faso',
      'moov_money_burkina': 'moov-burkina-faso',
      'moov-burkina-faso': 'moov-burkina-faso',
      'wave': 'wave-burkina',
      'wave-burkina': 'wave-burkina',
      'paydunya': 'paydunya',
    };
    return map[normalized] || 'orange-money-burkina'; // défaut
  }

  /**
   * Nettoie un numéro de téléphone pour PayDunya (sans +226 ni 00226, sans espaces)
   */
  private cleanPhone(phone: string): string {
    return phone
      .replace(/\s+/g, '')
      .replace(/^(\+226|00226)/, '');
  }

  /**
   * Vérifie la signature d'un webhook disburse PayDunya
   * Le hash reçu doit être égal à SHA512(PAYDUNYA_MASTER_KEY)
   */
  verifyDisburseSignature(receivedHash?: string): void {
    if (!receivedHash || !this.masterKey) {
      throw new BadRequestException('Signature disburse PayDunya manquante.');
    }

    const expectedHash = crypto
      .createHash('sha512')
      .update(this.masterKey)
      .digest('hex');

    if (receivedHash.toLowerCase() !== expectedHash.toLowerCase()) {
      this.logger.warn('Tentative de webhook disburse PayDunya avec un hash invalide !');
      throw new BadRequestException('Signature disburse PayDunya invalide.');
    }
  }

  /**
   * Exécute un payout PayDunya (PER) en 2 étapes.
   *
   * @param reference      Référence interne (ex: payoutReference du PayoutsService)
   * @param amountFcfa     Montant net à virer (entier FCFA, min 100)
   * @param phoneNumber    Numéro Mobile Money du bénéficiaire (ex: "70123456" sans +226)
   * @param provider       Opérateur cible (ORANGE_MONEY, MOOV_MONEY, WAVE, etc.)
   * @param withdrawId     ID de retrait interne (disburse_id pour PayDunya)
   */
  async executePayout(
    reference: string,
    amountFcfa: number,
    phoneNumber: string,
    provider: string,
    withdrawId: string,
  ): Promise<PayoutTransferResult> {
    const amount = Math.round(amountFcfa);
    if (amount < 100) {
      throw new BadRequestException('Le montant minimum de décaissement est de 100 FCFA.');
    }

    if (!this.isConfigured()) {
      this.logger.error('❌ PayDunya non configuré — virement impossible (fail-closed)');
      return {
        success: false,
        message: "PayDunya n'est pas configuré — le retrait a été annulé et le montant recrédité.",
      };
    }

    const cleanPhone = this.cleanPhone(phoneNumber);
    const withdrawMode = this.mapWithdrawMode(provider);

    try {
      // ÉTAPE A : Créer le token de déboursement (get-invoice) — URL v2 LIVE
      this.logger.log(`[PayDunya Payout] get-invoice: ${amount} FCFA → ${cleanPhone} (${withdrawMode}) ref ${reference}`);

      const getInvoiceRes = await fetch('https://app.paydunya.com/api/v2/disburse/get-invoice', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          account_alias: cleanPhone,
          amount: amount,
          withdraw_mode: withdrawMode,
          callback_url: `${this.backendUrl}/api/v1/paydunya/disburse-webhook`,
        }),
      });

      const getInvoiceData: any = await getInvoiceRes.json();

      if (getInvoiceData.response_code !== '00' || !getInvoiceData.disburse_token) {
        this.logger.error(`❌ Échec PayDunya get-invoice: ${JSON.stringify(getInvoiceData)}`);
        throw new BadRequestException(
          getInvoiceData.response_text || 'Erreur lors de la préparation du transfert Mobile Money.',
        );
      }

      const disburseToken = getInvoiceData.disburse_token;

      // ÉTAPE B : Exécuter le transfert (submit-invoice)
      this.logger.log(`[PayDunya Payout] submit-invoice: token ${disburseToken} withdrawId ${withdrawId}`);

      const submitRes = await fetch('https://app.paydunya.com/api/v2/disburse/submit-invoice', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          disburse_invoice: disburseToken,
          disburse_id: withdrawId,
        }),
      });

      const submitData: any = await submitRes.json();

      if (submitData.response_code !== '00') {
        this.logger.error(`❌ Échec PayDunya submit-invoice: ${JSON.stringify(submitData)}`);
        throw new BadRequestException(
          submitData.response_text || 'Le transfert Mobile Money a été rejeté par PayDunya.',
        );
      }

      this.logger.log(
        `✅ Virement PayDunya envoyé — ref ${reference} | ${amount} FCFA → ${cleanPhone} (${withdrawMode}) | providerRef: ${submitData.provider_ref}`,
      );

      return {
        success: true,
        message: 'Virement Mobile Money initié via PayDunya PER',
        providerReference: submitData.provider_ref ?? reference,
        disburseToken,
      };
    } catch (error: any) {
      if (error instanceof BadRequestException) throw error;

      this.logger.error(`❌ PayDunya payout error (ref ${reference}): ${error.message}`);
      return {
        success: false,
        message: error?.message ?? 'Échec du virement PayDunya (erreur inconnue)',
      };
    }
  }
}