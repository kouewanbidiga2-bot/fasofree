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
  @ApiOperation({ summary: 'Demander un retrait Mobile Money' })
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
    };

    const walletRole = roleMap[userRoleRaw];
    if (!walletRole) {
      throw new ForbiddenException(
        `Rôle de portefeuille invalide: "${userRoleRaw}". Valeurs acceptées: MERCHANT, DRIVER, COURIER, CUSTOMER`,
      );
    }

    return this.walletService.getOrCreateWallet(userId, walletRole);
  }
}
