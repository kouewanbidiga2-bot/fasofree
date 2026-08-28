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
import { PayOrderDto } from './dto/pay-order.dto';
import { WaveWebhookGuard } from './guards/webhook-signature.guard';
import { LigdiCashService } from './providers/ligdicash.service';
import { MockPaymentService } from './providers/mock-payment.service';
import { YengaPayService } from './providers/yengapay.service';
import { PayDunyaService } from './providers/paydunya.service';
import { isMockProvider } from '../../config/payment.config';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly ligdiCashService: LigdiCashService,
    private readonly mockPaymentService: MockPaymentService,
    private readonly yengaPayService: YengaPayService,
    private readonly payDunyaService: PayDunyaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 💳 1. Endpoint protégé : Initier un paiement
   * Accessible uniquement par les utilisateurs connectés (Client/Marchand)
   */
  @ApiBearerAuth('JWT-auth')
  @UseGuards(AuthGuard('jwt'))
  @Post('initiate')
  @ApiOperation({ summary: 'Initier un paiement pour une commande' })
  async initiatePayment(
    @Request() req: Request & { user?: { userId?: string } },
    @Body() dto: InitiatePaymentDto,
  ) {
    const userId = req.user?.userId;
    return this.paymentsService.initiatePayment(dto, userId as string);
  }

  /**
   * 💰 1bis. Recharger son portefeuille FasoFree.
   * Avec PAYMENT_PROVIDER=mock : crédit immédiat + reçu automatique.
   */
  @ApiBearerAuth('JWT-auth')
  @UseGuards(AuthGuard('jwt'))
  @Post('topup')
  @ApiOperation({ summary: 'Recharger son portefeuille (Mock ou Mobile Money)' })
  async topup(
    @Request() req: Request & { user?: { userId?: string } },
    @Body() dto: TopupDto,
  ) {
    const userId = req.user?.userId as string;
    if (isMockProvider(this.configService)) {
      return this.mockPaymentService.topup(userId, dto);
    }
    return this.ligdiCashService.initiateTopup(userId, dto);
  }

  /**
   * 🧪 1ter. Payer une commande en mode simulation (aucune clé requise).
   * Marque la commande PAID et déclenche le dispatch des livreurs.
   */
  @ApiBearerAuth('JWT-auth')
  @UseGuards(AuthGuard('jwt'))
  @Post('mock/pay-order')
  @ApiOperation({
    summary: '[Mock] Payer une commande et déclencher la livraison',
  })
  async mockPayOrder(
    @Request() req: Request & { user?: { userId?: string } },
    @Body() dto: PayOrderDto,
  ) {
    const userId = req.user?.userId as string;
    return this.mockPaymentService.payOrder(dto.orderId, userId);
  }

  /**
   * 🌊 2. Webhook sécurisé pour WAVE
   * Endpoint public appelé directement de serveur à serveur par Wave
   */
  @Post('webhook/wave')
  @ApiHeader({
    name: 'x-wave-signature',
    required: true,
    description: 'Signature HMAC fournie par Wave',
  })
  @ApiOperation({ summary: 'Recevoir la confirmation de paiement Wave' })
  @UseGuards(WaveWebhookGuard) // 🛡️ Le Guard est maintenant BIEN appliqué ici
  @HttpCode(HttpStatus.OK)
  async handleWaveWebhook(@Body() payload: unknown) {
    return this.paymentsService.handleWaveWebhook(payload);
  }

  /**
   * 🟠 3. Webhook pour LIGDICASH (Orange Money / Moov Money)
   * Endpoint public appelé par LigdiCash
   */
  @Post('webhook/ligdicash')
  @ApiHeader({
    name: 'x-ligdicash-token',
    required: true,
    description: 'Jeton de vérification LigdiCash',
  })
  @ApiOperation({ summary: 'Recevoir la confirmation de paiement LigdiCash' })
  @HttpCode(HttpStatus.OK)
  async handleLigdicashWebhook(
    @Body() payload: unknown,
    @Headers('x-ligdicash-token') token: string,
  ) {
    return this.paymentsService.handleLigdicashWebhook(payload, token);
  }

  /**
   * 4. Webhook YengaPay (Orange Money / Moov Money / Telecel Money)
   * Endpoint public : POST /payments/yengapay/webhook
   * Vérifie la signature HMAC-SHA256 via x-webhook-hash
   */
  @Post('webhook/yengapay')
  @ApiHeader({
    name: 'x-webhook-hash',
    required: true,
    description: 'Signature HMAC-SHA256 du payload YengaPay',
  })
  @ApiOperation({ summary: 'Recevoir la confirmation de paiement YengaPay' })
  @HttpCode(HttpStatus.OK)
  async handleYengaPayWebhook(
    @Body() payload: any,
    @Headers('x-webhook-hash') webhookHash: string,
  ) {
    if (!this.yengaPayService.isConfigured()) {
      this.logger.warn('Webhook YengaPay reçu mais YengaPay n\'est pas configuré');
      return { ok: false, error: 'YengaPay not configured' };
    }

    if (webhookHash && !this.yengaPayService.verifyWebhookSignature(payload, webhookHash)) {
      this.logger.warn('Webhook YengaPay: signature invalide');
      return { ok: false, error: 'Invalid signature' };
    }

    const { orderId, transactionRef, status, amount } =
      this.yengaPayService.extractOrderInfo(payload);

    if (!orderId || !transactionRef) {
      this.logger.warn('Webhook YengaPay: orderId ou transactionRef manquant', payload);
      return { ok: false, error: 'Missing orderId or transactionRef' };
    }

    if (status === 'SUCCESS') {
      await this.paymentsService.processSuccessfulPayment(
        orderId,
        transactionRef,
        'YENGAPAY',
      );
      this.logger.log(
        `YengaPay webhook traité: commande ${orderId} marquée PAID`,
      );
    } else {
      this.logger.warn(
        `YengaPay webhook: paiement échoué pour la commande ${orderId}`,
      );
    }

    return { ok: true };
  }

  /**
   * 5. Webhook PayDunya (Orange Money Burkina / Moov Money Burkina)
   * Endpoint public : POST /payments/paydunya/webhook
   * PayDunya envoie les données en application/x-www-form-urlencoded
   */
  @Post('paydunya/webhook')
  @ApiOperation({ summary: 'Recevoir la confirmation de paiement PayDunya' })
  @HttpCode(HttpStatus.OK)
  async handlePayDunyaWebhook(@Body() payload: any) {
    this.logger.log('Webhook PayDunya reçu');

    if (!this.payDunyaService.isConfigured()) {
      this.logger.warn('Webhook PayDunya reçu mais PayDunya n\'est pas configuré');
      return { response_code: '00', response_text: 'OK' };
    }

    // PayDunya envoie les données dans un champ "data" ou directement en body
    const data = payload?.data || payload;

    if (!data || !data.invoice) {
      this.logger.warn('Webhook PayDunya: payload invalide');
      return { response_code: '00', response_text: 'OK' };
    }

    const { orderId, transactionRef, status, amount } =
      this.payDunyaService.extractOrderInfo(data);

    if (!orderId || !transactionRef) {
      this.logger.warn('Webhook PayDunya: orderId ou transactionRef manquant', data);
      return { response_code: '00', response_text: 'OK' };
    }

    if (status === 'SUCCESS') {
      await this.paymentsService.processSuccessfulPayment(
        orderId,
        transactionRef,
        'PAYDUNYA',
      );
      this.logger.log(
        `PayDunya webhook traité: commande ${orderId} marquée PAID`,
      );
    } else {
      this.logger.warn(
        `PayDunya webhook: paiement ${status} pour la commande ${orderId}`,
      );
    }

    return { response_code: '00', response_text: 'OK' };
  }

  /**
   * 6. Vérifier le statut d'un paiement PayDunya
   */
  @ApiBearerAuth('JWT-auth')
  @UseGuards(AuthGuard('jwt'))
  @Get('paydunya/status/:token')
  @ApiOperation({ summary: 'Vérifier le statut d\'un paiement PayDunya' })
  async checkPayDunyaStatus(@Param('token') token: string) {
    return this.payDunyaService.verifyPayment(token);
  }
}
