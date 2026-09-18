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
} from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { WalletService } from './wallet.service';
import { PayoutsService } from './payouts.service';
import { UserRole } from './entities/wallet.entity';
import { RequestWithdrawalDto } from './dto/request-withdrawal.dto';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole as AppUserRole } from '../users/entities/user-role.enum';

@ApiTags('Wallets')
@UseGuards(AuthGuard('jwt'))
@Controller('wallets')
export class WalletController {
  constructor(
    private readonly walletService: WalletService,
    private readonly payoutsService: PayoutsService,
  ) {}

  @Post('fee-preview')
  @ApiOperation({ summary: 'Prévisualisation des frais de retrait' })
  async previewFee(
    @Body() body: { amountFcfa: number },
  ) {
    return this.payoutsService.calculatePayoutFee(body.amountFcfa);
  }

  @Post('withdrawals')
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
    ];
    if (!allowedRoles.includes(user.role as AppUserRole)) {
      throw new ForbiddenException(
        'Seuls les marchands et livreurs peuvent effectuer des retraits',
      );
    }

    const walletRole =
      user.role === AppUserRole.DRIVER ? UserRole.DRIVER : UserRole.MERCHANT;

    return this.payoutsService.requestWithdrawal(
      user.userId,
      walletRole,
      dto,
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
   * 🔎 Vue super admin : tous les wallets d'un utilisateur (tous rôles).
   * GET /wallets/all/:userId — déclarée avant :userRole/:userId
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
}
