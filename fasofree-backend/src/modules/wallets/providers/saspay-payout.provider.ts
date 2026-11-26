/**
 * Copyright (c) 2026 BIDIGA Imrane - Koliwa. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { resolveSasPayBaseUrl } from '../../../config/payment.config';
import { toSasPayNetwork } from '../../payments/providers/saspay.service';

export interface PayoutTransferResult {
  success: boolean;
  message: string;
  providerReference?: string;
  transactionId?: string;
}

/**
 * Virement Mobile Money via SasPay (`POST /payouts/initialize/`).
 * La réponse confirme l'acceptation ; le résultat réel arrive par le webhook
 * `transaction.success` / `transaction.failed` (type RETRAIT), réconcilié sur
 * `providerReference` = id du payout SasPay.
 */
@Injectable()
export class SasPayPayoutProvider {
  private readonly logger = new Logger(SasPayPayoutProvider.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly country: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = resolveSasPayBaseUrl(this.configService);
    this.apiKey = this.configService.get<string>('SASPAY_API_KEY', '');
    this.country = this.configService.get<string>('SASPAY_COUNTRY', 'BF');
  }

  async sendTransfer(
    reference: string,
    amountFcfa: number,
    phoneNumber: string,
    provider: string,
  ): Promise<PayoutTransferResult> {
    if (!this.apiKey) {
      this.logger.error('❌ SasPay non configuré — virement impossible (fail-closed)');
      return {
        success: false,
        message: "SasPay n'est pas configuré — le retrait a été annulé et le montant recrédité.",
      };
    }

    const method = toSasPayNetwork(provider);
    if (!method) {
      return { success: false, message: `Opérateur non supporté au Burkina Faso : ${provider}` };
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/payouts/initialize/`,
        {
          amount: amountFcfa.toFixed(2),
          currency: 'XOF',
          country: this.country,
          customer: { phone: phoneNumber },
          method,
          recipient: { msisdn: phoneNumber.replace(/^\+/, '') },
          description: 'Retrait Koliwa',
        },
        {
          // Idempotency-Key = notre référence : un retry réseau ne crée pas un second virement.
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': reference,
          },
          timeout: 30000,
        },
      );

      const d = response.data ?? {};
      if (!d.id) {
        return { success: false, message: 'Réponse SasPay sans identifiant de virement' };
      }
      this.logger.log(`✅ Virement SasPay accepté — ref ${reference} | ${amountFcfa} FCFA → ${phoneNumber} (${method})`);
      return {
        success: true,
        message: d.message ?? 'Virement Mobile Money initié via SasPay',
        providerReference: String(d.id),
        transactionId: String(d.id),
      };
    } catch (error: any) {
      const errData = error?.response?.data;
      this.logger.error(
        `❌ SasPay payout error (ref ${reference}) HTTP ${error?.response?.status}: ${JSON.stringify(errData ?? error.message)}`,
      );
      return {
        success: false,
        message: errData?.error?.message ?? errData?.message ?? error?.message ?? 'Échec du virement SasPay',
      };
    }
  }
}
