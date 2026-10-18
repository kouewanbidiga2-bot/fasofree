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
import { PaydunyaService } from './providers/paydunya.service';
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
    private readonly paydunyaService: PaydunyaService,
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
  @ApiOperation({ summary: 'Recharger son portefeuille (provider actif : GeniusPay ou PayDunya)' })
  async topup(
    @Request() req: Request & { user?: { userId?: string; role?: string } },
    @Body() dto: TopupDto,
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Utilisateur non authentifié');
    }

    try {
      const provider = this.paymentsService['getActiveProvider']();
      if (provider === 'paydunya') {
        const result = await this.paymentsService.createPaydunyaTopup(userId, dto, req.user?.role || 'BUSINESS_ADMIN');
        return { success: true, ...result };
      }

      // GeniusPay (existant)
      const topupRef = `TOPUP-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const metadata: Record<string, string> = {
        type: 'topup',
        userId,
        reference: topupRef,
      };
      if (req.user?.role) metadata.walletRole = String(req.user.role);
      if (dto.branchId) metadata.branchId = String(dto.branchId);

      const payment = await this.geniusPayService.createPayment({
        amount: dto.amount,
        description: `Recharge portefeuille FasoFree - ${dto.customerName || userId}`,
        customer: {
          name: dto.customerName || 'Client FasoFree',
          email: dto.customerEmail || 'client@fasofree.bf',
        },
        metadata,
      });
      return {
        success: true,
        transactionId: payment.reference,
        checkoutUrl: payment.checkout_url || payment.payment_url,
        paymentUrl: payment.payment_url,
        message: 'Redirection vers GeniusPay pour le paiement.',
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
    const metadata = data.metadata || payload.metadata || {};
    const orderId = metadata.order_id;
    const geniusPayRef = data.reference || String(data.id || '');

    try {
      // 💳 RECHARGE DE PORTEFEUILLE (top-up) : aucune commande associée.
      // Sans ce branchement, une recharge encaissée via cette ANCIENNE URL ne
      // serait jamais créditée.
      if (metadata.type === 'topup') {
        if (
          event === 'payment.success' ||
          payload.status === 'SUCCESS' ||
          payload.status === 'success'
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

      if (event === 'payment.success' || payload.status === 'SUCCESS' || payload.status === 'success') {
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

  // ========================================================================
  // 💳 PAYDUNYA WEBHOOKS (Lot 4) — Routes EXACTES configurées dans la console PayDunya
  // IPN Payin :     https://fasofree-3nh8.onrender.com/api/v1/paydunya/webhook
  // Disburse Payout: https://fasofree-3nh8.onrender.com/api/v1/paydunya/disburse-webhook
  // ========================================================================

  @Post('paydunya/webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Webhook IPN PayDunya (Payin) — Vérification SHA-512 Master Key' })
  async handlePaydunyaWebhook(@Body() payload: any) {
    this.logger.log(`🔔 PayDunya IPN reçu: ${JSON.stringify(payload).slice(0, 300)}`);

    // PayDunya envoie les données sous la clé `data` (JSON ou form-urlencoded)
    const data = payload?.data ?? payload;

    // 🔒 SÉCURITÉ CRITIQUE : Vérification SHA-512 du hash (fail-closed)
    // Le hash reçu doit être égal à SHA512(PAYDUNYA_MASTER_KEY)
    const receivedHash = data?.hash ?? payload?.hash;
    try {
      this.paydunyaService.verifyIpnSignature(receivedHash);
    } catch (err) {
      this.logger.error(`❌ PayDunya IPN signature invalide: ${err.message}`);
      throw new BadRequestException('Invalid IPN signature');
    }

    const invoiceToken = data?.token ?? data?.invoice?.token;
    const status = data?.status ?? data?.invoice?.status;
    const amount = Number(data?.amount ?? data?.invoice?.total_amount ?? 0);
    const customData = data?.custom_data ?? data?.invoice?.custom_data ?? {};

    if (!invoiceToken) {
      this.logger.warn('PayDunya IPN: token de facture manquant');
      return { received: true }; // On répond 200 pour éviter les retries
    }

    try {
      const type = customData?.type;

      if (type === 'ORDER') {
        const orderId = customData?.order_id;
        if (orderId && status === 'completed') {
          // 🔒 Idempotence : on ne traite que si transaction PENDING
          const tx = await this.transactionRepository.findOne({
            where: { paymentGatewayId: invoiceToken, status: TransactionStatus.PENDING },
          });
          if (tx) {
            const amountValid = await this.paymentsService.validatePaymentAmount(orderId, amount);
            if (amountValid) {
              await this.paymentsService.processSuccessfulPayment(orderId, invoiceToken, 'PAYDUNYA');
              this.logger.log(`✅ Order ${orderId} payée via PayDunya (IPN)`);
            } else {
              this.logger.error(`❌ Montant invalide PayDunya pour ${orderId}: ${amount}`);
              await this.transactionRepository.update({ id: tx.id }, { status: TransactionStatus.FAILED });
              await this.ordersService.markAsPaymentFailed(orderId);
            }
          } else {
            this.logger.log(`PayDunya IPN ORDER ${orderId}: déjà traité ou introuvable (idempotence)`);
          }
        } else if (orderId && (status === 'failed' || status === 'cancelled')) {
          const tx = await this.transactionRepository.findOne({
            where: { paymentGatewayId: invoiceToken, status: TransactionStatus.PENDING },
          });
          if (tx) {
            await this.transactionRepository.update({ id: tx.id }, { status: TransactionStatus.FAILED });
            await this.ordersService.markAsPaymentFailed(orderId);
            this.logger.log(`❌ Order ${orderId} PayDunya ${status} (IPN)`);
          }
        }
      } else if (type === 'WALLET_TOPUP') {
        if (status === 'completed') {
          await this.paymentsService.processPaydunyaTopup(data);
        } else if (status === 'failed' || status === 'cancelled') {
          this.logger.log(`PayDunya topup ${customData?.reference}: ${status} — aucun crédit`);
        }
      }
    } catch (err) {
      this.logger.error(`PayDunya IPN processing error: ${err.message}`);
      // On répond 200 pour ne pas déclencher de retries infinis
    }

    return { received: true };
  }

  @Post('paydunya/disburse-webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Webhook PayDunya Disburse (Payout PER)' })
  async handlePaydunyaDisburseWebhook(@Body() payload: any) {
    this.logger.log(`🔔 PayDunya Disburse webhook: ${JSON.stringify(payload).slice(0, 300)}`);
    // PayDunya disburse envoie: { response_code, response_text, transaction_id, provider_ref, ... }
    const responseCode = payload?.response_code;
    const disburseId = payload?.disburse_id; // notre withdrawId
    const transactionId = payload?.transaction_id;
    const providerRef = payload?.provider_ref;
    const failureReason = payload?.response_text;

    if (disburseId) {
      // Ce webhook mettra à jour le PayoutRequest côté wallet (Lot 2)
      // Pour l'instant on loggue seulement
      this.logger.log(`PayDunya Disburse ${disburseId}: ${responseCode === '00' ? 'SUCCESS' : 'FAILED'} - ${failureReason ?? ''}`);
    }

    return { received: true };
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(AuthGuard('jwt'))
  @Get('paydunya/status/:token')
  @ApiOperation({ summary: 'Vérifier le statut d\'une facture PayDunya (réconciliation)' })
  async checkPaydunyaStatus(@Param('token') token: string) {
    return this.paydunyaService.confirmInvoiceStatus(token);
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
