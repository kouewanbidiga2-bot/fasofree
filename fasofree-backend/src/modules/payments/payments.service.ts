import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

// Entités et DTOs
import { Transaction, TransactionStatus } from './entities/transaction.entity';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { OrdersService } from '../orders/orders.service';
import { YengaPayService, YengaPayWebhookPayload } from './providers/yengapay.service';
import { resolvePaymentProvider } from '../../config/payment.config';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    @Inject(forwardRef(() => OrdersService))
    private readonly ordersService: OrdersService,
    private readonly yengaPayService: YengaPayService,
  ) {}

  // 1. Initier un paiement — route vers le provider actif (YengaPay ou CinetPay)
  async initiatePayment(dto: InitiatePaymentDto, clientId: string) {
    const order = await this.orderRepository.findOne({
      where: { id: dto.orderId },
    });
    if (!order) {
      throw new NotFoundException('Commande introuvable');
    }
    if (order.clientId !== clientId) {
      throw new BadRequestException('Cette commande ne vous appartient pas');
    }

    // Référence unique FasoFree
    const reference = `FF-PAY-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    // Commission plateforme issue de la ventilation du modèle hybride
    const commissionAmount = Number(
      order.merchantCommissionAmount ?? order.platformCommission ?? 0,
    );

    // Enregistrement de la transaction PENDING en BDD
    const transaction = this.transactionRepository.create({
      reference,
      orderId: order.id,
      amount: order.totalAmount,
      commissionAmount,
      paymentMethod: dto.paymentMethod,
      status: TransactionStatus.PENDING,
    });
    await this.transactionRepository.save(transaction);

    // Routing vers le provider actif
    const provider = resolvePaymentProvider(this.configService);

    if (provider === 'yengapay' && this.yengaPayService.isConfigured()) {
      return this.initiateYengaPay(order, reference, dto);
    }

    // Fallback CinetPay
    return this.initiateCinetPay(order, reference, dto);
  }

  // YengaPay: créer un PaymentIntent et retourner l'URL checkout
  private async initiateYengaPay(
    order: Order,
    reference: string,
    dto: InitiatePaymentDto,
  ) {
    try {
      const result = await this.yengaPayService.createCheckoutPayment({
        amount: Number(order.totalAmount),
        reference,
        description: `Paiement Commande #${order.id.substring(0, 8)} - FasoFree`,
        metadata: { orderId: order.id, paymentMethod: dto.paymentMethod },
        customerEmail: dto.phoneNumber || undefined,
      });

      return {
        reference,
        checkoutUrl: result.checkoutUrl,
        paymentIntentId: result.paymentIntentId,
        amount: order.totalAmount,
        provider: 'yengapay',
        status: TransactionStatus.PENDING,
      };
    } catch (error) {
      this.logger.error('Erreur YengaPay initiatePayment', error.message);
      throw new BadRequestException(
        error.message || 'Échec de l\'initialisation YengaPay',
      );
    }
  }

  // CinetPay: créer un guichet de paiement via API REST
  private async initiateCinetPay(
    order: Order,
    reference: string,
    dto: InitiatePaymentDto,
  ) {
    const cinetpayPayload = {
      apikey: this.configService.get<string>('CINETPAY_API_KEY'),
      site_id: this.configService.get<string>('CINETPAY_SITE_ID'),
      transaction_id: reference,
      amount: order.totalAmount,
      currency: 'XOF',
      description: `Paiement Commande #${order.id.substring(0, 8)} - FasoFree`,
      notify_url: this.configService.get<string>('APP_WEBHOOK_URL'),
      return_url: `${this.configService.get<string>('APP_RETURN_URL')}?orderId=${order.id}`,
      channels: 'ALL',
    };

    try {
      const baseUrl = this.configService.get<string>('CINETPAY_BASE_URL');
      const response = await firstValueFrom(
        this.httpService.post(`${baseUrl}/payment`, cinetpayPayload),
      );

      const { code, message, data } = response.data;

      if (code !== '201') {
        this.logger.error(`Erreur CinetPay (${code}): ${message}`);
        throw new BadRequestException(
          `Échec de l'initialisation du paiement: ${message}`,
        );
      }

      return {
        reference,
        paymentUrl: data.payment_url,
        paymentToken: data.payment_token,
        amount: order.totalAmount,
        provider: 'cinetpay',
        status: TransactionStatus.PENDING,
      };
    } catch (error) {
      this.logger.error(
        "Erreur lors de l'appel à l'API CinetPay",
        error?.response?.data || error.message,
      );
      throw new BadRequestException(
        'Impossible de contacter la passerelle de paiement.',
      );
    }
  }

  // 🛡️ 2. Traitement des Webhooks

  // 🌊 Webhook Wave
  async handleWaveWebhook(payload: unknown) {
    this.logger.log('Webhook Wave reçu');
    let body: Record<string, unknown> | null = null;
    try {
      if (typeof payload === 'string') {
        body = JSON.parse(payload);
      } else if (payload && typeof payload === 'object') {
        body = payload as Record<string, unknown>;
      }
    } catch (err) {
      this.logger.warn('Payload Wave non JSON ou invalide');
    }

    if (body && body.type === 'checkout.session.completed' && body.data) {
      const data = body.data as Record<string, any>;
      const orderId = data.client_reference;
      const transactionRef = data.id;
      if (orderId && transactionRef) {
        await this.processSuccessfulPayment(orderId, transactionRef, 'WAVE');
      }
    }
    return { ok: true };
  }

  // 🟠 Webhook LigdiCash
  async handleLigdicashWebhook(payload: unknown, token: string) {
    this.logger.log('Webhook LigdiCash reçu');
    const expected =
      this.configService.get<string>('LIGDICASH_PAYOUT_TOKEN') ||
      this.configService.get<string>('LIGDICASH_AUTH_TOKEN');
    if (!token || token !== expected) {
      this.logger.warn('Token LigdiCash invalide');
      throw new BadRequestException('Token invalide');
    }

    let body: Record<string, unknown> | null = null;
    try {
      if (typeof payload === 'string') {
        body = JSON.parse(payload);
      } else if (payload && typeof payload === 'object') {
        body = payload as Record<string, unknown>;
      }
    } catch (err) {
      this.logger.warn('Payload LigdiCash non JSON ou invalide');
    }

    if (body && body.status === 'completed') {
      const orderId = body.custom_data as string;
      const transactionRef = body.token as string;
      if (orderId && transactionRef) {
        await this.processSuccessfulPayment(
          orderId,
          transactionRef,
          'LIGDICASH',
        );
      }
    }
    return { ok: true };
  }

  // ✅ 3. Validation globale d'un paiement réussi
  async processSuccessfulPayment(
    orderId: string,
    transactionRef: string,
    paymentMethod: string,
  ): Promise<void> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });

    if (!order) {
      this.logger.error(`Commande introuvable pour l'ID : ${orderId}`);
      return;
    }

    if (
      order.status === OrderStatus.PAID ||
      order.status === OrderStatus.IN_PREPARATION
    ) {
      this.logger.warn(
        `Webhook ignoré : la commande ${orderId} est déjà marquée comme payée.`,
      );
      return;
    }

    // Utiliser le système transactionnel d'OrdersService
    try {
      await this.ordersService.markAsPaidAndDispatch(orderId, transactionRef);
      this.logger.log(
        `Commande ${orderId} validée avec succès via ${paymentMethod}`,
      );
    } catch (error) {
      this.logger.error(
        `Erreur lors du traitement du paiement: ${error.message}`,
      );
    }
  }

  // 🔍 4. Méthode interne : Interrogation directe des serveurs CinetPay
  private async verifyTransactionWithGateway(
    transactionId: string,
  ): Promise<boolean> {
    try {
      const baseUrl = this.configService.get<string>('CINETPAY_BASE_URL');
      const response = await firstValueFrom(
        this.httpService.post(`${baseUrl}/payment/check`, {
          apikey: this.configService.get<string>('CINETPAY_API_KEY'),
          site_id: this.configService.get<string>('CINETPAY_SITE_ID'),
          transaction_id: transactionId,
        }),
      );

      // CinetPay retourne le code "00" lorsque le paiement est validé
      return response.data?.code === '00';
    } catch (error) {
      this.logger.error(
        `Erreur de vérification pour la transaction ${transactionId}`,
        error?.response?.data || error.message,
      );
      return false;
    }
  }
}
