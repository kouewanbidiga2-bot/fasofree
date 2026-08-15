import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Headers,
  Request,
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
import { isMockProvider } from '../../config/payment.config';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly ligdiCashService: LigdiCashService,
    private readonly mockPaymentService: MockPaymentService,
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
}
