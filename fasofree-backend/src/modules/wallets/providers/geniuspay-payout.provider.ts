import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface PayoutTransferResult {
  success: boolean;
  message: string;
  providerReference?: string;
}

/**
 * Provider de retrait (payout) — GeniusPay uniquement.
 * Envoie le virement Mobile Money (Orange Money / Moov Money / Wave) vers le
 * numéro du bénéficiaire via l'API GeniusPay.
 *
 * Anciennement `CinetPayPayoutProvider` (nom historique de l'époque
 * multi-providers) : renommé et réécrit pour GeniusPay seul.
 */
@Injectable()
export class GeniusPayPayoutProvider {
  private readonly logger = new Logger(GeniusPayPayoutProvider.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly apiSecret: string;

  constructor(private readonly configService: ConfigService) {
    const paymentEnv = this.configService.get<string>('PAYMENT_ENV', 'production');
    this.baseUrl =
      paymentEnv === 'sandbox'
        ? 'https://pay.genius.ci/sandbox/api/v1/merchant'
        : 'https://pay.genius.ci/api/v1/merchant';
    this.apiKey = this.configService.get<string>('GENIUSPAY_API_KEY', '');
    this.apiSecret = this.configService.get<string>('GENIUSPAY_API_SECRET', '');
  }

  private get headers() {
    return {
      'X-API-Key': this.apiKey,
      'X-API-Secret': this.apiSecret,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Envoie un virement Mobile Money vers le numéro du bénéficiaire.
   * @param reference  Référence interne (payoutReference du PayoutsService)
   * @param amountFcfa Montant net à virer (après frais)
   * @param phoneNumber Numéro Mobile Money du bénéficiaire
   * @param provider   Opérateur cible (orange_money, moov_money, wave…)
   */
  async sendTransfer(
    reference: string,
    amountFcfa: number,
    phoneNumber: string,
    provider: string,
  ): Promise<PayoutTransferResult> {
    if (!this.apiKey || !this.apiSecret) {
      this.logger.error(
        '❌ Clés API GeniusPay non configurées — virement impossible (fail-closed)',
      );
      return {
        success: false,
        message:
          "GeniusPay n'est pas configuré — le retrait a été annulé et le montant recrédité.",
      };
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/payouts`,
        {
          reference,
          amount: amountFcfa,
          currency: 'XOF',
          payment_method: provider,
          customer: { phone_number: phoneNumber },
        },
        {
          headers: this.headers,
          timeout: 30_000,
        },
      );

      const data = response.data?.data ?? response.data;
      this.logger.log(
        `✅ Virement GeniusPay envoyé — ref ${reference} | ${amountFcfa} FCFA → ${phoneNumber} (${provider})`,
      );

      return {
        success: true,
        message: 'Virement Mobile Money initié via GeniusPay',
        providerReference: data?.reference ?? reference,
      };
    } catch (error: any) {
      const errData = error?.response?.data;
      this.logger.error(
        `❌ GeniusPay payout error (ref ${reference}): ${error.message}`,
      );
      if (errData) {
        this.logger.error(`❌ GeniusPay payout response: ${JSON.stringify(errData)}`);
      }

      return {
        success: false,
        message:
          errData?.message ??
          error?.message ??
          'Échec du virement GeniusPay (erreur inconnue)',
      };
    }
  }
}
