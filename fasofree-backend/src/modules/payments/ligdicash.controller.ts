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
import { TopupDto } from './dto/topup.dto';
import { LigdiCashWebhookDto } from './dto/ligdicash-webhook.dto';
import { OrdersService } from '../orders/orders.service';
import { WalletService } from '../wallets/wallet.service';
import { UserRole as WalletUserRole } from '../wallets/entities/wallet.entity';
import { TransactionReason } from '../wallets/entities/wallet-transaction.entity';
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
    private readonly walletService: WalletService,
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
   * 1bis. 💰 Recharge du portefeuille virtuel (dépôt Mobile Money)
   */
  @Post('topup')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Recharger son portefeuille FasoFree (Mobile Money)',
  })
  async initiateTopup(
    @NestRequest() req: RequestWithUser,
    @Body() dto: TopupDto,
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Utilisateur non authentifié');
    }
    return this.ligdiCashService.initiateTopup(userId, dto);
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

    const completed =
      payload.status === 'completed' || payload.response_code === '00';

    // 💰 RECHARGE DE PORTEFEUILLE : on crédite le wallet virtuel du client
    if (payload.custom_data?.purpose === 'TOPUP') {
      const { clientId, amount } = payload.custom_data;
      if (!clientId || !amount) {
        this.logger.warn(
          '[Webhook Invalid] clientId ou amount manquant (TOPUP)',
        );
        return { status: 'rejected', reason: 'Missing clientId or amount' };
      }

      if (!completed) {
        this.logger.warn(
          `[Wallet Topup Failed] Recharge ${payload.transaction_id} non aboutie pour ${clientId}`,
        );
        return { status: 'success' };
      }

      await this.walletService.creditWallet(
        clientId,
        WalletUserRole.CUSTOMER,
        Number(amount),
        TransactionReason.TOPUP,
        payload.transaction_id,
        'Recharge portefeuille FasoFree via Mobile Money',
      );
      this.logger.log(
        `[Wallet Topup] +${amount} FCFA crédités au wallet ${clientId} (${payload.transaction_id})`,
      );
      return { status: 'success' };
    }

    // 🛍️ PAIEMENT DE COMMANDE : flux classique
    const orderId = payload.custom_data?.orderId;
    if (!orderId) {
      this.logger.warn('[Webhook Invalid] Aucun orderId dans custom_data');
      throw new BadRequestException('ID de commande manquant');
    }

    // 🚀 Mise à jour de la commande & déclenchement du Ledger + Dispatch
    if (completed) {
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
