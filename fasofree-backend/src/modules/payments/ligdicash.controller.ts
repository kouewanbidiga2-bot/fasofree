import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
  Request as NestRequest,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { LigdiCashService } from './providers/ligdicash.service';
import { CreatePayinDto } from './dto/create-payin.dto';
import { LigdiCashWebhookDto } from './dto/ligdicash-webhook.dto';
import { OrdersService } from '../orders/orders.service';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request as ExpressRequest } from 'express';

type RequestWithUser = ExpressRequest & {
  user?: { userId?: string };
};

@ApiTags('LigdiCash')
@Controller('payments/ligdicash')
export class LigdiCashController {
  private readonly logger = new Logger(LigdiCashController.name);

  constructor(
    private readonly ligdiCashService: LigdiCashService,
    private readonly ordersService: OrdersService,
  ) {}

  /**
   * 1. Demande d'initialisation de paiement par le client
   */
  @Post('payin')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Créer une demande de paiement LigdiCash' })
  async initiatePayin(
    @NestRequest() req: RequestWithUser,
    @Body() dto: CreatePayinDto,
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Utilisateur non authentifié');
    }
    return this.ligdiCashService.initiatePayin(dto, userId);
  }

  /**
   * 2. Webhook LigdiCash (Callback asynchrone)
   * ⚡ Cet endpoint doit être public (pas de Guard JWT)
   */
  @Post('webhook')
  @ApiOperation({ summary: 'Recevoir le callback LigdiCash' })
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Body() payload: LigdiCashWebhookDto) {
    this.logger.log(
      `[LigdiCash Webhook Reçu] Token: ${payload.token} | Status: ${payload.status}`,
    );

    const orderId = payload.custom_data?.orderId;
    if (!orderId) {
      this.logger.warn('[Webhook Invalid] Aucun orderId dans custom_data');
      throw new BadRequestException('ID de commande manquant');
    }

    // 🛡️ SÉCURITÉ : Ne jamais faire confiance au seul corps du webhook.
    // On re-vérifie le statut directement auprès du serveur LigdiCash.
    const isVerified = await this.ligdiCashService.verifyTransactionStatus(
      payload.token,
    );

    if (!isVerified) {
      this.logger.error(
        `[Fraud Warning] La transaction ${payload.token} n'a pas pu être vérifiée chez LigdiCash`,
      );
      return { status: 'rejected', reason: 'Verification failed' };
    }

    // 🚀 Mise à jour de la commande & déclenchement du Ledger + Dispatch
    if (payload.status === 'completed' || payload.response_code === '00') {
      await this.ordersService.markAsPaidAndDispatch(
        orderId,
        payload.transaction_id,
      );
      this.logger.log(
        `[Order Paid] Commande ${orderId} marquée comme payée via LigdiCash (${payload.transaction_id})`,
      );
    } else {
      await this.ordersService.markAsPaymentFailed(orderId);
      this.logger.warn(`[Order Payment Failed] Commande ${orderId}`);
    }

    return { status: 'success' };
  }
}
