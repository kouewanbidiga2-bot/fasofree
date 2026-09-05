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

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly geniusPayService: GeniusPayService,
    private readonly configService: ConfigService,
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
    return this.paymentsService.initiatePayment(dto, userId as string);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(AuthGuard('jwt'))
  @Post('topup')
  @ApiOperation({ summary: 'Recharger son portefeuille via GeniusPay' })
  async topup(
    @Request() req: Request & { user?: { userId?: string } },
    @Body() dto: TopupDto,
  ) {
    const userId = req.user?.userId as string;

    try {
      const payment = await this.geniusPayService.createPayment({
        amount: dto.amount,
        description: `Recharge portefeuille FasoFree - ${dto.customerName || userId}`,
        customer: {
          name: dto.customerName || 'Client FasoFree',
          email: dto.customerEmail || 'client@fasofree.bf',
        },
        metadata: { type: 'topup', userId },
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
  async handleGeniusPayWebhook(@Body() payload: any) {
    this.logger.log('Webhook GeniusPay reçu');

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
      this.logger.warn(
        `GeniusPay webhook: paiement échoué (${payload.status})`,
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
