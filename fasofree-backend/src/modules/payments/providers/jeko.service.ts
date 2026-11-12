/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as crypto from 'crypto';
import { resolveJekoBaseUrl } from '../../../config/payment.config';

export type JekoPaymentRequestStatus = 'pending' | 'success' | 'error';

export interface JekoPaymentRequest {
  id: string;
  status: JekoPaymentRequestStatus;
  redirectUrl: string | null;
  amountCents?: number;
}

const JEKO_METHODS: Record<string, string> = {
  orange_money: 'orange',
  moov_money: 'moov',
  mtn_money: 'mtn',
  wave: 'wave',
};

@Injectable()
export class JekoService {
  private readonly logger = new Logger(JekoService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly apiKeyId: string;
  private readonly storeId: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = resolveJekoBaseUrl(this.configService);
    this.apiKey = this.configService.get<string>('JEKO_API_KEY', '');
    this.apiKeyId = this.configService.get<string>('JEKO_API_KEY_ID', '');
    this.storeId = this.configService.get<string>('JEKO_STORE_ID', '');

    if (!this.apiKey || !this.apiKeyId || !this.storeId) {
      this.logger.warn('⚠️ Jeko non configuré (JEKO_API_KEY, JEKO_API_KEY_ID, JEKO_STORE_ID)');
    }
  }

  private get headers() {
    return {
      'X-API-KEY': this.apiKey,
      'X-API-KEY-ID': this.apiKeyId,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Crée une demande de paiement redirect. Le client est ensuite envoyé vers
   * `redirectUrl` pour payer dans son application Mobile Money.
   */
  async createPaymentRequest(params: {
    amountCents: number;
    reference: string;
    paymentMethod: string;
    successUrl: string;
    errorUrl: string;
  }): Promise<JekoPaymentRequest> {
    const method = JEKO_METHODS[params.paymentMethod] ?? params.paymentMethod;
    const body = {
      storeId: this.storeId,
      amountCents: params.amountCents,
      currency: 'XOF',
      reference: params.reference,
      paymentDetails: {
        type: 'redirect',
        data: {
          paymentMethod: method,
          successUrl: params.successUrl,
          errorUrl: params.errorUrl,
        },
      },
    };

    try {
      const response = await axios.post(
        `${this.baseUrl}/partner_api/payment_requests`,
        body,
        { headers: this.headers, timeout: 30000 },
      );
      const d = response.data ?? {};
      this.logger.log(`✅ Jeko payment request créée: ${d.reference ?? params.reference}`);
      return {
        id: String(d.id),
        status: d.status,
        redirectUrl: d.redirectUrl ?? null,
        amountCents: params.amountCents,
      };
    } catch (error: any) {
      this.logger.error(
        `❌ Jeko createPaymentRequest (${params.reference}) HTTP ${error.response?.status}: ${JSON.stringify(error.response?.data ?? error.message)}`,
      );
      throw error;
    }
  }

  /** Statut réel d'une demande de paiement (réconciliation). */
  async getPaymentRequest(id: string): Promise<JekoPaymentRequest> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/partner_api/payment_requests/${encodeURIComponent(id)}`,
        { headers: this.headers, timeout: 15000 },
      );
      const d = response.data ?? {};
      return {
        id: String(d.id ?? id),
        status: d.status,
        redirectUrl: d.redirectUrl ?? null,
        amountCents: d.transaction?.amount?.amount,
      };
    } catch (error: any) {
      this.logger.error(`❌ Jeko getPaymentRequest ${id}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Vérifie `Jeko-Signature` = HMAC-SHA256 hexadécimal minuscule du corps brut.
   * Fail-closed : tout écart ou secret absent renvoie false.
   */
  verifyWebhookSignature(rawBody: string, signature: string, secret: string): boolean {
    if (!secret || !signature) return false;
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    const expectedBuf = Buffer.from(expected, 'utf8');
    const receivedBuf = Buffer.from(signature.trim().toLowerCase(), 'utf8');
    if (expectedBuf.length !== receivedBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, receivedBuf);
  }

  get webhookSecret(): string {
    return this.configService.get<string>('JEKO_WEBHOOK_SECRET', '');
  }
}
