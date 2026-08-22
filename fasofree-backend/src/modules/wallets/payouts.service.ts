import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { CinetPayPayoutProvider } from './providers/cinetpay-payout.provider';
import { RequestWithdrawalDto } from './dto/request-withdrawal.dto';
import { v4 as uuidv4 } from 'uuid';
import { WalletService } from './wallet.service';
import { UserRole } from './entities/wallet.entity';
import { TransactionReason } from './entities/wallet-transaction.entity';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class PayoutsService {
  private readonly logger = new Logger(PayoutsService.name);

  constructor(
    private readonly cinetPayPayoutProvider: CinetPayPayoutProvider,
    private readonly walletService: WalletService,
    private readonly settingsService: SettingsService,
  ) {}

  /**
   * Calcule les frais de retrait à partir de la config globale
   * Retourne { fee, netAmount, feePercentage, isExempt }
   */
  async calculatePayoutFee(amountFcfa: number): Promise<{
    fee: number;
    netAmount: number;
    feePercentage: number;
    freeThreshold: number;
    isExempt: boolean;
  }> {
    const settings = await this.settingsService.get();

    const isActive = settings.isPayoutFeeActive;
    const percentage = Number(settings.payoutFeePercentage) || 0;
    const threshold = settings.payoutFreeThreshold || 0;

    if (!isActive || percentage <= 0 || amountFcfa <= threshold) {
      return {
        fee: 0,
        netAmount: amountFcfa,
        feePercentage: percentage,
        freeThreshold: threshold,
        isExempt: true,
      };
    }

    const fee = Math.round((amountFcfa * percentage) / 100);
    return {
      fee,
      netAmount: amountFcfa - fee,
      feePercentage: percentage,
      freeThreshold: threshold,
      isExempt: false,
    };
  }

  /**
   * Traite une demande de retrait en vérifiant le solde et en exécutant le virement
   */
  async requestWithdrawal(
    userId: string,
    role: UserRole,
    dto: RequestWithdrawalDto,
  ) {
    const payoutReference = `PAYOUT_${Date.now()}_${uuidv4().substring(0, 6)}`;

    // Calcul dynamique des frais
    const feeInfo = await this.calculatePayoutFee(dto.amountFcfa);

    this.logger.log(
      `[Payout Request] User: ${userId} | Montant: ${dto.amountFcfa} FCFA | Frais: ${feeInfo.fee} FCFA | Net: ${feeInfo.netAmount} FCFA | Ref: ${payoutReference}`,
    );

    // 1. Débiter d'abord le Wallet — le montant NET (après frais)
    const debitResult = await this.walletService.debitWallet(
      userId,
      role,
      feeInfo.netAmount,
      TransactionReason.WITHDRAWAL,
      payoutReference,
      `Retrait vers ${dto.provider} (frais: ${feeInfo.fee} FCFA)`,
    );

    // 2. Déclencher le virement Mobile Money via l'agrégateur
    try {
      const transferResult = await this.cinetPayPayoutProvider.sendTransfer(
        payoutReference,
        feeInfo.netAmount,
        dto.phoneNumber,
        dto.provider,
      );

      if (transferResult.success) {
        return {
          status: 'SUCCESS',
          message: 'Votre retrait a été crédité sur votre compte Mobile Money.',
          reference: payoutReference,
          amountRequestedFcfa: dto.amountFcfa,
          feeFcfa: feeInfo.fee,
          netAmountFcfa: feeInfo.netAmount,
          newWalletBalanceFcfa: debitResult.wallet.balance,
          phoneNumber: dto.phoneNumber,
          provider: dto.provider,
          feeBreakdown: {
            feePercentage: feeInfo.feePercentage,
            freeThreshold: feeInfo.freeThreshold,
            isExempt: feeInfo.isExempt,
          },
        };
      } else {
        // En cas d'échec du virement externe, re-créditer l'argent
        await this.walletService.creditWallet(
          userId,
          role,
          feeInfo.netAmount,
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
          feeInfo.netAmount,
          TransactionReason.REFUND,
          payoutReference,
          `Remboursement suite à l'échec du retrait (Erreur système)`,
        );
      }
      throw error;
    }
  }
}
