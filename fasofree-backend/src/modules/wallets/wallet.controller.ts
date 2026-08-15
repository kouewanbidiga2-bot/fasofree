import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  Query,
  ParseEnumPipe,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { WalletService } from './wallet.service';
import { UserRole } from './entities/wallet.entity';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole as AppUserRole } from '../users/entities/user-role.enum';

@ApiTags('Wallets')
@UseGuards(AuthGuard('jwt'))
@Controller('wallets')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get(':userRole/:userId')
  @ApiOperation({
    summary: 'Obtenir ou créer le portefeuille d’un utilisateur',
  })
  async getWallet(
    @Request()
    req: ExpressRequest & { user?: { userId?: string; role?: AppUserRole } },
    @Param('userId') userId: string,
    @Param('userRole', new ParseEnumPipe(UserRole)) userRole: UserRole,
  ) {
    const user = req.user;
    if (user?.role !== AppUserRole.SUPER_ADMIN && user?.userId !== userId) {
      throw new ForbiddenException(
        'Vous ne pouvez consulter que votre portefeuille',
      );
    }
    return this.walletService.getOrCreateWallet(userId, userRole);
  }

  @Get(':walletId/transactions')
  @ApiOperation({
    summary: 'Obtenir l’historique des transactions d’un portefeuille',
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
}
