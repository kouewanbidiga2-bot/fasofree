import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { CinetPayPayoutProvider } from './providers/cinetpay-payout.provider';
import { RequestWithdrawalDto } from './dto/request-withdrawal.dto';
import { v4 as uuidv4 } from 'uuid';
import { WalletService } from './wallet.service';
import { UserRole } from './entities/wallet.entity';
import { TransactionReason } from './entities/wallet-transaction.entity';

@Injectable()
export class PayoutsService {
  private readonly logger = new Logger(PayoutsService.name);

  constructor(
    private readonly cinetPayPayoutProvider: CinetPayPayoutProvider,
    private readonly walletService: WalletService,
  ) {}

  /**
   * Traite une demande de retrait en vérifiant le solde et en exécutant le virement
   */
  async requestWithdrawal(
    userId: string,
    role: UserRole,
    dto: RequestWithdrawalDto,
  ) {
    const payoutReference = `PAYOUT_${Date.now()}_${uuidv4().substring(0, 6)}`;

    this.logger.log(
      `[Payout Request] User: ${userId} | Montant: ${dto.amountFcfa} FCFA | Ref: ${payoutReference}`,
    );

    // 1. Débiter d'abord le Wallet (ACID)
    const debitResult = await this.walletService.debitWallet(
      userId,
      role,
      dto.amountFcfa,
      TransactionReason.WITHDRAWAL,
      payoutReference,
      `Retrait vers ${dto.provider}`,
    );

    // 2. Déclencher le virement Mobile Money via l'agrégateur
    try {
      const transferResult = await this.cinetPayPayoutProvider.sendTransfer(
        payoutReference,
        dto.amountFcfa,
        dto.phoneNumber,
        dto.provider,
      );

      if (transferResult.success) {
        return {
          status: 'SUCCESS',
          message: 'Votre retrait a été crédité sur votre compte Mobile Money.',
          reference: payoutReference,
          amountWithdrawnFcfa: dto.amountFcfa,
          newWalletBalanceFcfa: debitResult.wallet.balance,
          phoneNumber: dto.phoneNumber,
          provider: dto.provider,
        };
      } else {
        // En cas d'échec du virement externe, re-créditer l'argent !
        await this.walletService.creditWallet(
          userId,
          role,
          dto.amountFcfa,
          TransactionReason.REFUND,
          payoutReference,
          `Remboursement suite à l'échec du retrait: ${transferResult.message}`,
        );
        throw new BadRequestException(
          `Le virement a échoué: ${transferResult.message}. Le montant a été recrédité sur votre solde.`,
        );
      }
    } catch (error) {
      if (!(error instanceof BadRequestException)) {
        await this.walletService.creditWallet(
          userId,
          role,
          dto.amountFcfa,
          TransactionReason.REFUND,
          payoutReference,
          `Remboursement suite à l'échec du retrait (Erreur système)`,
        );
      }
      throw error;
    }
  }
}
