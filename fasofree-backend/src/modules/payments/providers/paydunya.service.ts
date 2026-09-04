import {
  Injectable,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as crypto from 'crypto';

export interface PayDunyaCheckoutResponse {
  checkoutUrl: string;
  token: string;
  amount: number;
  reference: string;
}

export interface PayDunyaWebhookPayload {
  response_code: string;
  response_text: string;
  hash: string;
  invoice: {
    token: string;
    total_amount: number;
    description: string;
    items?: Record<string, any>;
  };
  custom_data?: Record<string, any>;
  actions?: {
    cancel_url?: string;
    callback_url?: string;
    return_url?: string;
  };
  mode?: string;
  status?: string;
  customer?: {
    name?: string;
    phone?: string;
    email?: string;
  };
  receipt_url?: string;
}

@Injectable()
export class PayDunyaService {
  private readonly logger = new Logger(PayDunyaService.name);
  private readonly masterKey: string;
  private readonly privateKey: string;
  private readonly token: string;
  private readonly baseUrl: string;
  private readonly isLive: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.masterKey = this.configService.get<string>('PAYDUNYA_MASTER_KEY', '');
    this.privateKey = this.configService.get<string>('PAYDUNYA_PRIVATE_KEY', '');
    this.token = this.configService.get<string>('PAYDUNYA_TOKEN', '');
    this.isLive = this.configService.get<string>('PAYDUNYA_MODE', 'test') === 'live';
    this.baseUrl = this.isLive
      ? 'https://app.paydunya.com/api/v1'
      : 'https://app.paydunya.com/sandbox-api/v1';
  }

  isConfigured(): boolean {
    return !!(this.masterKey && this.privateKey && this.token);
  }

  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'PAYDUNYA-MASTER-KEY': this.masterKey,
      'PAYDUNYA-PRIVATE-KEY': this.privateKey,
      'PAYDUNYA-TOKEN': this.token,
    };
  }

  /**
   * 1. Créer une facture checkout et retourner l'URL de paiement
   */
  async createCheckoutPayment(params: {
    amount: number;
    reference: string;
    description: string;
    metadata?: Record<string, any>;
    customerName?: string;
    customerPhone?: string;
    customerEmail?: string;
    paymentMethod?: string;
  }): Promise<PayDunyaCheckoutResponse> {
    if (!this.isConfigured()) {
      throw new BadRequestException('PayDunya n\'est pas configuré. Clés API manquantes.');
    }

    // Mapping des moyens de paiement FasoFree → canaux PayDunya
    const channelMap: Record<string, string> = {
      orange_money: 'orange-money-burkina',
      moov_money: 'moov-burkina-faso',
    };
    const channel = channelMap[params.paymentMethod || ''] || undefined;

    const payload: Record<string, any> = {
      invoice: {
        total_amount: params.amount,
        description: params.description,
        items: {
          item_0: {
            name: params.description,
            quantity: 1,
            unit_price: String(params.amount),
            total_price: String(params.amount),
            description: '',
          },
        },
        customer: {
          name: params.customerName || '',
          phone: params.customerPhone || '',
          email: params.customerEmail || '',
        },
      },
      store: {
        name: 'FasoFree',
        website_url: 'https://www.fasofree.site',
        logo_url: 'https://www.fasofree.site/favicon.svg',
      },
      custom_data: {
        reference: params.reference,
        ...(params.metadata || {}),
      },
      actions: {
        cancel_url: 'https://www.fasofree.site/receipt',
        return_url: 'https://www.fasofree.site/receipt',
        callback_url: this.configService.get<string>(
          'PAYDUNYA_WEBHOOK_URL',
          'https://api.fasofree.site/api/v1/payments/paydunya/webhook',
        ),
      },
    };

    if (channel) {
      payload.invoice.channels = [channel];
    }

    try {
      const url = `${this.baseUrl}/checkout-invoice/create`;
      this.logger.log(`PayDunya → POST ${url}`);
      this.logger.debug(`PayDunya payload: ${JSON.stringify({ ...payload, store: '...', invoice: { ...payload.invoice, items: '...' } })}`);

      const response = await firstValueFrom(
        this.httpService.post(url, payload, {
          headers: this.getHeaders(),
          timeout: 30000,
        }),
      );

      const data = response.data;

      this.logger.log(`PayDunya response_code: ${data.response_code}`);

      if (data.response_code !== '00') {
        this.logger.error(`PayDunya API error (${data.response_code}): ${data.response_text}`, JSON.stringify(data));
        throw new BadRequestException(
          data.response_text || 'Échec de la création de la facture PayDunya',
        );
      }

      this.logger.log(`PayDunya facture créée: ${data.token}`);

      return {
        checkoutUrl: data.response_text, // URL de redirection
        token: data.token,
        amount: params.amount,
        reference: params.reference,
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;

      // Log détaillé pour tous les types d'erreurs
      const axiosData = error?.response?.data;
      const axiosStatus = error?.response?.status;
      const axiosHeaders = error?.response?.headers;

      if (axiosData) {
        this.logger.error(
          `PayDunya API HTTP ${axiosStatus}: ${JSON.stringify(axiosData)}`,
          axiosHeaders ? JSON.stringify(axiosHeaders) : '',
        );
      } else {
        this.logger.error(
          `PayDunya network/error: ${error?.message || error}`,
          error?.stack || '',
        );
      }

      throw new BadRequestException(
        axiosData?.response_text || axiosData?.message || 'Impossible de contacter la passerelle PayDunya.',
      );
    }
  }

  /**
   * 2. Vérifier le statut d'un paiement
   */
  async verifyPayment(invoiceToken: string): Promise<{
    status: 'completed' | 'pending' | 'cancelled' | 'failed';
    amount: number;
    raw: PayDunyaWebhookPayload;
  }> {
    try {
      const url = `${this.baseUrl}/checkout-invoice/confirm/${invoiceToken}`;
      this.logger.log(`PayDunya → GET ${url}`);

      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: this.getHeaders(),
          timeout: 15000,
        }),
      );

      const data = response.data;
      this.logger.log(`PayDunya verify response_code: ${data.response_code}, status: ${data.status}`);
      const rawStatus = (data.status || '').toLowerCase();

      let status: 'completed' | 'pending' | 'cancelled' | 'failed' = 'pending';
      if (rawStatus === 'completed') status = 'completed';
      else if (rawStatus === 'cancelled') status = 'cancelled';
      else if (rawStatus === 'failed') status = 'failed';

      return {
        status,
        amount: Number(data.invoice?.total_amount || 0),
        raw: data,
      };
    } catch (error) {
      const axiosData = error?.response?.data;
      const axiosStatus = error?.response?.status;
      if (axiosData) {
        this.logger.error(
          `PayDunya verify HTTP ${axiosStatus}: ${JSON.stringify(axiosData)}`,
        );
      } else {
        this.logger.error(
          `PayDunya verify error for ${invoiceToken}: ${error?.message || error}`,
        );
      }
      return { status: 'failed', amount: 0, raw: null as any };
    }
  }

  /**
   * 3. Vérifier le hash du webhook (SHA-512 du Master Key)
   */
  verifyWebhookHash(payload: PayDunyaWebhookPayload, receivedHash: string): boolean {
    if (!this.masterKey) {
      this.logger.error('PAYDUNYA_MASTER_KEY non configuré — hash non vérifié (webhook rejeté)');
      return false;
    }

    try {
      // PayDunya utilise SHA-512 du master key pour valider l'authenticité
      const expectedHash = crypto
        .createHash('sha512')
        .update(this.masterKey)
        .digest('hex');

      if (!receivedHash) return false;
      const expected = Buffer.from(expectedHash, 'hex');
      const received = Buffer.from(receivedHash, 'hex');
      if (expected.length !== received.length) return false;
      return crypto.timingSafeEqual(expected, received);
    } catch (error) {
      this.logger.error('Erreur vérification hash PayDunya', error.message);
      return false;
    }
  }

  /**
   * 4. Extraire les infos de la facture depuis le webhook
   */
  extractOrderInfo(payload: PayDunyaWebhookPayload): {
    orderId: string | null;
    transactionRef: string | null;
    status: 'SUCCESS' | 'FAILED' | 'PENDING';
    amount: number;
  } {
    const customData = payload.custom_data || {};
    const orderId = customData.orderId || customData.reference || null;
    const transactionRef = payload.invoice?.token || null;

    const rawStatus = (payload.status || '').toUpperCase();
    let status: 'SUCCESS' | 'FAILED' | 'PENDING' = 'PENDING';
    if (rawStatus === 'COMPLETED') status = 'SUCCESS';
    else if (rawStatus === 'CANCELLED' || rawStatus === 'FAILED') status = 'FAILED';

    return {
      orderId,
      transactionRef,
      status,
      amount: payload.invoice?.total_amount || 0,
    };
  }
}
