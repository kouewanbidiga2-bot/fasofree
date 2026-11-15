/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

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
import { RolesGuard } from '../../core/security/roles.guard';
import { Roles } from '../../core/security/roles.decorator';
import { UserRole } from '../users/entities/user-role.enum';
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
import { SasPayService } from './providers/saspay.service';
import { PayoutsService } from '../wallets/payouts.service';
import { randomBytes } from 'crypto';

/** Codes courts des rôles dans la référence de recharge Jeko (longueur ≤ 100). */
const TOPUP_ROLE_CODES: Record<string, string> = {
  BUSINESS_ADMIN: 'BA',
  MERCHANT: 'MR',
  AGENCY: 'AG',
  DRIVER: 'DR',
  COURIER: 'CO',
  CLIENT: 'CL',
  SUPER_ADMIN: 'SA',
};
const TOPUP_ROLE_FROM_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(TOPUP_ROLE_CODES).map(([role, code]) => [code, role]),
);
const SAFE_ID = /^[A-Za-z0-9-]{1,40}$/;
const TOPUP_REF = /^TOPUP_([A-Z]{2})_([A-Za-z0-9-]{1,40})_(NONE|[A-Za-z0-9-]{1,40})_([A-F0-9]{8})$/;
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
    private readonly sasPayService: SasPayService,
    private readonly walletPayoutsService: PayoutsService,
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
  @Get('status/:orderId')
  @ApiOperation({
    summary:
      "Statut RÉEL d'un paiement (interroge GeniusPay — ne renvoie jamais 'payé' sans encaissement)",
  })
  async getPaymentStatus(
    @Param('orderId') orderId: string,
    @Request() req: Request & { user?: { userId?: string } },
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Utilisateur non authentifié');
    }
    return this.paymentsService.reconcileOrderPayment(orderId, userId);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  @Get('admin/reconcile/:orderId')
  @ApiOperation({
    summary:
      "Réconciliation ADMIN d'un paiement (statut réel GeniusPay, même logique que le client)",
  })
  async reconcileAdmin(@Param('orderId') orderId: string) {
    return this.paymentsService.reconcileOrderPaymentAdmin(orderId);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(AuthGuard('jwt'))
  @Post('topup')
  @ApiOperation({ summary: 'Recharger son portefeuille via GeniusPay' })
  async topup(
    @Request() req: Request & { user?: { userId?: string; role?: string } },
    @Body() dto: TopupDto,
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Utilisateur non authentifié');
    }

    try {
      // La référence Jeko porte l'identité du crédit : le webhook n'a pas
      // d'autre moyen de savoir qui recharger. Chaque segment est validé.
      const roleCode = TOPUP_ROLE_CODES[String(req.user?.role ?? '').toUpperCase()] ?? 'XX';
      const branch = dto.branchId ? String(dto.branchId) : 'NONE';
      if (!SAFE_ID.test(userId) || (branch !== 'NONE' && !SAFE_ID.test(branch))) {
        throw new BadRequestException('Identifiant invalide pour la recharge');
      }
      const topupRef = `TOPUP_${roleCode}_${userId}_${branch}_${randomBytes(4).toString('hex').toUpperCase()}`;

      const clientUrl = (this.configService.get<string>('CLIENT_URL') || 'https://fasofree.site').replace(/\/+$/, '');
      const networkMap: Record<string, string> = {
        orange_money: 'orange_bf',
        moov_money: 'moov_bf',
        mtn_money: 'mtn_bf',
        wave: 'wave_bf',
      };
      const payment = await this.sasPayService.createPayment({
        amount: Number(dto.amount),
        currency: 'XOF',
        country: 'BF',
        customer: {
          email: dto.customerEmail || 'client@fasofree.bf',
          firstName: dto.customerName || 'Client',
          lastName: 'FasoFree',
          phone: '22670000000',
        },
        network: networkMap[dto.paymentMethod] ?? dto.paymentMethod,
        description: `Recharge portefeuille FasoFree - ${dto.customerName || userId}`,
        metadata: {
          type: 'topup',
          userId,
          reference: topupRef,
          walletRole: req.user?.role ? String(req.user.role) : undefined,
          branchId: dto.branchId ? String(dto.branchId) : undefined,
        },
        returnUrl: `${clientUrl}/?topup=success`,
        idempotencyKey: topupRef,
      });
      return {
        success: true,
        transactionId: payment.id,
        checkoutUrl: payment.checkoutUrl,
        paymentUrl: payment.checkoutUrl,
        message: 'Redirection vers SasPay pour le paiement.',
      };
    } catch (err) {
      this.logger.error(`Topup failed: ${err.message}`);
      throw err;
    }
  }

  @Post('webhook/geniuspay')
  @ApiOperation({ summary: '[DÉPRÉCIÉ] Redirige vers POST /geniuspay/webhook' })
  @HttpCode(HttpStatus.OK)
  async handleGeniusPayWebhookDeprecated(
    @Request() request: Request,
    @Body() payload: any,
    @Headers('x-signature') signature?: string,
    @Headers('x-timestamp') timestamp?: string,
    @Headers('x-webhook-signature') whSignature?: string,
    @Headers('x-webhook-timestamp') whTimestamp?: string,
    @Headers('x-webhook-event') webhookEvent?: string,
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
    // Vérification sur les octets bruts reçus (cf. geniuspay.controller).
    const rawBody =
      (request as any).rawBody?.toString() ?? JSON.stringify(payload);
    if (!this.geniusPayService.verifyWebhookSignature(rawBody, sig, ts, webhookSecret)) {
      throw new BadRequestException('Invalid webhook signature');
    }

    // Même traitement que /geniuspay/webhook
    const event = webhookEvent || payload.event || payload.type || 'unknown';
    const data = payload.data || payload;
    const metadata = data.extras || data.metadata || payload.metadata || {};
    const orderId = metadata.order_id;
    const geniusPayRef = data.reference || String(data.id || '');

    try {
      // 💳 RECHARGE DE PORTEFEUILLE (top-up) : aucune commande associée.
      // Sans ce branchement, une recharge encaissée via cette ANCIENNE URL ne
      // serait jamais créditée.
      if (metadata.type === 'topup') {
        if (
          event === 'payment.success' ||
          event === 'payin.successful' ||
          payload.status === 'SUCCESS' ||
          payload.status === 'success' ||
          data.status === 'SUCCESS'
        ) {
          await this.paymentsService.creditTopupFromGateway(data, payload);
        } else if (event === 'payment.refunded') {
          await this.paymentsService.reverseTopupFromGateway(data, payload);
        } else {
          this.logger.warn(
            `[DEPRECATED] Recharge ${metadata.reference}: événement ${event} sans effet`,
          );
        }
        return { success: true };
      }

      if (
        event === 'payment.success' ||
        event === 'payin.successful' ||
        payload.status === 'SUCCESS' ||
        payload.status === 'success' ||
        data.status === 'SUCCESS'
      ) {
        if (orderId) {
          // ✅ Sécurité : montant obligatoire et valide
          const receivedAmount = Number(data.amount ?? payload.amount);
          if (!Number.isFinite(receivedAmount)) {
            await this.transactionRepository.update(
              { orderId, status: TransactionStatus.PENDING },
              { status: TransactionStatus.FAILED },
            );
            this.logger.error(`❌ Montant absent ou invalide pour commande ${orderId}`);
            await this.ordersService.markAsPaymentFailed(orderId);
            throw new BadRequestException('Amount missing or invalid');
          }
          const amountValid = await this.paymentsService.validatePaymentAmount(orderId, receivedAmount);
          if (!amountValid) {
            await this.transactionRepository.update(
              { orderId, status: TransactionStatus.PENDING },
              { status: TransactionStatus.FAILED },
            );
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
          await this.ordersService.markOrderAsRefunded(orderId);
        }
      }
    } catch (error) {
      this.logger.error(`Webhook processing error: ${error.message}`);
      // Webhook authentifié et reçu : répondre 200 pour éviter les retries
      // infinis de l'ancienne URL. Les erreurs d'authentification restent 4xx.
      return { success: false, error: error.message };
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

  // === WEBHOOK Jeko ===

  @Post('webhook/saspay')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Webhook SasPay — transaction.success / settlement.success' })
  async handleSasPayWebhook(
    @Request() request: Request,
    @Body() payload: any,
    @Headers('x-webhook-signature') signature?: string,
    @Headers('x-webhook-timestamp') timestamp?: string,
    @Headers('x-webhook-event') event?: string,
  ) {
    const secret = this.sasPayService.webhookSecret;
    if (!secret) {
      this.logger.error('SASPAY_WEBHOOK_SECRET non configuré — webhook rejeté');
      throw new BadRequestException('Webhook not configured');
    }

    const rawBody = (request as any).rawBody?.toString();
    if (!rawBody || !this.sasPayService.verifyWebhookSignature(rawBody, signature ?? '', timestamp ?? '', secret)) {
      this.logger.error('Signature webhook SasPay invalide');
      throw new BadRequestException('Invalid webhook signature');
    }

    this.logger.log(`[SasPay Webhook] événement ${event} reçu`);

    // transaction.success → encaissement réussi
    if (event === 'transaction.success' && payload?.data?.type === 'PAIEMENT') {
      const reference: string | undefined = payload.data.reference;
      if (!reference) {
        this.logger.warn('[SasPay Webhook] Transaction sans référence — ignorée');
        return { success: true };
      }

      // Recharge de portefeuille
      const topup = TOPUP_REF.exec(reference);
      if (topup) {
        const [, roleCode, userId, branch] = topup;
        const credited = await this.paymentsService.creditTopupFromGateway(
          {
            status: 'SUCCESS',
            amount: Number(payload.data.net_amount ?? payload.data.amount),
            extras: {
              userId,
              reference,
              walletRole: TOPUP_ROLE_FROM_CODE[roleCode] ?? roleCode,
              ...(branch !== 'NONE' ? { branchId: branch } : {}),
            },
          },
          payload,
        );
        this.logger.log(`[SasPay Webhook] Recharge ${reference} ${credited ? 'créditée' : 'non créditée'}`);
        return { success: true };
      }

      const transaction = await this.transactionRepository.findOne({ where: { reference } });
      if (!transaction) {
        this.logger.warn(`[SasPay Webhook] Aucune transaction pour la référence ${reference}`);
        return { success: true };
      }

      const receivedAmount = Number(payload.data.net_amount ?? payload.data.amount);
      const amountValid = await this.paymentsService.validatePaymentAmount(transaction.orderId, receivedAmount);
      if (!amountValid) {
        await this.transactionRepository.update(transaction.id, { status: TransactionStatus.FAILED });
        await this.ordersService.markAsPaymentFailed(transaction.orderId);
        this.logger.error(`❌ Montant SasPay invalide pour commande ${transaction.orderId}: ${receivedAmount}`);
        throw new BadRequestException('Amount mismatch');
      }
      await this.paymentsService.processSuccessfulPayment(transaction.orderId, reference, 'SASPAY');
    }

    // transaction.failed → échec d'encaissement
    if (event === 'transaction.failed') {
      const reference: string | undefined = payload.data?.reference;
      if (reference) {
        const transaction = await this.transactionRepository.findOne({ where: { reference } });
        if (transaction) {
          await this.transactionRepository.update(transaction.id, { status: TransactionStatus.FAILED });
          await this.ordersService.markAsPaymentFailed(transaction.orderId);
        }
      }
    }

    // settlement.success → retrait réussi
    if (event === 'settlement.success') {
      const reference: string | undefined = payload.data?.reference;
      if (reference) {
        const payout = await this.walletPayoutsService.findPayoutByIdentifier(reference);
        if (payout) {
          await this.walletPayoutsService.confirmProviderPayout(payout.id, payload.data?.id);
        }
      }
    }

    // settlement.failed → retrait échoué
    if (event === 'settlement.failed') {
      const reference: string | undefined = payload.data?.reference;
      if (reference) {
        const payout = await this.walletPayoutsService.findPayoutByIdentifier(reference);
        if (payout) {
          await this.walletPayoutsService.failPayout(payout.id, 'Virement refusé par SasPay');
        }
      }
    }

    return { success: true };
  }
}
