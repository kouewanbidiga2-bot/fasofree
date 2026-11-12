/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { resolveJekoBaseUrl } from '../../../config/payment.config';
import type { PayoutTransferResult } from './geniuspay-payout.provider';

const JEKO_PAYOUT_METHODS: Record<string, string> = {
  orange_money: 'orange',
  moov_money: 'moov',
  mtn_money: 'mtn',
  wave: 'wave',
};

/**
 * Reversement Mobile Money via Jeko : crée un contact bénéficiaire puis un
 * transfert. Un transfert Mobile Money répond `pending` : le résultat réel
 * arrive par le webhook TRANSACTION_COMPLETED (transactionType = transfer).
 */
@Injectable()
export class JekoPayoutProvider {
  private readonly logger = new Logger(JekoPayoutProvider.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly apiKeyId: string;
  private readonly storeId: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = resolveJekoBaseUrl(this.configService);
    this.apiKey = this.configService.get<string>('JEKO_API_KEY', '');
    this.apiKeyId = this.configService.get<string>('JEKO_API_KEY_ID', '');
    this.storeId = this.configService.get<string>('JEKO_STORE_ID', '');
  }

  private get headers() {
    return {
      'X-API-KEY': this.apiKey,
      'X-API-KEY-ID': this.apiKeyId,
      'Content-Type': 'application/json',
    };
  }

  async sendTransfer(
    reference: string,
    amountFcfa: number,
    phoneNumber: string,
    provider: string,
  ): Promise<PayoutTransferResult> {
    if (!this.apiKey || !this.apiKeyId || !this.storeId) {
      this.logger.error('❌ Jeko non configuré — virement impossible (fail-closed)');
      return {
        success: false,
        message: "Jeko n'est pas configuré — le retrait a été annulé et le montant recrédité.",
      };
    }

    const method = JEKO_PAYOUT_METHODS[String(provider).toLowerCase()];
    if (!method) {
      return { success: false, message: `Opérateur non supporté pour le virement: ${provider}` };
    }

    try {
      const contactResponse = await axios.post(
        `${this.baseUrl}/partner_api/contacts`,
        {
          name: 'Bénéficiaire FasoFree',
          paymentMethod: method,
          identifier: { number: phoneNumber },
        },
        { headers: this.headers, timeout: 30000 },
      );
      const contactId = contactResponse.data?.id;
      if (!contactId) {
        return { success: false, message: 'Création du bénéficiaire Jeko échouée' };
      }

      const transferResponse = await axios.post(
        `${this.baseUrl}/partner_api/transfers`,
        {
          storeId: this.storeId,
          contactId,
          amountCents: Math.round(amountFcfa * 100),
          currency: 'XOF',
          description: 'Retrait FasoFree',
          reference,
        },
        { headers: this.headers, timeout: 30000 },
      );

      const t = transferResponse.data ?? {};
      if (t.status === 'error') {
        return { success: false, message: 'Virement refusé par Jeko' };
      }

      this.logger.log(`✅ Virement Jeko accepté — ref ${reference} | ${amountFcfa} FCFA → ${phoneNumber} (${method})`);
      return {
        success: true,
        message: 'Virement Mobile Money initié via Jeko',
        providerReference: t.id ?? reference,
        transactionId: t.id,
      };
    } catch (error: any) {
      const errData = error?.response?.data;
      this.logger.error(
        `❌ Jeko payout error (ref ${reference}) HTTP ${error?.response?.status}: ${JSON.stringify(errData ?? error.message)}`,
      );
      return {
        success: false,
        message: errData?.message ?? errData?.id ?? error?.message ?? 'Échec du virement Jeko',
      };
    }
  }
}
