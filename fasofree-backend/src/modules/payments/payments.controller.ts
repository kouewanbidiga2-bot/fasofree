import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Headers,
  Request,
  Logger,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { TopupDto } from './dto/topup.dto';
import { GeniusPayService } from './providers/geniuspay.service';
import { OrdersService } from '../orders/orders.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction, TransactionStatus } from './entities/transaction.entity';
import { OrderStatus } from '../orders/entities/order.entity';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly geniusPayService: GeniusPayService,
    private readonly configService: ConfigService,
    private readonly ordersService: OrdersService,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
  ) {}

  @ApiBearerAuth('JWT-auth')
  @UseGuards(AuthGuard('jwt'))
  @Post('initiate')
  @ApiOperation({ summary: 'Initier un paiement pour une commande via GeniusPay' })
  async initiatePayment(
    @Request() req: Request & { user?: { userId?: string } },
    @Body() dto: InitiatePaymentDto,
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Utilisateur non authentifié');
    }
    return this.paymentsService.initiatePayment(dto, userId);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(AuthGuard('jwt'))
  @Post('topup')
  @ApiOperation({ summary: 'Recharger son portefeuille via GeniusPay' })
  async topup(
    @Request() req: Request & { user?: { userId?: string } },
    @Body() dto: TopupDto,
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Utilisateur non authentifié');
    }

    try {
      const topupRef = `TOPUP-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const payment = await this.geniusPayService.createPayment({
        amount: dto.amount,
        description: `Recharge portefeuille FasoFree - ${dto.customerName || userId}`,
        customer: {
          name: dto.customerName || 'Client FasoFree',
          email: dto.customerEmail || 'client@fasofree.bf',
        },
        metadata: { type: 'topup', userId, reference: topupRef },
      });
      return {
        success: true,
        transactionId: payment.reference,
        checkoutUrl: payment.checkout_url || payment.payment_url,
        paymentUrl: payment.payment_url,
        message: 'Redirection vers GeniusPay pour le paiement.',
      };
    } catch (err) {
      this.logger.error(`GeniusPay topup failed: ${err.message}`);
      throw err;
    }
  }

  @Post('webhook/geniuspay')
  @ApiOperation({ summary: '[DÉPRÉCIÉ] Redirige vers POST /geniuspay/webhook' })
  @HttpCode(HttpStatus.OK)
  async handleGeniusPayWebhookDeprecated(
    @Body() payload: any,
    @Headers('x-signature') signature?: string,
    @Headers('x-timestamp') timestamp?: string,
    @Headers('x-webhook-signature') whSignature?: string,
    @Headers('x-webhook-timestamp') whTimestamp?: string,
  ) {
    this.logger.warn('[DEPRECATED] /payments/webhook/geniuspay → traitement unifié');

    // Même vérification HMAC que /geniuspay/webhook
    const webhookSecret = this.configService.get<string>('GENIUSPAY_WEBHOOK_SECRET', '');
    if (!webhookSecret) {
      this.logger.error('GENIUSPAY_WEBHOOK_SECRET non configuré — webhook rejeté');
      throw new BadRequestException('Webhook not configured');
    }
    const sig = whSignature || signature;
    const ts = whTimestamp || timestamp;
    if (!sig || !ts) {
      throw new BadRequestException('Missing webhook signature');
    }
    const rawBody = JSON.stringify(payload);
    if (!this.geniusPayService.verifyWebhookSignature(rawBody, sig, ts, webhookSecret)) {
      throw new BadRequestException('Invalid webhook signature');
    }

    // Même traitement que /geniuspay/webhook
    const event = payload.event || payload.type || 'unknown';
    const data = payload.data || payload;
    const orderId = data.metadata?.order_id || payload.metadata?.order_id;
    const geniusPayRef = data.reference || String(data.id || '');

    try {
      if (event === 'payment.success' || payload.status === 'SUCCESS' || payload.status === 'success') {
        if (orderId) {
          // ✅ Sécurité : montant obligatoire et valide
          const receivedAmount = Number(data.amount ?? payload.amount);
          if (!Number.isFinite(receivedAmount)) {
            this.logger.error(`❌ Montant absent ou invalide pour commande ${orderId}`);
            await this.ordersService.markAsPaymentFailed(orderId);
            throw new BadRequestException('Amount missing or invalid');
          }
          const amountValid = await this.paymentsService.validatePaymentAmount(orderId, receivedAmount);
          if (!amountValid) {
            this.logger.error(`❌ Montant invalide pour commande ${orderId}: reçu ${receivedAmount}`);
            await this.ordersService.markAsPaymentFailed(orderId);
            throw new BadRequestException('Amount mismatch');
          }
          await this.paymentsService.processSuccessfulPayment(orderId, geniusPayRef, 'GENIUSPAY');
          this.logger.log(`✅ Order ${orderId} marked as paid (deprecated endpoint)`);
        }
      } else if (event === 'payment.failed' || event === 'payment.cancelled') {
        if (orderId) {
          const tx = await this.transactionRepository.findOne({
            where: [
              { orderId, status: TransactionStatus.PENDING },
              { reference: geniusPayRef, status: TransactionStatus.PENDING },
              { paymentGatewayId: geniusPayRef, status: TransactionStatus.PENDING },
            ],
          });
          if (tx) {
            await this.transactionRepository.update(tx.id, { status: TransactionStatus.FAILED });
          }
          await this.ordersService.markAsPaymentFailed(orderId);
          this.logger.log(`❌ Order ${orderId} payment ${event} (deprecated endpoint)`);
        }
      } else if (event === 'payment.refunded') {
        const tx = await this.transactionRepository.findOne({
          where: [
            { orderId, status: TransactionStatus.SUCCESS },
            { reference: geniusPayRef, status: TransactionStatus.SUCCESS },
            { paymentGatewayId: geniusPayRef, status: TransactionStatus.SUCCESS },
          ],
        });
        if (tx) {
          await this.transactionRepository.update(tx.id, { status: TransactionStatus.REFUNDED });
        }
      }
    } catch (error) {
      this.logger.error(`Webhook processing error: ${error.message}`);
      throw error;
    }

    return { success: true };
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(AuthGuard('jwt'))
  @Get('geniuspay/status/:ref')
  @ApiOperation({ summary: 'Vérifier le statut d\'un paiement GeniusPay' })
  async checkGeniusPayStatus(@Param('ref') ref: string) {
    return this.geniusPayService.getPayment(ref);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(AuthGuard('jwt'))
  @Get('geniuspay/providers')
  @ApiOperation({ summary: 'Lister les méthodes de paiement GeniusPay' })
  async listProviders(@Headers('x-country') country?: string) {
    return this.geniusPayService.getProviders(country || 'BF');
  }
}
