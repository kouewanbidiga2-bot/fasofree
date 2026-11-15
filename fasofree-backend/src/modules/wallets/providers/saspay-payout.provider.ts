/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { resolveSasPayBaseUrl } from '../../../config/payment.config';
import type { PayoutTransferResult } from './geniuspay-payout.provider';

const SASPAY_NETWORKS: Record<string, string> = {
  orange_money: 'orange_bf',
  moov_money: 'moov_bf',
  mtn_money: 'mtn_bf',
  wave: 'wave_bf',
};

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

  private get headers() {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
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

    const method = SASPAY_NETWORKS[String(provider).toLowerCase()];
    if (!method) {
      return { success: false, message: `Opérateur non supporté pour le virement: ${provider}` };
    }

    // Normaliser le numéro de téléphone (sans +)
    const msisdn = phoneNumber.replace(/^\+/, '');

    try {
      const response = await axios.post(
        `${this.baseUrl}/payouts/initialize/`,
        {
          amount: amountFcfa.toFixed(2),
          currency: 'XOF',
          country: this.country,
          customer: { phone: phoneNumber },
          method,
          recipient: { msisdn },
          description: 'Retrait FasoFree',
        },
        {
          headers: {
            ...this.headers,
            'Idempotency-Key': reference,
          },
          timeout: 30000,
        },
      );

      const d = response.data ?? {};
      this.logger.log(`✅ Virement SasPay accepté — ref ${reference} | ${amountFcfa} FCFA → ${phoneNumber} (${method})`);
      return {
        success: true,
        message: d.message ?? 'Virement Mobile Money initié via SasPay',
        providerReference: d.id ?? reference,
        transactionId: d.id,
      };
    } catch (error: any) {
      const errData = error?.response?.data;
      this.logger.error(
        `❌ SasPay payout error (ref ${reference}) HTTP ${error?.response?.status}: ${JSON.stringify(errData ?? error.message)}`,
      );
      return {
        success: false,
        message: errData?.message ?? errData?.error?.message ?? error?.message ?? 'Échec du virement SasPay',
      };
    }
  }
}
