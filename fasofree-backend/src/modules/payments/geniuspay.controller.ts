import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Req,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { GeniusPayService } from './providers/geniuspay.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../orders/entities/order.entity';
import { Transaction, TransactionStatus, PaymentMethod } from './entities/transaction.entity';

@ApiTags('GeniusPay')
@Controller('geniuspay')
export class GeniusPayController {
  private readonly logger = new Logger(GeniusPayController.name);

  constructor(
    private readonly geniusPayService: GeniusPayService,
    private readonly configService: ConfigService,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
  ) {}

  /**
   * 💳 Initier un paiement GeniusPay
   */
  @Post('pay')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Initier un paiement GeniusPay' })
  async createPayment(
    @Body() body: {
      orderId: string;
      amount: number;
      paymentMethod?: string;
      customer?: { name?: string; email?: string; phone?: string };
      successUrl?: string;
      errorUrl?: string;
    },
  ) {
    const order = await this.orderRepository.findOne({
      where: { id: body.orderId },
    });

    if (!order) {
      return { success: false, error: 'Commande introuvable' };
    }

    const payment = await this.geniusPayService.createPayment({
      amount: body.amount,
      description: `Commande #${order.id.slice(0, 8)}`,
      paymentMethod: body.paymentMethod,
      customer: body.customer,
      metadata: {
        order_id: order.id,
        user_id: order.clientId,
      },
      successUrl: body.successUrl,
      errorUrl: body.errorUrl,
    });

    // Calculer la commission (1.5%)
    const commissionAmount = body.amount * 0.015;

    // Sauvegarder la transaction
    const tx = this.transactionRepository.create({
      orderId: order.id,
      amount: body.amount,
      commissionAmount,
      paymentMethod: PaymentMethod.CASH, // Sera mis à jour via webhook
      reference: payment.reference,
      paymentGatewayId: String(payment.id),
      status: TransactionStatus.PENDING,
    });
    await this.transactionRepository.save(tx);

    return {
      success: true,
      data: {
        reference: payment.reference,
        checkoutUrl: payment.checkout_url,
        paymentUrl: payment.payment_url,
        status: payment.status,
      },
    };
  }

  /**
   * 🔍 Vérifier le statut d'un paiement
   */
  @Get('payment/:reference')
  @ApiOperation({ summary: 'Vérifier le statut d\'un paiement GeniusPay' })
  async getPayment(@Param('reference') reference: string) {
    const payment = await this.geniusPayService.getPayment(reference);
    return { success: true, data: payment };
  }

  /**
   * 💰 Solde du compte GeniusPay
   */
  @Get('balance')
  @ApiOperation({ summary: 'Consulter le solde GeniusPay' })
  async getBalance() {
    const balance = await this.geniusPayService.getBalance();
    return { success: true, data: balance };
  }

  /**
   * 🏪 Informations du compte
   */
  @Get('account')
  @ApiOperation({ summary: 'Informations du compte GeniusPay' })
  async getAccount() {
    const account = await this.geniusPayService.getAccount();
    return { success: true, data: account };
  }

  /**
   * 📱 Fournisseurs MMO disponibles
   */
  @Get('providers')
  @ApiOperation({ summary: 'Fournisseurs MMO disponibles' })
  async getProviders(@Req() req: any) {
    const country = req.query?.country;
    const providers = await this.geniusPayService.getProviders(country);
    return { success: true, data: providers };
  }

  /**
   * 📋 Lister les paiements
   */
  @Get('payments')
  @ApiOperation({ summary: 'Lister les paiements GeniusPay' })
  async listPayments(@Req() req: any) {
    const result = await this.geniusPayService.listPayments({
      status: req.query?.status,
      paymentMethod: req.query?.payment_method,
      from: req.query?.from,
      to: req.query?.to,
      search: req.query?.search,
      perPage: req.query?.per_page ? parseInt(req.query.per_page) : undefined,
      page: req.query?.page ? parseInt(req.query.page) : undefined,
    });
    return result;
  }

  /**
   * 🔔 Webhook GeniusPay — Notifications de paiement
   */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Webhook GeniusPay — notifications de paiement' })
  async handleWebhook(
    @Body() payload: any,
    @Headers('x-webhook-signature') signature: string,
    @Headers('x-webhook-timestamp') timestamp: string,
    @Headers('x-webhook-event') event: string,
    @Headers('x-webhook-environment') environment: string,
  ) {
    this.logger.log(`🔔 GeniusPay webhook received: ${event}`);

    // Vérifier la signature
    const webhookSecret = this.configService.get<string>('GENIUSPAY_WEBHOOK_SECRET', '');
    if (webhookSecret && signature && timestamp) {
      const bodyStr = JSON.stringify(payload);
      const isValid = this.geniusPayService.verifyWebhookSignature(
        bodyStr,
        signature,
        timestamp,
        webhookSecret,
      );

      if (!isValid) {
        this.logger.error('❌ Invalid GeniusPay webhook signature');
        return { success: false, error: 'Invalid signature' };
      }
    }

    // Traiter l'événement
    try {
      switch (event) {
        case 'payment.success':
          await this.handlePaymentSuccess(payload);
          break;
        case 'payment.failed':
          await this.handlePaymentFailed(payload);
          break;
        case 'payment.cancelled':
          await this.handlePaymentCancelled(payload);
          break;
        case 'payment.refunded':
          await this.handlePaymentRefunded(payload);
          break;
        default:
          this.logger.log(`ℹ️ Unhandled event: ${event}`);
      }

      return { success: true };
    } catch (error: any) {
      this.logger.error(`❌ Webhook processing error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  private async handlePaymentSuccess(payload: any) {
    const data = payload.data;
    const orderId = data.metadata?.order_id;

    if (orderId) {
      // Mettre à jour la commande
      await this.orderRepository.update(orderId, {
        paymentStatus: 'paid',
        status: 'CONFIRMED',
      } as any);

      // Mettre à jour la transaction
      await this.transactionRepository.update(
        { reference: data.reference },
        { status: TransactionStatus.SUCCESS },
      );

      this.logger.log(`✅ Order ${orderId} marked as paid via GeniusPay`);
    }
  }

  private async handlePaymentFailed(payload: any) {
    const data = payload.data;
    const orderId = data.metadata?.order_id;

    if (orderId) {
      await this.orderRepository.update(orderId, {
        paymentStatus: 'failed',
      } as any);

      await this.transactionRepository.update(
        { reference: data.reference },
        { status: TransactionStatus.FAILED },
      );

      this.logger.log(`❌ Order ${orderId} payment failed via GeniusPay`);
    }
  }

  private async handlePaymentCancelled(payload: any) {
    const data = payload.data;
    const orderId = data.metadata?.order_id;

    if (orderId) {
      await this.orderRepository.update(orderId, {
        paymentStatus: 'cancelled',
      } as any);

      await this.transactionRepository.update(
        { reference: data.reference },
        { status: TransactionStatus.FAILED },
      );
    }
  }

  private async handlePaymentRefunded(payload: any) {
    const data = payload.data;
    const orderId = data.metadata?.order_id;

    if (orderId) {
      await this.orderRepository.update(orderId, {
        paymentStatus: 'refunded',
      } as any);

      await this.transactionRepository.update(
        { reference: data.reference },
        { status: TransactionStatus.REFUNDED },
      );
    }
  }
}
