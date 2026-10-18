import {
  Controller,
  ForbiddenException,
  Get,
  Post,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
  Headers,
  Logger,
  ValidationPipe,
  UsePipes,
} from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { WalletService } from './wallet.service';
import { PayoutsService } from './payouts.service';
import { PayoutStatus } from '../financial/entities/payout-request.entity';
import { UserRole } from './entities/wallet.entity';
import { RequestWithdrawalDto, ApprovePayoutDto } from './dto/request-withdrawal.dto';
import { AdminCreditWalletDto } from './dto/admin-credit-wallet.dto';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole as AppUserRole } from '../users/entities/user-role.enum';
import { BusinessesService } from '../businesses/businesses.service';
import { Roles } from '../../core/security/roles.decorator';
import { RolesGuard } from '../../core/security/roles.guard';

@ApiTags('Wallets')
@UseGuards(AuthGuard('jwt'))
@Controller('wallets')
export class WalletController {
  private readonly logger = new Logger(WalletController.name);

  constructor(
    private readonly walletService: WalletService,
    private readonly payoutsService: PayoutsService,
    private readonly configService: ConfigService,
    private readonly businessesService: BusinessesService,
  ) {}

  @Get('admin/payouts/pending')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(AppUserRole.SUPER_ADMIN)
  async listPendingManualPayouts() {
    return this.payoutsService.listPendingManualPayouts();
  }

  @Post('admin/payouts/:id/approve')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @Roles(AppUserRole.SUPER_ADMIN)
  async approveManualPayout(
    @Param('id') id: string,
    @Body() dto: ApprovePayoutDto,
  ) {
    return this.payoutsService.approveManualPayout(
      id,
      dto.phoneNumber,
      dto.provider,
    );
  }

  @Post('admin/payouts/:id/paid')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(AppUserRole.SUPER_ADMIN)
  async markManualPayoutPaid(
    @Param('id') id: string,
    @Body() body: { providerReference?: string },
  ) {
    return this.payoutsService.confirmPayout(id, body.providerReference);
  }

  @Post('admin/payouts/:id/reject')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(AppUserRole.SUPER_ADMIN)
  async rejectManualPayout(
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return this.payoutsService.failPayout(
      id,
      body.reason || 'Retrait rejeté par le SuperAdmin',
      PayoutStatus.REJECTED,
    );
  }

  /**
   * 💰 Crédit MANUEL d'un portefeuille (Super Admin uniquement).
   * POST /wallets/admin/credit
   *
   * Débloque les comptes qui ne peuvent pas encore se recharger seuls
   * (recharge GeniusPay en échec, encaissement hors plateforme) sans passer
   * par un script SQL. Une `reference` fournie rend le crédit idempotent.
   */
  @Post('admin/credit')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @Roles(AppUserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Créditer manuellement un portefeuille (Super Admin)',
  })
  async adminCredit(
    @Request()
    req: ExpressRequest & { user?: { userId?: string; role?: AppUserRole } },
    @Body() dto: AdminCreditWalletDto,
  ) {
    const actorId = req.user?.userId;
    if (!actorId) {
      throw new ForbiddenException('Utilisateur non authentifié');
    }

    return this.walletService.adminCreditWallet({
      userId: dto.userId,
      userRole: dto.userRole,
      amount: dto.amount,
      branchId: dto.branchId,
      reason: dto.reason,
      reference: dto.reference,
      actorId,
    });
  }

  @Post('fee-preview')
  @ApiOperation({ summary: 'Prévisualisation des frais de retrait' })
  async previewFee(
    @Body() body: { amountFcfa: number },
  ) {
    return this.payoutsService.calculatePayoutFee(body.amountFcfa);
  }

  @Post('withdrawals')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Demander un retrait Mobile Money (via GeniusPay)' })
  async requestWithdrawal(
    @Request()
    req: ExpressRequest & { user?: { userId?: string; role?: AppUserRole } },
    @Body() dto: RequestWithdrawalDto,
  ) {
    const user = req.user;
    if (!user?.userId) {
      throw new ForbiddenException('Utilisateur non authentifié');
    }

    const allowedRoles: AppUserRole[] = [
      AppUserRole.BUSINESS_ADMIN,
      AppUserRole.DRIVER,
      AppUserRole.COURIER,
      AppUserRole.SUPER_ADMIN,
    ];
    if (!allowedRoles.includes(user.role as AppUserRole)) {
      throw new ForbiddenException(
        'Seuls les marchands, livreurs, coursiers et super admins peuvent effectuer des retraits',
      );
    }

    const walletRoleMap: Record<string, UserRole> = {
      [AppUserRole.DRIVER]: UserRole.DRIVER,
      [AppUserRole.COURIER]: UserRole.COURIER,
      [AppUserRole.SUPER_ADMIN]: UserRole.SUPER_ADMIN,
      [AppUserRole.BUSINESS_ADMIN]: UserRole.MERCHANT,
    };
    const walletRole = walletRoleMap[user.role as AppUserRole] ?? UserRole.MERCHANT;

    // 🔒 Vérifier que la branche appartient bien au marchand connecté
    if (dto.branchId && user.role === AppUserRole.BUSINESS_ADMIN) {
      await this.businessesService.assertManagedBy(
        dto.branchId,
        user.userId,
        user.role as any,
      );
    }

    return this.payoutsService.requestWithdrawal(
      user.userId,
      walletRole,
      dto,
      dto.branchId,
    );
  }

  /**
   * 🏷️ Wallet agrégé d'une marque (toutes les agences)
   * GET /wallets/brand/:brandId
   * ⚠️ DOIT être AVANT :walletId/transactions et :userRole/:userId
   *    sinon NestJS matche "brand" comme walletId/userRole
   */
  @Get('brand/:brandId')
  @ApiOperation({ summary: 'Wallets agrégés d\'une marque (toutes les agences)' })
  async getBrandWallets(
    @Request()
    req: ExpressRequest & { user?: { userId?: string; role?: AppUserRole } },
    @Param('brandId') brandId: string,
  ) {
    const user = req.user;
    if (!user?.userId) {
      throw new ForbiddenException('Utilisateur non authentifié');
    }

    return this.walletService.getBrandWallets(brandId, user.userId);
  }

  @Get(':walletId/transactions')
  @ApiOperation({
    summary: 'Historique des transactions d\'un portefeuille',
  })
  async getTransactions(
    @Request()
    req: ExpressRequest & { user?: { userId?: string; role?: AppUserRole } },
    @Param('walletId') walletId: string,
    @Query('limit') limit?: number,
  ) {
    const user = req.user;
    return this.walletService.getTransactionHistoryForUser(
      walletId,
      user?.userId as string,
      user?.role === AppUserRole.SUPER_ADMIN,
      limit ? Number(limit) : 20,
    );
  }

  /**
   * 🔎 Vue super admin : tous les wallets d'un utilisateur (tous rôles).
   * GET /wallets/all/:userId — DOIT être déclarée AVANT :userRole/:userId
   * pour que "all" ne soit pas interprété comme un userRole.
   */
  @Get('all/:userId')
  @ApiOperation({
    summary: 'Vue super admin : tous les portefeuilles d\'un utilisateur',
  })
  async getAllWalletsOfUser(
    @Request()
    req: ExpressRequest & { user?: { userId?: string; role?: AppUserRole } },
    @Param('userId') userId: string,
  ) {
    const user = req.user;
    if (user?.role !== AppUserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Accès réservé aux super admins');
    }
    return this.walletService.getAllWalletsOfUser(userId);
  }

  @Get(':userRole/:userId')
  @ApiOperation({
    summary: 'Obtenir ou creer le portefeuille d\'un utilisateur',
  })
  async getWallet(
    @Request()
    req: ExpressRequest & { user?: { userId?: string; role?: AppUserRole } },
    @Param('userId') userId: string,
    @Param('userRole') userRoleRaw: string,
  ) {
    const user = req.user;
    if (user?.role !== AppUserRole.SUPER_ADMIN && user?.userId !== userId) {
      throw new ForbiddenException(
        'Vous ne pouvez consulter que votre portefeuille',
      );
    }

    const roleMap: Record<string, UserRole> = {
      BUSINESS_ADMIN: UserRole.MERCHANT,
      business_admin: UserRole.MERCHANT,
      MERCHANT: UserRole.MERCHANT,
      merchant: UserRole.MERCHANT,
      DRIVER: UserRole.DRIVER,
      driver: UserRole.DRIVER,
      COURIER: UserRole.COURIER,
      courier: UserRole.COURIER,
      CUSTOMER: UserRole.CUSTOMER,
      customer: UserRole.CUSTOMER,
      // 🔧 Le super admin a son propre wallet SUPER_ADMIN pour les commissions globales
      SUPER_ADMIN: UserRole.SUPER_ADMIN,
      super_admin: UserRole.SUPER_ADMIN,
    };

    const walletRole = roleMap[userRoleRaw];
    if (!walletRole) {
      throw new ForbiddenException(
        `Rôle de portefeuille invalide: "${userRoleRaw}". Valeurs acceptées: MERCHANT, DRIVER, COURIER, CUSTOMER, SUPER_ADMIN`,
      );
    }

    // 🔒 Un non-super-admin qui demanderait le segment super_admin est refusé
    if (
      (userRoleRaw === 'SUPER_ADMIN' || userRoleRaw === 'super_admin') &&
      user?.role !== AppUserRole.SUPER_ADMIN
    ) {
      throw new ForbiddenException('Accès réservé aux super admins');
    }

    return this.walletService.getOrCreateWallet(userId, walletRole);
  }

  /**
   * 🏷️ Wallet par agence spécifique
   * GET /wallets/MERCHANT/:userId/branch/:branchId
   */
  @Get(':userRole/:userId/branch/:branchId')
  @ApiOperation({ summary: 'Wallet d\'une agence spécifique' })
  async getWalletByBranch(
    @Request()
    req: ExpressRequest & { user?: { userId?: string; role?: AppUserRole } },
    @Param('userId') userId: string,
    @Param('userRole') userRoleRaw: string,
    @Param('branchId') branchId: string,
  ) {
    const user = req.user;
    if (user?.role !== AppUserRole.SUPER_ADMIN && user?.userId !== userId) {
      throw new ForbiddenException('Vous ne pouvez consulter que votre portefeuille');
    }

    const walletRole = userRoleRaw === 'MERCHANT' || userRoleRaw === 'BUSINESS_ADMIN'
      ? UserRole.MERCHANT
      : UserRole.DRIVER;

    return this.walletService.getOrCreateWallet(userId, walletRole, branchId);
  }

  // ========================================================================
  // 💰 WEBHOOK GeniusPay — cashout.completed / cashout.failed
  // (déplacé dans WalletWebhookController — ci-dessous)
  // ========================================================================
}

// ============================================================================
// Webhook GeniusPay — SANS garde JWT (authentifié par signature HMAC)
// ============================================================================
@ApiTags('Wallets Webhooks')
@Controller('wallets/webhook')
export class WalletWebhookController {
  private readonly logger = new Logger(WalletWebhookController.name);

  constructor(
    private readonly payoutsService: PayoutsService,
    private readonly configService: ConfigService,
  ) {}

  @Post('geniuspay')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Webhook GeniusPay pour cashout (retraits)' })
  async handleCashoutWebhook(
    @Body() body: any,
    @Headers('x-geniuspay-signature') signature: string,
  ) {
    this.logger.log(`[Cashout Webhook] Reçu: ${JSON.stringify(body).slice(0, 200)}`);

    // FIX #2 : Signature obligatoire
    const webhookSecret = this.configService.get<string>('GENIUSPAY_WEBHOOK_SECRET', '');
    if (!webhookSecret) {
      this.logger.error('[Cashout Webhook] GENIUSPAY_WEBHOOK_SECRET non configuré — webhook rejeté');
      return { received: false };
    }
    if (!signature) {
      this.logger.warn('[Cashout Webhook] Signature absente — rejeté');
      return { received: false };
    }

    const crypto = await import('crypto');
    const expected = crypto.createHmac('sha256', webhookSecret)
      .update(JSON.stringify(body))
      .digest('hex');
    if (expected !== signature) {
      this.logger.warn('[Cashout Webhook] Signature invalide — rejeté');
      return { received: false };
    }

    const event = body?.event ?? body?.type;
    const data = body?.data ?? body;

    if (!event) {
      this.logger.warn('[Cashout Webhook] Pas d\'event dans le payload');
      return { received: false };
    }

    // FIX #1 : Lookup par id OU transactionReference OU providerReference
    const rawId = data?.payout_id ?? data?.reference ?? data?.id;
    if (!rawId) {
      this.logger.warn(`[Cashout Webhook] Pas de payout_id pour event ${event}`);
      return { received: false };
    }

    const payoutRequest = await this.payoutsService.findPayoutByIdentifier(rawId);
    if (!payoutRequest) {
      this.logger.warn(`[Cashout Webhook] PayoutRequest introuvable pour identifiant: ${rawId}`);
      return { received: false };
    }

    switch (event) {
      case 'cashout.completed': {
        this.logger.log(`[Cashout Webhook] cashout.completed — ${payoutRequest.id} (ref: ${rawId})`);
        await this.payoutsService.confirmPayout(payoutRequest.id);
        break;
      }
      case 'cashout.failed':
      case 'cashout.cancelled': {
        const reason = data?.failure_reason ?? data?.message ?? `Event: ${event}`;
        this.logger.log(`[Cashout Webhook] ${event} — ${payoutRequest.id}: ${reason}`);
        await this.payoutsService.failPayout(payoutRequest.id, reason);
        break;
      }
      default:
        this.logger.log(`[Cashout Webhook] Event non géré: ${event}`);
    }

    return { received: true };
  }

  // ============================================================================
  // Webhook PayDunya Disburse (Payout PER) — SANS garde JWT
  // URL exacte configurée dans la console PayDunya :
  // https://fasofree-3nh8.onrender.com/api/v1/paydunya/disburse-webhook
  // ============================================================================
  @Post('paydunya/disburse-webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Webhook PayDunya Disburse (Payout PER)' })
  async handlePaydunyaDisburseWebhook(@Body() body: any) {
    this.logger.log(`🔔 PayDunya Disburse webhook: ${JSON.stringify(body).slice(0, 300)}`);

    // PayDunya disburse envoie : { response_code, response_text, transaction_id, provider_ref, disburse_id, hash }
    const responseCode = body?.response_code;
    const disburseId = body?.disburse_id; // notre payoutReference
    const transactionId = body?.transaction_id;
    const providerRef = body?.provider_ref;
    const failureReason = body?.response_text;
    const receivedHash = body?.hash;

    // 🔒 SÉCURITÉ CRITIQUE : Vérification SHA-512 du hash
    const masterKey = this.configService.get<string>('PAYDUNYA_MASTER_KEY', '');
    if (receivedHash && masterKey) {
      const crypto = await import('crypto');
      const expectedHash = crypto.createHash('sha512').update(masterKey).digest('hex');
      if (receivedHash.toLowerCase() !== expectedHash.toLowerCase()) {
        this.logger.warn('❌ PayDunya Disburse webhook: hash SHA-512 invalide — rejeté');
        return { received: false };
      }
    }

    if (!disburseId) {
      this.logger.warn('PayDunya Disburse webhook: disburse_id manquant');
      return { received: true }; // On répond 200 pour éviter les retries
    }

    try {
      // Trouver le PayoutRequest par transactionReference (notre payoutReference)
      const payoutRequest = await this.payoutsService.findPayoutByIdentifier(disburseId);
      if (!payoutRequest) {
        this.logger.warn(`PayDunya Disburse: PayoutRequest introuvable pour disburse_id ${disburseId}`);
        return { received: true };
      }

      if (responseCode === '00') {
        // SUCCÈS : confirmer le payout
        this.logger.log(`✅ PayDunya Disburse SUCCESS — ${payoutRequest.id} | providerRef: ${providerRef} | txId: ${transactionId}`);
        await this.payoutsService.confirmPayout(payoutRequest.id, providerRef);
      } else {
        // ÉCHEC : marquer comme échoué et libérer les fonds
        const reason = failureReason ?? `PayDunya response_code: ${responseCode}`;
        this.logger.warn(`❌ PayDunya Disburse FAILED — ${payoutRequest.id}: ${reason}`);
        await this.payoutsService.failPayout(payoutRequest.id, reason);
      }
    } catch (err) {
      this.logger.error(`PayDunya Disburse webhook error: ${err.message}`);
      // On répond 200 pour ne pas déclencher de retries infinis
    }

    return { received: true };
  }
}
