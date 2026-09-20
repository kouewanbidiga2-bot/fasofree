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
  UseGuards,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { GeniusPayService } from './providers/geniuspay.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Roles } from '../../core/security/roles.decorator';
import { RolesGuard } from '../../core/security/roles.guard';
import { UserRole } from '../users/entities/user-role.enum';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { Transaction, TransactionStatus, PaymentMethod } from './entities/transaction.entity';
import { OrdersService } from '../orders/orders.service';

@ApiTags('GeniusPay')
@Controller('geniuspay')
export class GeniusPayController {
  private readonly logger = new Logger(GeniusPayController.name);

  constructor(
    private readonly geniusPayService: GeniusPayService,
    private readonly configService: ConfigService,
    private readonly ordersService: OrdersService,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
  ) {}

  /**
   * 💳 Initier un paiement GeniusPay
   */
  @Post('pay')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Initier un paiement GeniusPay' })
  async createPayment(
    @Body() body: {
      orderId: string;
      paymentMethod?: string;
      customer?: { name?: string; email?: string; phone?: string };
      successUrl?: string;
      errorUrl?: string;
    },
    @Req() req: any,
  ) {
    const order = await this.orderRepository.findOne({
      where: { id: body.orderId },
    });

    if (!order) {
      return { success: false, error: 'Commande introuvable' };
    }

    if (order.clientId !== req.user?.userId) {
      throw new ForbiddenException('Cette commande ne vous appartient pas');
    }

    if ([
      OrderStatus.PAID,
      OrderStatus.IN_PREPARATION,
      OrderStatus.READY_FOR_PICKUP,
      OrderStatus.DRIVER_ASSIGNED,
      OrderStatus.PROCESSING,
      OrderStatus.IN_DELIVERY,
      OrderStatus.DELIVERED_PENDING_CONFIRMATION,
      OrderStatus.DELIVERED,
      OrderStatus.COMPLETED,
      OrderStatus.DISPUTED,
      OrderStatus.REFUNDED,
    ].includes(order.status)) {
      throw new BadRequestException('Cette commande ne peut plus être payée');
    }

    const amount = Number(order.totalAmount);

    const payment = await this.geniusPayService.createPayment({
      amount,
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

    const commissionAmount = Number(order.merchantCommissionAmount ?? order.platformCommission ?? 0);

    const tx = this.transactionRepository.create({
      orderId: order.id,
      amount,
      commissionAmount,
      paymentMethod: Object.values(PaymentMethod).includes(body.paymentMethod as PaymentMethod)
        ? (body.paymentMethod as PaymentMethod)
        : PaymentMethod.ORANGE_MONEY,
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
   * 🔍 Vérifier le statut d'un paiement (client propriétaire / admin)
   */
  @Get('payment/:reference')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  @ApiOperation({ summary: 'Vérifier le statut d\'un paiement GeniusPay' })
  async getPayment(@Param('reference') reference: string) {
    const payment = await this.geniusPayService.getPayment(reference);
    return { success: true, data: payment };
  }

  /**
   * 💰 Solde du compte GeniusPay (admin uniquement)
   */
  @Get('balance')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Consulter le solde GeniusPay' })
  async getBalance() {
    const balance = await this.geniusPayService.getBalance();
    return { success: true, data: balance };
  }

  /**
   * 🏪 Informations du compte (admin uniquement)
   */
  @Get('account')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Informations du compte GeniusPay' })
  async getAccount() {
    const account = await this.geniusPayService.getAccount();
    return { success: true, data: account };
  }

  /**
   * 📱 Fournisseurs MMO disponibles (public authentifié)
   */
  @Get('providers')
  @ApiOperation({ summary: 'Fournisseurs MMO disponibles' })
  async getProviders(@Req() req: any) {
    const country = req.query?.country;
    const providers = await this.geniusPayService.getProviders(country);
    return { success: true, data: providers };
  }

  /**
   * 📋 Lister les paiements (admin uniquement)
   */
  @Get('payments')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
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
  @ApiOperation({ summary: 'Webhook GeniusPay — notifications de paiement' })
  async handleWebhook(
    @Body() payload: any,
    @Headers('x-webhook-signature') signature: string,
    @Headers('x-webhook-timestamp') timestamp: string,
    @Headers('x-webhook-event') event: string,
    @Headers('x-webhook-environment') environment: string,
  ) {
    this.logger.log(`🔔 GeniusPay webhook received: ${event}`);

    // Vérifier la signature — obligatoire (fail-closed). Sans secret configuré,
    // on rejette les webhooks plutôt que de les accepter silencieusement.
    const webhookSecret = this.configService.get<string>('GENIUSPAY_WEBHOOK_SECRET', '');
    if (!webhookSecret) {
      this.logger.error('❌ GENIUSPAY_WEBHOOK_SECRET non configuré — webhook rejeté');
      throw new ForbiddenException('Webhook not configured');
    }

    if (!signature || !timestamp) {
      this.logger.error('❌ Missing webhook signature or timestamp');
      throw new ForbiddenException('Missing signature');
    }
    const bodyStr = JSON.stringify(payload);
    const isValid = this.geniusPayService.verifyWebhookSignature(
      bodyStr,
      signature,
      timestamp,
      webhookSecret,
    );

    if (!isValid) {
      this.logger.error('❌ Invalid GeniusPay webhook signature');
      throw new ForbiddenException('Invalid signature');
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
      throw error;
    }
  }

  private async handlePaymentSuccess(payload: any) {
    const data = payload.data;
    const orderId = data.metadata?.order_id;

    if (!orderId) {
      this.logger.warn('Webhook GeniusPay: order_id manquant dans metadata');
      throw new BadRequestException('Webhook order_id manquant');
    }

    const order = await this.orderRepository.findOne({ where: { id: orderId } });
    if (!order) {
      this.logger.error(`Webhook GeniusPay: commande ${orderId} introuvable`);
      throw new BadRequestException('Commande du webhook introuvable');
    }

    // 🔒 Idempotence : ignorer si déjà payée (AVANT validation du montant)
    const terminalPaidStatuses: OrderStatus[] = [
      OrderStatus.PAID,
      OrderStatus.IN_PREPARATION,
      OrderStatus.READY_FOR_PICKUP,
      OrderStatus.DRIVER_ASSIGNED,
      OrderStatus.PROCESSING,
      OrderStatus.IN_DELIVERY,
      OrderStatus.DELIVERED_PENDING_CONFIRMATION,
      OrderStatus.DELIVERED,
      OrderStatus.COMPLETED,
      OrderStatus.DISPUTED,
      OrderStatus.REFUNDED,
    ];
    if (terminalPaidStatuses.includes(order.status)) {
      this.logger.warn(`Webhook GeniusPay: commande ${orderId} déjà au statut ${order.status} — ignoré`);
      return;
    }

    // 🔒 Vérification du montant — empêcher les falsifications
    const receivedAmount = Number(data.amount ?? payload.amount);
    const expectedAmount = Number(order.totalAmount);
    if (!Number.isFinite(receivedAmount) || Math.abs(expectedAmount - receivedAmount) > 1) {
      this.logger.error(
        `Webhook GeniusPay: montant incohérent pour ${orderId} — attendu ${expectedAmount}, reçu ${receivedAmount}`,
      );
      // Marquer UNIQUEMENT les transactions encore PENDING
      await this.transactionRepository.update(
        { orderId, status: TransactionStatus.PENDING },
        { status: TransactionStatus.FAILED },
      );
      await this.ordersService.markAsPaymentFailed(orderId);
      return;
    }

    const transactionRef = data.reference || String(data.id);

    await this.transactionRepository.update(
      { reference: transactionRef },
      { status: TransactionStatus.SUCCESS },
    );

    await this.ordersService.markAsPaidAndDispatch(orderId, transactionRef);

    this.logger.log(`✅ Order ${orderId} marked as paid via GeniusPay`);
  }

  private async handlePaymentFailed(payload: any) {
    const data = payload.data;
    const orderId = data.metadata?.order_id;
    const geniusPayRef = data.reference || String(data.id);

    if (orderId) {
      // Trouver la transaction par orderId OU par référence GeniusPay
      const transaction = await this.transactionRepository.findOne({
        where: [
          { orderId, status: TransactionStatus.PENDING },
          { reference: geniusPayRef, status: TransactionStatus.PENDING },
          { paymentGatewayId: geniusPayRef, status: TransactionStatus.PENDING },
        ],
      });

      if (transaction) {
        await this.transactionRepository.update(transaction.id, {
          status: TransactionStatus.FAILED,
        });
      } else {
        this.logger.warn(
          `Webhook failed: aucune transaction PENDING trouvée pour commande ${orderId}, ref ${geniusPayRef}`,
        );
      }

      try {
        await this.ordersService.markAsPaymentFailed(orderId);
      } catch (error) {
        this.logger.error(
          `Erreur annulation commande ${orderId} après échec paiement: ${error.message}`,
        );
      }

      this.logger.log(`❌ Order ${orderId} payment failed via GeniusPay`);
    }
  }

  private async handlePaymentCancelled(payload: any) {
    const data = payload.data;
    const orderId = data.metadata?.order_id;
    const geniusPayRef = data.reference || String(data.id);

    if (orderId) {
      // Trouver la transaction par orderId OU par référence GeniusPay
      const transaction = await this.transactionRepository.findOne({
        where: [
          { orderId, status: TransactionStatus.PENDING },
          { reference: geniusPayRef, status: TransactionStatus.PENDING },
          { paymentGatewayId: geniusPayRef, status: TransactionStatus.PENDING },
        ],
      });

      if (transaction) {
        await this.transactionRepository.update(transaction.id, {
          status: TransactionStatus.FAILED,
        });
      } else {
        this.logger.warn(
          `Webhook cancelled: aucune transaction PENDING trouvée pour commande ${orderId}, ref ${geniusPayRef}`,
        );
      }

      try {
        await this.ordersService.markAsPaymentFailed(orderId);
      } catch (error) {
        this.logger.error(
          `Erreur annulation commande ${orderId} après annulation paiement: ${error.message}`,
        );
      }

      this.logger.log(`❌ Order ${orderId} payment cancelled via GeniusPay`);
    }
  }

  private async handlePaymentRefunded(payload: any) {
    const data = payload.data;
    const orderId = data.metadata?.order_id;
    const geniusPayRef = data.reference || String(data.id);

    // Trouver la transaction par orderId OU par référence GeniusPay
    const transaction = await this.transactionRepository.findOne({
      where: [
        { orderId, status: TransactionStatus.SUCCESS },
        { reference: geniusPayRef, status: TransactionStatus.SUCCESS },
        { paymentGatewayId: geniusPayRef, status: TransactionStatus.SUCCESS },
      ],
    });

    if (transaction) {
      await this.transactionRepository.update(transaction.id, {
        status: TransactionStatus.REFUNDED,
      });
      await this.ordersService.markOrderAsRefunded(orderId);
    } else {
      this.logger.warn(
        `Webhook refunded: aucune transaction SUCCESS trouvée pour ref ${geniusPayRef}`,
      );
    }
  }
}
