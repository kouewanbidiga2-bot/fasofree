/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as crypto from 'crypto';
import { resolveGeniusPayBaseUrl } from '../../../config/payment.config';

export interface GeniusPayPayment {
  id: number;
  reference: string;
  amount: number;
  currency: string;
  fees: number;
  net_amount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'refunded' | 'expired';
  payment_method: string | null;
  gateway: string | null;
  checkout_url: string | null;
  payment_url: string | null;
  customer: {
    name: string;
    email: string;
    phone: string;
  };
  metadata: Record<string, any>;
  created_at: string;
  completed_at: string | null;
  expires_at: string | null;
  environment: string;
}

export interface GeniusPayCreateResponse {
  success: boolean;
  data: GeniusPayPayment;
}

export interface GeniusPayListResponse {
  success: boolean;
  data: GeniusPayPayment[];
  meta: {
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
  };
}

export interface GeniusPayBalance {
  available: number;
  pending: number;
  total: number;
  currency: string;
}

export interface GeniusPayAccount {
  id: number;
  business_name: string;
  email: string;
  status: string;
  environment: string;
  created_at: string;
}

const METHOD_SLUGS: Record<string, string> = {
  orange_money: 'orange-money-bf',
  moov_money: 'moov-money-bf',
  wave: 'wave-bf',
  mtn_money: 'mtn-bf',
};

@Injectable()
export class GeniusPayService {
  private readonly logger = new Logger(GeniusPayService.name);
  private readonly baseUrl: string;
  private readonly apiSecret: string;

  constructor(private readonly configService: ConfigService) {
    this.apiSecret = this.configService.get<string>('GENIUSPAY_API_SECRET', '');
    this.baseUrl = resolveGeniusPayBaseUrl(this.configService);

    if (!this.apiSecret) {
      this.logger.warn('⚠️ GeniusPay API secret (private key) not configured');
    } else {
      this.logger.log(`✅ GeniusPay service initialized — URL: ${this.baseUrl}`);
    }
  }

  private get headers() {
    return {
      Authorization: `Bearer ${this.apiSecret}`,
      'Content-Type': 'application/json',
    };
  }

  private pickUrl(data: any): string | null {
    return (
      data?.payment_url ||
      data?.checkout_url ||
      data?.redirect_url ||
      data?.url ||
      null
    );
  }

  private mapStatus(raw: any): GeniusPayPayment['status'] {
    const s = String(raw ?? '').toUpperCase();
    if (s === 'SUCCESS' || s === 'COMPLETED') return 'completed';
    if (s === 'FAILED') return 'failed';
    if (s === 'CANCELLED' || s === 'CANCELED') return 'cancelled';
    if (s === 'PENDING') return 'pending';
    if (s === 'PROCESSING' || s === 'SUBMITTED') return 'processing';
    if (s === 'REFUNDED') return 'refunded';
    if (s === 'EXPIRED') return 'expired';
    return 'pending';
  }

  async createPayment(params: {
    amount: number;
    description?: string;
    paymentMethod?: string;
    customer?: { name?: string; email?: string; phone?: string };
    metadata?: Record<string, any>;
    successUrl?: string;
    errorUrl?: string;
  }): Promise<GeniusPayPayment> {
    const methodSlug = params.paymentMethod
      ? METHOD_SLUGS[params.paymentMethod] ?? params.paymentMethod
      : undefined;

    const webhookUrl = this.configService.get<string>('APP_WEBHOOK_URL');
    const callbackUrl = webhookUrl
      ? `${webhookUrl.replace(/\/+$/, '')}/geniuspay/webhook`
      : undefined;

    const body: any = {
      amount: params.amount,
      currency: 'XOF',
      country: 'BF',
      channel: methodSlug ? 'mobile_money' : undefined,
      method: methodSlug,
      phone_number: params.customer?.phone,
      tx_ref: params.metadata?.reference ?? `FF-PAY-${Date.now()}`,
      callback_url: callbackUrl,
      redirect_url: params.successUrl,
      extras: params.metadata,
    };
    if (params.description) body.description = params.description;
    if (params.customer?.name) body.payer_name = params.customer.name;
    if (params.customer?.email) body.payer_email = params.customer.email;

    Object.keys(body).forEach((k) => {
      if (body[k] === undefined || body[k] === null) delete body[k];
    });

    try {
      const response = await axios.post(
        `${this.baseUrl}/payins`,
        body,
        { headers: this.headers, timeout: 30000 },
      );

      if (response.data?.status !== 'success') {
        throw new Error('GenesysPay payment creation failed');
      }

      const d = response.data?.data ?? {};
      const url = this.pickUrl(d);
      this.logger.log(`✅ GenesysPay payment created: ${d.tx_ref ?? d.transaction_id}`);
      return {
        id: Number(d.transaction_id ?? d.id ?? 0),
        reference: String(d.tx_ref ?? d.transaction_id ?? ''),
        amount: Number(d.amount ?? params.amount),
        currency: String(d.currency ?? 'XOF'),
        fees: Number(d.fee ?? 0),
        net_amount: Number(d.amount ?? params.amount),
        status: this.mapStatus(d.status),
        payment_method: d.payment_method ?? methodSlug ?? null,
        gateway: null,
        checkout_url: url,
        payment_url: url,
        customer: {
          name: params.customer?.name ?? '',
          email: params.customer?.email ?? '',
          phone: params.customer?.phone ?? '',
        },
        metadata: d.extras ?? params.metadata ?? {},
        created_at: String(d.created_at ?? new Date().toISOString()),
        completed_at: null,
        expires_at: null,
        environment: '',
      };
    } catch (error: any) {
      const errData = error.response?.data;
      this.logger.error(`❌ GenesysPay createPayment error: ${error.message}`);
      this.logger.error(`❌ GenesysPay URL: ${this.baseUrl}/payins`);
      if (errData) {
        this.logger.error(`❌ GenesysPay response body: ${JSON.stringify(errData)}`);
      }
      if (error.response?.status) {
        this.logger.error(`❌ GenesysPay HTTP status: ${error.response.status}`);
      }
      this.logger.error(`❌ GenesysPay request body sent: ${JSON.stringify(body)}`);
      throw error;
    }
  }

  async getPayment(reference: string): Promise<GeniusPayPayment> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/payins/${reference}`,
        { headers: this.headers, timeout: 15000 },
      );

      if (response.data?.status !== 'success') {
        throw new Error('Payment not found');
      }

      const d = response.data?.data ?? {};
      const url = this.pickUrl(d);
      return {
        id: Number(d.transaction_id ?? d.id ?? 0),
        reference: String(d.tx_ref ?? d.transaction_id ?? reference),
        amount: Number(d.amount ?? 0),
        currency: String(d.currency ?? 'XOF'),
        fees: Number(d.fee ?? 0),
        net_amount: Number(d.amount ?? 0),
        status: this.mapStatus(d.status),
        payment_method: d.payment_method ?? null,
        gateway: null,
        checkout_url: url,
        payment_url: url,
        customer: { name: '', email: '', phone: '' },
        metadata: d.extras ?? {},
        created_at: String(d.created_at ?? ''),
        completed_at: null,
        expires_at: null,
        environment: '',
      };
    } catch (error: any) {
      this.logger.error(`❌ GenesysPay getPayment error: ${error.message}`);
      throw error;
    }
  }

  async listPayments(_params?: any): Promise<GeniusPayListResponse> {
    return { success: true, data: [], meta: { current_page: 1, per_page: 0, total: 0, last_page: 1 } };
  }

  async getBalance(): Promise<GeniusPayBalance> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/wallets/XOF`,
        { headers: this.headers, timeout: 15000 },
      );
      const d = response.data?.data ?? {};
      return {
        available: Number(d.available_balance ?? 0),
        pending: Number(d.locked_balance ?? 0),
        total: Number(d.balance ?? 0),
        currency: String(d.currency ?? 'XOF'),
      };
    } catch (error: any) {
      this.logger.error(`❌ GenesysPay getBalance error: ${error.message}`);
      throw error;
    }
  }

  async getAccount(): Promise<GeniusPayAccount> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/wallets`,
        { headers: this.headers, timeout: 15000 },
      );
      const d = Array.isArray(response.data?.data) ? response.data.data[0] : response.data?.data ?? {};
      return {
        id: 0,
        business_name: 'GenesysPay',
        email: '',
        status: 'active',
        environment: '',
        created_at: String(d?.created_at ?? ''),
      };
    } catch (error: any) {
      this.logger.error(`❌ GenesysPay getAccount error: ${error.message}`);
      throw error;
    }
  }

  async getProviders(_country?: string): Promise<any> {
    return [];
  }

  verifyWebhookSignature(
    payload: string,
    signature: string,
    _timestamp: string,
    webhookSecret: string,
  ): boolean {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(payload)
        .digest('hex');

      const sigBuf = Buffer.from(signature, 'utf8');
      const expectedBuf = Buffer.from(expectedSignature, 'utf8');

      if (sigBuf.length !== expectedBuf.length) {
        return false;
      }

      return crypto.timingSafeEqual(sigBuf, expectedBuf);
    } catch {
      return false;
    }
  }
}
