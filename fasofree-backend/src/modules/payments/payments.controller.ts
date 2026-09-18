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

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly geniusPayService: GeniusPayService,
    private readonly configService: ConfigService,
    private readonly ordersService: OrdersService,
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
  @ApiHeader({
    name: 'x-api-key',
    required: true,
    description: 'Clé API GeniusPay',
  })
  @ApiOperation({ summary: 'Recevoir la confirmation de paiement GeniusPay' })
  @HttpCode(HttpStatus.OK)
  async handleGeniusPayWebhook(
    @Body() payload: any,
    @Headers('x-signature') signature?: string,
    @Headers('x-timestamp') timestamp?: string,
  ) {
    this.logger.log('Webhook GeniusPay reçu');

    // 🔒 Vérification HMAC de la signature GeniusPay — fail-closed
    const webhookSecret = this.configService.get<string>('GENIUSPAY_WEBHOOK_SECRET', '');
    if (!webhookSecret) {
      this.logger.error('GENIUSPAY_WEBHOOK_SECRET non configuré — webhook rejeté');
      throw new BadRequestException('Webhook not configured');
    }
    if (!signature || !timestamp) {
      this.logger.error('Webhook GeniusPay : signature ou timestamp manquant — requête rejetée');
      throw new BadRequestException('Missing webhook signature');
    }
    const rawBody = JSON.stringify(payload);
    const isValid = this.geniusPayService.verifyWebhookSignature(
      rawBody,
      signature,
      timestamp,
      webhookSecret,
    );
    if (!isValid) {
      this.logger.error('Webhook GeniusPay : signature HMAC invalide — requête rejetée');
      throw new BadRequestException('Invalid webhook signature');
    }

    if (payload.status === 'SUCCESS' || payload.status === 'success') {
      const orderId = payload.metadata?.order_id;
      const transactionRef = payload.reference || payload.id;

      if (!orderId) {
        this.logger.warn('Webhook GeniusPay: order_id manquant dans metadata');
        return { ok: false, error: 'Missing order_id' };
      }

      const amountOk = await this.paymentsService.validatePaymentAmount(
        orderId,
        payload.amount,
      );
      if (!amountOk) {
        this.logger.error(
          `Webhook GeniusPay: montant incohérent pour la commande ${orderId}`,
        );
        return { ok: false, error: 'Amount mismatch' };
      }

      await this.paymentsService.processSuccessfulPayment(
        orderId,
        transactionRef,
        'GENIUSPAY',
      );
      this.logger.log(
        `GeniusPay webhook traité: commande ${orderId} marquée PAID`,
      );
    } else {
      // 🔒 Paiement échoué/annulé — annuler la commande pour éviter la préparation
      const failedOrderId = payload.metadata?.order_id;
      if (failedOrderId) {
        try {
          await this.ordersService.markAsPaymentFailed(failedOrderId);
        } catch (error) {
          this.logger.error(
            `Erreur annulation commande ${failedOrderId} après échec paiement: ${error.message}`,
          );
        }
      }
      this.logger.warn(
        `GeniusPay webhook: paiement échoué (${payload.status}) — commande ${failedOrderId || 'inconnue'} annulée`,
      );
    }

    return { ok: true };
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
