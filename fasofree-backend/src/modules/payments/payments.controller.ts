/**
 * Copyright (c) 2026 BIDIGA Imrane - Koliwa. All rights reserved.
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
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentsService } from './payments.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { TopupDto } from './dto/topup.dto';
import { SasPayService } from './providers/saspay.service';
import { PayoutsService } from '../wallets/payouts.service';
import { OrdersService } from '../orders/orders.service';
import { Transaction, TransactionStatus } from './entities/transaction.entity';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly paymentsService: PaymentsService,
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
  @ApiOperation({ summary: 'Initier un paiement pour une commande via SasPay' })
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
    summary: "Statut RÉEL d'un paiement (interroge SasPay — ne renvoie jamais 'payé' sans encaissement)",
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
    summary: "Réconciliation ADMIN d'un paiement (statut réel SasPay, même logique que le client)",
  })
  async reconcileAdmin(@Param('orderId') orderId: string) {
    return this.paymentsService.reconcileOrderPaymentAdmin(orderId);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(AuthGuard('jwt'))
  @Post('topup')
  @ApiOperation({ summary: 'Recharger son portefeuille via SasPay' })
  async topup(
    @Request() req: Request & { user?: { userId?: string; role?: string } },
    @Body() dto: TopupDto,
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Utilisateur non authentifié');
    }

    try {
      const result = await this.paymentsService.createTopup({
        userId,
        role: String(req.user?.role ?? ''),
        branchId: dto.branchId,
        amount: Number(dto.amount),
        paymentMethod: dto.paymentMethod,
        customerName: dto.customerName,
        customerEmail: dto.customerEmail,
      });
      return {
        success: true,
        reference: result.reference,
        checkoutUrl: result.checkoutUrl,
        paymentUrl: result.checkoutUrl,
        message: result.checkoutUrl
          ? 'Redirection vers SasPay pour le paiement.'
          : 'Confirmez le paiement sur votre téléphone.',
      };
    } catch (err) {
      this.logger.error(`Topup failed: ${(err as Error).message}`);
      throw err;
    }
  }

  @Post('webhook/saspay')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Webhook SasPay — paiements (PAIEMENT) et retraits (RETRAIT)' })
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

    // Signature sur le corps BRUT, contrôle d'âge inclus (cf. SasPayService).
    const rawBody = (request as any).rawBody?.toString();
    if (!rawBody || !this.sasPayService.verifyWebhookSignature(rawBody, signature ?? '', timestamp ?? '', secret)) {
      this.logger.error('Signature webhook SasPay invalide');
      throw new BadRequestException('Invalid webhook signature');
    }

    const data = payload?.data;
    if (!data?.id) {
      this.logger.warn(`[SasPay Webhook] ${event} sans identifiant — ignoré`);
      return { success: true };
    }
    const providerId = String(data.id);

    // ── Encaissements (paiements) ────────────────────────────────────────
    if (data.type === 'PAIEMENT' && event === 'transaction.success') {
      if (await this.paymentsService.settleTopupFromSasPay(providerId, 'SUCCESS')) {
        return { success: true };
      }
      // Réconciliation par l'id du paiement SasPay (notre référence FF-PAY n'est pas
      // renvoyée par SasPay ; elle est enregistrée dans paymentGatewayId à l'initiation).
      const transaction = await this.transactionRepository.findOne({
        where: { paymentGatewayId: providerId },
      });
      if (!transaction) {
        this.logger.warn(`[SasPay Webhook] Aucune commande pour le paiement ${providerId}`);
        return { success: true };
      }
      const receivedAmount = Number(data.net_amount ?? data.amount);
      const amountValid = await this.paymentsService.validatePaymentAmount(transaction.orderId, receivedAmount);
      if (!amountValid) {
        await this.transactionRepository.update(transaction.id, { status: TransactionStatus.FAILED });
        await this.ordersService.markAsPaymentFailed(transaction.orderId);
        this.logger.error(`❌ Montant SasPay invalide pour commande ${transaction.orderId}: ${receivedAmount}`);
        throw new BadRequestException('Amount mismatch');
      }
      await this.paymentsService.processSuccessfulPayment(transaction.orderId, transaction.reference, 'SASPAY');
      return { success: true };
    }

    if (data.type === 'PAIEMENT' && event === 'transaction.failed') {
      if (await this.paymentsService.settleTopupFromSasPay(providerId, 'FAILED')) {
        return { success: true };
      }
      const transaction = await this.transactionRepository.findOne({
        where: { paymentGatewayId: providerId },
      });
      if (transaction) {
        await this.transactionRepository.update(transaction.id, { status: TransactionStatus.FAILED });
        await this.ordersService.markAsPaymentFailed(transaction.orderId);
      }
      return { success: true };
    }

    // ── Retraits (virements sortants, type RETRAIT) ──────────────────────
    if (data.type === 'RETRAIT' && (event === 'transaction.success' || event === 'transaction.failed')) {
      const payout = await this.walletPayoutsService.findPayoutByIdentifier(providerId);
      if (payout) {
        if (event === 'transaction.success') {
          await this.walletPayoutsService.confirmProviderPayout(payout.id, providerId);
        } else {
          await this.walletPayoutsService.failPayout(payout.id, 'Virement refusé par SasPay');
        }
      }
      return { success: true };
    }

    return { success: true };
  }
}
