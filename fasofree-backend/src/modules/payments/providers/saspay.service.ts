/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as crypto from 'crypto';
import { resolveSasPayBaseUrl } from '../../../config/payment.config';

export type SasPayPaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED';

export interface SasPayPaymentResult {
  id: string;
  status: SasPayPaymentStatus;
  checkoutUrl: string | null;
  bankTransfer: any | null;
  message: string;
  amount?: number;
}

@Injectable()
export class SasPayService {
  private readonly logger = new Logger(SasPayService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly country: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = resolveSasPayBaseUrl(this.configService);
    this.apiKey = this.configService.get<string>('SASPAY_API_KEY', '');
    this.country = this.configService.get<string>('SASPAY_COUNTRY', 'BF');

    if (!this.apiKey) {
      this.logger.warn('⚠️ SasPay non configuré (SASPAY_API_KEY manquant)');
    } else {
      this.logger.log(`✅ SasPay initialisé — URL: ${this.baseUrl}, pays: ${this.country}`);
    }
  }

  private get headers() {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Crée un paiement softpay. Selon le réseau, soit une demande USSD est
   * poussée sur le téléphone, soit une checkout_url est renvoyée (Wave, Orange
   * Money, Djamo, cartes). Il faut toujours tester checkout_url.
   */
  async createPayment(params: {
    amount: number;
    currency?: string;
    country?: string;
    customer: { email?: string; firstName?: string; lastName?: string; phone?: string };
    network: string;
    description?: string;
    metadata?: Record<string, any>;
    returnUrl?: string;
    idempotencyKey?: string;
  }): Promise<SasPayPaymentResult> {
    const body: any = {
      amount: params.amount.toFixed(2),
      currency: params.currency ?? 'XOF',
      country: params.country ?? this.country,
      customer: {
        email: params.customer.email ?? 'client@fasofree.bf',
        first_name: params.customer.firstName ?? 'Client',
        last_name: params.customer.lastName ?? 'FasoFree',
        phone: params.customer.phone ?? '',
      },
      network: params.network,
    };
    if (params.description) body.description = params.description;
    if (params.metadata) body.metadata = params.metadata;
    if (params.returnUrl) body.return_url = params.returnUrl;

    const headers: Record<string, string> = { ...this.headers };
    if (params.idempotencyKey) headers['Idempotency-Key'] = params.idempotencyKey;

    try {
      const response = await axios.post(
        `${this.baseUrl}/payments/softpay/`,
        body,
        { headers, timeout: 30000 },
      );
      const d = response.data ?? {};
      this.logger.log(`✅ SasPay payment créé: ${d.id} (${d.status})`);
      return {
        id: String(d.id ?? ''),
        status: d.status ?? 'PENDING',
        checkoutUrl: d.checkout_url || null,
        bankTransfer: d.bank_transfer || null,
        message: d.message ?? 'Paiement initié',
      };
    } catch (error: any) {
      const errData = error.response?.data;
      this.logger.error(
        `❌ SasPay createPayment HTTP ${error.response?.status}: ${JSON.stringify(errData ?? error.message)}`,
      );
      throw error;
    }
  }

  /** Vérifie le statut réel d'un paiement côté gateway. */
  async verifyPayment(paymentId: string): Promise<SasPayPaymentResult> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/payments/${encodeURIComponent(paymentId)}/verify/`,
        { headers: this.headers, timeout: 15000 },
      );
      const d = response.data ?? {};
      return {
        id: String(d.id ?? paymentId),
        status: d.status ?? 'PENDING',
        checkoutUrl: null,
        bankTransfer: null,
        message: d.message ?? '',
        amount: d.net_amount ? Number(d.net_amount) : d.requested_amount ? Number(d.requested_amount) : undefined,
      };
    } catch (error: any) {
      this.logger.error(`❌ SasPay verifyPayment ${paymentId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Vérifie la signature webhook SasPay.
   * signed = `${timestamp}.${rawBody}` → HMAC-SHA256 hexadécimal minuscule.
   * Fail-closed : tout écart ou secret absent renvoie false.
   * Contrôle d'âge : ±5 minutes.
   */
  verifyWebhookSignature(rawBody: string, signature: string, timestamp: string, secret: string): boolean {
    if (!secret || !signature || !timestamp) return false;

    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - Number(timestamp)) > 300) return false;

    const signed = `${timestamp}.${rawBody}`;
    const expected = crypto.createHmac('sha256', secret).update(signed).digest('hex');
    const expectedBuf = Buffer.from(expected, 'utf8');
    const receivedBuf = Buffer.from(signature.trim().toLowerCase(), 'utf8');
    if (expectedBuf.length !== receivedBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, receivedBuf);
  }

  get webhookSecret(): string {
    return this.configService.get<string>('SASPAY_WEBHOOK_SECRET', '');
  }
}