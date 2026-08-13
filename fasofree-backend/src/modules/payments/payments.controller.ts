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
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { WaveWebhookGuard } from './guards/webhook-signature.guard';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

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
