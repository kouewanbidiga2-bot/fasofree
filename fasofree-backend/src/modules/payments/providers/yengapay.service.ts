import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as crypto from 'crypto';

export interface YengaPayCheckoutResponse {
  paymentIntentId: string;
  checkoutUrl: string;
  amount: number;
  reference: string;
}

export interface YengaPayWebhookPayload {
  event: string;
  data: {
    paymentIntentId: string;
    amount: number;
    status: string;
    transactionId?: string;
    reference?: string;
    metadata?: Record<string, any>;
    customerMSISDN?: string;
    operator?: string;
    fees?: number;
    totalAmount?: number;
    createdAt?: string;
    completedAt?: string;
  };
}

const OPERATOR_CODE_MAP: Record<string, string> = {
  orange_money: 'ORANGE',
  moov_money: 'MOOV',
  telecel_money: 'TELECEL',
};

@Injectable()
export class YengaPayService {
  private readonly logger = new Logger(YengaPayService.name);
  private readonly apiKey: string;
  private readonly groupId: string;
  private readonly projectId: string;
  private readonly webhookSecret: string;
  private readonly baseUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.apiKey = this.configService.get<string>('YENGAPAY_API_KEY', '');
    this.groupId = this.configService.get<string>('YENGAPAY_GROUP_ID', '');
    this.projectId = this.configService.get<string>('YENGAPAY_PROJECT_ID', '');
    this.webhookSecret = this.configService.get<string>('YENGAPAY_WEBHOOK_SECRET', '');

    const isSandbox = this.configService.get<string>('YENGAPAY_ENV', 'sandbox') === 'sandbox';
    this.baseUrl = isSandbox
      ? 'https://api.sandbox.yengapay.com/api/v1'
      : 'https://api.yengapay.com/api/v1';
  }

  isConfigured(): boolean {
    return !!(this.apiKey && this.groupId && this.projectId);
  }

  /**
   * 1. Créer un PaymentIntent (Checkout page hébergée YengaPay)
   * Redirige l'utilisateur vers la page de paiement YengaPay.
   */
  async createCheckoutPayment(params: {
    amount: number;
    reference: string;
    description: string;
    metadata?: Record<string, any>;
    customerEmail?: string;
  }): Promise<YengaPayCheckoutResponse> {
    if (!this.isConfigured()) {
      throw new BadRequestException('YengaPay n\'est pas configuré. Clés API manquantes.');
    }

    const payload: Record<string, any> = {
      paymentAmount: params.amount,
      currency: 'XOF',
      reference: params.reference,
      description: params.description,
      metadata: params.metadata || {},
    };

    if (params.customerEmail) {
      payload.customerEmailToNotify = params.customerEmail;
    }

    try {
      const url = `${this.baseUrl}/groups/${this.groupId}/payment-intent/${this.projectId}`;
      this.logger.log(`YengaPay → POST ${url}`);

      const response = await firstValueFrom(
        this.httpService.post(url, payload, {
          headers: {
            'x-api-key': this.apiKey,
            'Content-Type': 'application/json',
          },
        }),
      );

      const data = response.data;

      if (!data || data.error) {
        this.logger.error('YengaPay PaymentIntent error:', data);
        throw new BadRequestException(
          data?.error?.message || 'Échec de la création du paiement YengaPay',
        );
      }

      this.logger.log(`YengaPay PaymentIntent créé: ${data.paymentIntentId}`);

      return {
        paymentIntentId: data.paymentIntentId,
        checkoutUrl: data.checkoutPageUrlWithPaymentToken || data.checkoutPageUrl,
        amount: params.amount,
        reference: params.reference,
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error(
        'Erreur lors de l\'appel à YengaPay',
        error?.response?.data || error.message,
      );
      throw new BadRequestException(
        'Impossible de contacter la passerelle YengaPay.',
      );
    }
  }

  /**
   * 2. Vérifier la signature HMAC-SHA256 du webhook YengaPay
   * YengaPay envoie `x-webhook-hash` = HMAC-SHA256(JSON.stringify(payload), webhookSecret)
   */
  verifyWebhookSignature(
    payload: Record<string, any>,
    receivedHash: string,
  ): boolean {
    if (!this.webhookSecret) {
      this.logger.error(
        'YENGAPAY_WEBHOOK_SECRET non configuré — signature non vérifiée (webhook rejeté)',
      );
      return false;
    }

    try {
      const canonical = JSON.stringify(payload);
      const computedHash = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(canonical)
        .digest('hex');

      const expected = Buffer.from(computedHash, 'hex');
      const received = Buffer.from(receivedHash, 'hex');

      if (expected.length !== received.length) return false;
      return crypto.timingSafeEqual(expected, received);
    } catch (error) {
      this.logger.error('Erreur de vérification de signature YengaPay', error.message);
      return false;
    }
  }

  /**
   * 3. Extraire l'orderId et la reference depuis le payload webhook
   */
  extractOrderInfo(payload: YengaPayWebhookPayload): {
    orderId: string | null;
    transactionRef: string | null;
    status: 'SUCCESS' | 'FAILED';
    amount: number;
  } {
    const metadata = payload.data?.metadata || {};
    const orderId = metadata.orderId || null;
    const transactionRef = payload.data?.transactionId || payload.data?.paymentIntentId || null;

    const rawStatus = (payload.data?.status || '').toUpperCase();
    let status: 'SUCCESS' | 'FAILED' = 'FAILED';
    if (rawStatus === 'DONE' || rawStatus === 'SUCCESS' || rawStatus === 'COMPLETED') {
      status = 'SUCCESS';
    }

    return {
      orderId,
      transactionRef,
      status,
      amount: payload.data?.amount || 0,
    };
  }

  /**
   * 4. Convertir le paymentMethod FasoFree en code opérateur YengaPay
   */
  static toOperatorCode(paymentMethod: string): string | null {
    return OPERATOR_CODE_MAP[paymentMethod.toLowerCase()] || null;
  }
}
