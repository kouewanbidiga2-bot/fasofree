/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { resolveGeniusPayBaseUrl } from '../../../config/payment.config';

export interface PayoutTransferResult {
  success: boolean;
  message: string;
  providerReference?: string;
  disburseToken?: string;
  transactionId?: string;
  providerRef?: string;
}

const PAYOUT_METHOD_SLUGS: Record<string, string> = {
  orange_money: 'orange-money-bf',
  moov_money: 'moov-money-bf',
  wave: 'wave-bf',
  mtn_money: 'mtn-bf',
};

@Injectable()
export class GeniusPayPayoutProvider {
  private readonly logger = new Logger(GeniusPayPayoutProvider.name);
  private readonly baseUrl: string;
  private readonly apiSecret: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = resolveGeniusPayBaseUrl(this.configService);
    this.apiSecret = this.configService.get<string>('GENIUSPAY_API_SECRET', '');
  }

  private get headers() {
    return {
      Authorization: `Bearer ${this.apiSecret}`,
      'Content-Type': 'application/json',
    };
  }

  async sendTransfer(
    reference: string,
    amountFcfa: number,
    phoneNumber: string,
    provider: string,
  ): Promise<PayoutTransferResult> {
    if (!this.apiSecret) {
      this.logger.error('❌ Clés API GenesysPay non configurées — virement impossible (fail-closed)');
      return {
        success: false,
        message: "GenesysPay n'est pas configuré — le retrait a été annulé et le montant recrédité.",
      };
    }

    const methodSlug = PAYOUT_METHOD_SLUGS[provider] ?? provider;
    const webhookUrl = this.configService.get<string>('APP_WEBHOOK_URL');
    const callbackUrl = webhookUrl
      ? `${webhookUrl.replace(/\/+$/, '')}/wallets/webhook/geniuspay`
      : undefined;

    try {
      const response = await axios.post(
        `${this.baseUrl}/payouts`,
        {
          amount: amountFcfa,
          currency: 'XOF',
          channel: 'mobile_money',
          method: methodSlug,
          phone_number: phoneNumber,
          tx_ref: reference,
          callback_url: callbackUrl,
        },
        {
          headers: this.headers,
          timeout: 30_000,
        },
      );

      const data = response.data?.data ?? response.data;
      const status = String(data?.status ?? response.data?.status ?? '').toUpperCase();
      const ok = response.data?.status === 'success' && status !== 'FAILED' && status !== 'CANCELLED';

      this.logger.log(
        `✅ Virement GenesysPay envoyé — ref ${reference} | ${amountFcfa} FCFA → ${phoneNumber} (${provider})`,
      );

      return {
        success: ok,
        message: ok ? 'Virement Mobile Money initié via GenesysPay' : (data?.message ?? 'Échec du virement'),
        providerReference: data?.transaction_id ?? data?.tx_ref ?? reference,
        transactionId: data?.transaction_id,
      };
    } catch (error: any) {
      const errData = error?.response?.data;
      this.logger.error(`❌ GenesysPay payout error (ref ${reference}): ${error.message}`);
      if (errData) {
        this.logger.error(`❌ GenesysPay payout response: ${JSON.stringify(errData)}`);
      }

      return {
        success: false,
        message:
          errData?.message ??
          error?.message ??
          'Échec du virement GenesysPay (erreur inconnue)',
      };
    }
  }
}
