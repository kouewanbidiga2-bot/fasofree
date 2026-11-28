/**
 * Copyright (c) 2026 BIDIGA Imrane - Koliwa. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as crypto from 'crypto';
import { resolveSasPayBaseUrl, resolveSasPayCountry } from '../../../config/payment.config';

export type SasPayPaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED';

export interface SasPayPaymentResult {
  id: string;
  status: SasPayPaymentStatus;
  checkoutUrl: string | null;
  message: string;
  amount?: number;
  currency?: string;
}

export interface SasPayMerchantBalance {
  country: string;
  currency: string;
  available: number;
  pending: number;
  isFrozen: boolean;
}

/** Moyen de paiement Koliwa → code réseau SasPay (Burkina Faso). */
const NETWORKS_BF: Record<string, string> = {
  orange_money: 'orange_bf',
  moov_money: 'moov_bf',
};

/** Retourne le code réseau SasPay, ou null si le moyen n'est pas disponible au Burkina Faso. */
export function toSasPayNetwork(method: string): string | null {
  return NETWORKS_BF[String(method).toLowerCase()] ?? null;
}

export const SASPAY_PAYOUT_NETWORKS = NETWORKS_BF;

@Injectable()
export class SasPayService {
  private readonly logger = new Logger(SasPayService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly country: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = resolveSasPayBaseUrl(this.configService);
    this.apiKey = this.configService.get<string>('SASPAY_API_KEY', '').trim();
    this.country = resolveSasPayCountry(this.configService);

    if (!this.apiKey) {
      this.logger.warn('⚠️ SasPay non configuré (SASPAY_API_KEY manquant)');
    } else {
      this.logger.log(`✅ SasPay initialisé — URL: ${this.baseUrl}, pays: ${this.country}`);
    }
  }

  get defaultCountry(): string {
    return this.country;
  }

  private get headers() {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * SasPay répond sous l'enveloppe `{ success, data, code }`.
   * On accepte aussi une réponse à plat pour ne pas casser si l'API évolue.
   */
  private unwrap<T = any>(body: any): T {
    const payload = body?.data ?? body;
    return (payload ?? {}) as T;
  }

  /** `checkout_url` peut revenir sans schéma (`pay.saspay.me/checkout/...`). */
  private absoluteUrl(url?: string | null): string | null {
    if (!url) return null;
    return /^https?:\/\//i.test(url) ? url : `https://${url}`;
  }

  /**
   * Crée un paiement softpay. Selon le réseau, SasPay renvoie soit une
   * checkout_url (page à rediriger le client), soit pousse une demande USSD.
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
        last_name: params.customer.lastName ?? 'Koliwa',
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
      const response = await axios.post(`${this.baseUrl}/payments/softpay/`, body, {
        headers,
        timeout: 30000,
      });
      const d = this.unwrap(response.data);
      this.logger.log(`✅ SasPay paiement créé: ${d.id} (${d.status})`);
      return {
        id: String(d.id ?? ''),
        status: d.status ?? 'PENDING',
        checkoutUrl: this.absoluteUrl(d.checkout_url),
        message: d.message ?? 'Paiement initié',
      };
    } catch (error: any) {
      this.logger.error(
        `❌ SasPay createPayment HTTP ${error.response?.status}: ${JSON.stringify(error.response?.data ?? error.message)}`,
      );
      throw error;
    }
  }

  /**
   * Session de checkout hébergé : le client choisit lui-même son opérateur sur
   * la page SasPay (utilisé quand le moyen de paiement n'est pas connu d'avance).
   */
  async createCheckoutSession(params: {
    amount: number;
    currency?: string;
    description?: string;
    customerEmail: string;
    customerName: string;
    customerPhone?: string;
    returnUrl?: string;
    metadata?: Record<string, any>;
  }): Promise<{ id: string; checkoutUrl: string | null }> {
    const body: any = {
      amount: params.amount.toFixed(2),
      currency: params.currency ?? 'XOF',
      country: this.country,
      customer_email: params.customerEmail,
      customer_name: params.customerName,
    };
    if (params.customerPhone) body.customer_phone = params.customerPhone;
    if (params.description) body.description = params.description;
    if (params.returnUrl) body.return_url = params.returnUrl;
    if (params.metadata) body.metadata = params.metadata;

    try {
      const response = await axios.post(`${this.baseUrl}/checkout-sessions/`, body, {
        headers: this.headers,
        timeout: 30000,
      });
      const d = this.unwrap(response.data);
      this.logger.log(`✅ SasPay session de checkout créée: ${d.id}`);
      return { id: String(d.id ?? ''), checkoutUrl: this.absoluteUrl(d.checkout_url) };
    } catch (error: any) {
      this.logger.error(
        `❌ SasPay createCheckoutSession HTTP ${error.response?.status}: ${JSON.stringify(error.response?.data ?? error.message)}`,
      );
      throw error;
    }
  }

  /** Statut réel d'un paiement côté SasPay (réconciliation). */
  async verifyPayment(paymentId: string): Promise<SasPayPaymentResult> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/payments/${encodeURIComponent(paymentId)}/verify/`,
        { headers: this.headers, timeout: 15000 },
      );
      const d = this.unwrap(response.data);
      return {
        id: String(d.id ?? paymentId),
        status: d.status ?? 'PENDING',
        checkoutUrl: null,
        message: d.message ?? '',
        amount: d.net_amount != null ? Number(d.net_amount) : d.amount != null ? Number(d.amount) : undefined,
        currency: typeof d.currency === 'string' ? d.currency.trim().toUpperCase() : undefined,
      };
    } catch (error: any) {
      this.logger.error(`❌ SasPay verifyPayment ${paymentId}: ${error.message}`);
      throw error;
    }
  }

  /** Soldes du marchand, un par pays (lecture seule). */
  async getMerchantBalances(): Promise<SasPayMerchantBalance[]> {
    const balances: SasPayMerchantBalance[] = [];
    let page = 1;
    for (;;) {
      const response = await axios.get(`${this.baseUrl}/merchant-balances/`, {
        headers: this.headers,
        params: { page, page_size: 100 },
        timeout: 15000,
      });
      const body = this.unwrap<any>(response.data);
      const results: any[] = body?.results ?? [];
      for (const r of results) {
        balances.push({
          country: String(r.country),
          currency: String(r.currency),
          available: Number(r.available_amount ?? 0),
          pending: Number(r.pending_amount ?? 0),
          isFrozen: Boolean(r.is_frozen),
        });
      }
      if (!body?.next || results.length === 0) break;
      page += 1;
    }
    return balances;
  }

  /**
   * Vérifie la signature webhook SasPay : HMAC-SHA256 hexadécimal de
   * `${timestamp}.${rawBody}`, avec contrôle d'âge ±5 minutes.
   * Fail-closed : toute absence ou tout écart renvoie false.
   */
  verifyWebhookSignature(rawBody: string, signature: string, timestamp: string, secret: string): boolean {
    if (!secret || !signature || !timestamp) return false;

    const now = Math.floor(Date.now() / 1000);
    if (!Number.isFinite(Number(timestamp)) || Math.abs(now - Number(timestamp)) > 300) return false;

    const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
    const expectedBuf = Buffer.from(expected, 'utf8');
    const receivedBuf = Buffer.from(signature.trim().toLowerCase(), 'utf8');
    if (expectedBuf.length !== receivedBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, receivedBuf);
  }

  get webhookSecret(): string {
    return this.configService.get<string>('SASPAY_WEBHOOK_SECRET', '');
  }
}
