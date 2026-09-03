import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

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

@Injectable()
export class GeniusPayService {
  private readonly logger = new Logger(GeniusPayService.name);
  private readonly baseUrl = 'https://geniuspay.ci/api/v1/merchant';
  private readonly apiKey: string;
  private readonly apiSecret: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('GENIUSPAY_API_KEY', '');
    this.apiSecret = this.configService.get<string>('GENIUSPAY_API_SECRET', '');

    if (!this.apiKey || !this.apiSecret) {
      this.logger.warn('⚠️ GeniusPay API keys not configured');
    } else {
      this.logger.log('✅ GeniusPay service initialized');
    }
  }

  private get headers() {
    return {
      'X-API-Key': this.apiKey,
      'X-API-Secret': this.apiSecret,
      'Content-Type': 'application/json',
    };
  }

  /**
   * 💳 Initier un paiement GeniusPay
   */
  async createPayment(params: {
    amount: number;
    description?: string;
    paymentMethod?: string;
    customer?: { name?: string; email?: string; phone?: string };
    metadata?: Record<string, any>;
    successUrl?: string;
    errorUrl?: string;
  }): Promise<GeniusPayPayment> {
    // Mapper nos méthodes vers les codes GeniusPay (pas de gateway pour le BF — routing automatique)
    const methodMap: Record<string, string> = {
      orange_money: 'orange_money',
      moov_money: 'moov_money',
      wave: 'wave',
      mtn_money: 'mtn_money',
    };

    const body: any = {
      amount: params.amount,
      currency: 'XOF',
    };

    // Utiliser payment_method directement (GeniusPay routage automatique pour BF)
    if (params.paymentMethod && methodMap[params.paymentMethod]) {
      body.payment_method = methodMap[params.paymentMethod];
    }
    // Si pas de paymentMethod → mode checkout GeniusPay (client choisit)

    if (params.description) body.description = params.description;
    if (params.customer) {
      body.customer = { ...params.customer, country: 'BF' };
    }
    if (params.metadata) body.metadata = params.metadata;
    if (params.successUrl) body.success_url = params.successUrl;
    if (params.errorUrl) body.error_url = params.errorUrl;

    try {
      const response = await axios.post<GeniusPayCreateResponse>(
        `${this.baseUrl}/payments`,
        body,
        { headers: this.headers, timeout: 30000 },
      );

      if (!response.data.success) {
        throw new Error('GeniusPay payment creation failed');
      }

      this.logger.log(`✅ GeniusPay payment created: ${response.data.data.reference}`);
      return response.data.data;
    } catch (error: any) {
      const errData = error.response?.data;
      this.logger.error(`❌ GeniusPay createPayment error: ${error.message}`);
      if (errData) {
        this.logger.error(`❌ GeniusPay response body: ${JSON.stringify(errData)}`);
      }
      this.logger.error(`❌ GeniusPay request body sent: ${JSON.stringify(body)}`);
      throw error;
    }
  }

  /**
   * 📋 Récupérer un paiement par référence
   */
  async getPayment(reference: string): Promise<GeniusPayPayment> {
    try {
      const response = await axios.get<GeniusPayCreateResponse>(
        `${this.baseUrl}/payments/${reference}`,
        { headers: this.headers, timeout: 15000 },
      );

      if (!response.data.success) {
        throw new Error('Payment not found');
      }

      return response.data.data;
    } catch (error: any) {
      this.logger.error(`❌ GeniusPay getPayment error: ${error.message}`);
      throw error;
    }
  }

  /**
   * 📋 Lister les paiements
   */
  async listPayments(params?: {
    status?: string;
    paymentMethod?: string;
    from?: string;
    to?: string;
    search?: string;
    perPage?: number;
    page?: number;
  }): Promise<GeniusPayListResponse> {
    const queryParams: any = {};
    if (params?.status) queryParams.status = params.status;
    if (params?.paymentMethod) queryParams.payment_method = params.paymentMethod;
    if (params?.from) queryParams.from = params.from;
    if (params?.to) queryParams.to = params.to;
    if (params?.search) queryParams.search = params.search;
    if (params?.perPage) queryParams.per_page = params.perPage;
    if (params?.page) queryParams.page = params.page;

    try {
      const response = await axios.get<GeniusPayListResponse>(
        `${this.baseUrl}/payments`,
        { headers: this.headers, params: queryParams, timeout: 15000 },
      );

      return response.data;
    } catch (error: any) {
      this.logger.error(`❌ GeniusPay listPayments error: ${error.message}`);
      throw error;
    }
  }

  /**
   * 💰 Consulter le solde
   */
  async getBalance(): Promise<GeniusPayBalance> {
    try {
      const response = await axios.get<{ success: boolean; data: GeniusPayBalance }>(
        `${this.baseUrl}/account/balance`,
        { headers: this.headers, timeout: 15000 },
      );

      return response.data.data;
    } catch (error: any) {
      this.logger.error(`❌ GeniusPay getBalance error: ${error.message}`);
      throw error;
    }
  }

  /**
   * 🏪 Informations du compte
   */
  async getAccount(): Promise<GeniusPayAccount> {
    try {
      const response = await axios.get<{ success: boolean; data: GeniusPayAccount }>(
        `${this.baseUrl}/account`,
        { headers: this.headers, timeout: 15000 },
      );

      return response.data.data;
    } catch (error: any) {
      this.logger.error(`❌ GeniusPay getAccount error: ${error.message}`);
      throw error;
    }
  }

  /**
   * 📱 Lister les fournisseurs MMO d'un pays
   */
  async getProviders(country?: string): Promise<any> {
    try {
      const params = country ? { country } : {};
      const response = await axios.get(
        `${this.baseUrl}/pawapay/providers`,
        { headers: this.headers, params, timeout: 15000 },
      );

      return response.data.data;
    } catch (error: any) {
      this.logger.error(`❌ GeniusPay getProviders error: ${error.message}`);
      throw error;
    }
  }

  /**
   * ✅ Vérifier la signature d'un webhook
   */
  verifyWebhookSignature(
    payload: string,
    signature: string,
    timestamp: string,
    webhookSecret: string,
  ): boolean {
    const crypto = require('crypto');
    const data = `${timestamp}.${payload}`;
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(data)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature),
    );
  }
}
