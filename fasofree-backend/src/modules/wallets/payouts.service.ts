import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GeniusPayPayoutProvider } from './providers/geniuspay-payout.provider';
import { RequestWithdrawalDto } from './dto/request-withdrawal.dto';
import { v4 as uuidv4 } from 'uuid';
import { WalletService } from './wallet.service';
import { UserRole } from './entities/wallet.entity';
import { TransactionReason } from './entities/wallet-transaction.entity';
import { SettingsService } from '../settings/settings.service';
import { PayoutRequest, PayoutStatus, UserRole as PayoutUserRole } from '../financial/entities/payout-request.entity';

@Injectable()
export class PayoutsService {
  private readonly logger = new Logger(PayoutsService.name);

  constructor(
    private readonly geniusPayPayoutProvider: GeniusPayPayoutProvider,
    private readonly walletService: WalletService,
    private readonly settingsService: SettingsService,
    @InjectRepository(PayoutRequest)
    private readonly payoutRequestRepository: Repository<PayoutRequest>,
  ) {}

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
   * Demande de retrait — pattern hold/release :
   * 1. Bloquer les fonds (availableBalance → heldBalance)
   * 2. Créer PayoutRequest PENDING
   * 3. Appeler GeniusPay API
   * 4. Si API échoue → libérer les fonds, marquer FAILED
   * 5. Si API OK → laisser PENDING (confirmation par webhook cashout.completed)
   */
  async requestWithdrawal(
    userId: string,
    role: UserRole,
    dto: RequestWithdrawalDto,
    branchId?: string,
  ) {
    const payoutReference = `PAYOUT_${Date.now()}_${uuidv4().substring(0, 6)}`;
    const feeInfo = await this.calculatePayoutFee(dto.amountFcfa);

    this.logger.log(
      `[Payout Request] User: ${userId} | Montant: ${dto.amountFcfa} FCFA | Frais: ${feeInfo.fee} FCFA | Net: ${feeInfo.netAmount} FCFA | Ref: ${payoutReference}${branchId ? ` | Agence: ${branchId}` : ''}`,
    );

    // 1. Bloquer les fonds (hold)
    const wallet = await this.walletService.holdFunds(
      userId,
      role,
      feeInfo.netAmount,
      branchId,
    );

    // 2. Créer le PayoutRequest
    const payoutRequest = this.payoutRequestRepository.create({
      userId,
      userRole: role as unknown as PayoutUserRole,
      walletId: wallet.id,
      branchId: branchId ?? null,
      amount: dto.amountFcfa,
      fees: feeInfo.fee,
      netAmount: feeInfo.netAmount,
      phoneNumber: dto.phoneNumber,
      provider: dto.provider,
      status: PayoutStatus.PENDING,
      transactionReference: payoutReference,
    });
    await this.payoutRequestRepository.save(payoutRequest);

    // 3. Appeler GeniusPay API
    try {
      const transferResult = await this.geniusPayPayoutProvider.sendTransfer(
        payoutReference,
        feeInfo.netAmount,
        dto.phoneNumber,
        dto.provider,
      );

      if (transferResult.success) {
        // API OK → laisser PENDING, le webhook cashout.completed confirmera
        await this.payoutRequestRepository.update(payoutRequest.id, {
          providerReference: transferResult.providerReference ?? null,
        });

        this.logger.log(
          `[Payout] GeniusPay API OK — ref ${payoutReference}. En attente webhook cashout.completed.`,
        );

        return {
          status: 'PROCESSING',
          message: 'Votre retrait est en cours de traitement. Vous recevrez une notification une fois le virement effectué.',
          payoutRequestId: payoutRequest.id,
          reference: payoutReference,
          amountRequestedFcfa: dto.amountFcfa,
          feeFcfa: feeInfo.fee,
          netAmountFcfa: feeInfo.netAmount,
          newAvailableBalanceFcfa: wallet.availableBalance,
          newHeldBalanceFcfa: wallet.heldBalance,
          phoneNumber: dto.phoneNumber,
          provider: dto.provider,
          branchId: branchId ?? null,
          feeBreakdown: {
            feePercentage: feeInfo.feePercentage,
            freeThreshold: feeInfo.freeThreshold,
            isExempt: feeInfo.isExempt,
          },
        };
      } else {
        // API échoue → libérer les fonds tenus
        await this.handlePayoutFailure(
          payoutRequest.id,
          userId,
          role,
          feeInfo.netAmount,
          branchId,
          transferResult.message,
        );
        throw new BadRequestException(
          `Le virement a échoué: ${transferResult.message}. Les fonds ont été libérés sur votre solde.`,
        );
      }
    } catch (error) {
      if (!(error instanceof BadRequestException)) {
        await this.handlePayoutFailure(
          payoutRequest.id,
          userId,
          role,
          feeInfo.netAmount,
          branchId,
          error instanceof Error ? error.message : 'Erreur système',
        );
      }
      throw error;
    }
  }

  /**
   * Gère l'échec d'un retrait : libérer les fonds tenus + marquer PayoutRequest FAILED.
   */
  async handlePayoutFailure(
    payoutRequestId: string,
    userId: string,
    role: UserRole,
    netAmount: number,
    branchId: string | undefined,
    reason: string,
  ): Promise<void> {
    this.logger.warn(
      `[Payout Failure] Ref ${payoutRequestId}: ${reason}. Libération de ${netAmount} XOF.`,
    );

    try {
      await this.walletService.releaseHeldFunds(userId, role, netAmount, branchId);
    } catch (releaseError) {
      this.logger.error(
        `[PAYOUT CRITIQUE] Échec de libération pour ${userId}: ${releaseError instanceof Error ? releaseError.message : 'Erreur inconnue'}. Montant bloqué: ${netAmount} XOF`,
      );
    }

    await this.payoutRequestRepository.update(payoutRequestId, {
      status: PayoutStatus.FAILED,
      failureReason: reason,
      completedAt: new Date(),
    });
  }

  /**
   * Confirme un retrait réussi (appelé par le webhook cashout.completed).
   * Confirme le débit (heldBalance → balance) et marque EXECUTED.
   */
  async confirmPayout(payoutRequestId: string): Promise<PayoutRequest> {
    const payoutRequest = await this.payoutRequestRepository.findOne({
      where: { id: payoutRequestId },
    });

    if (!payoutRequest) {
      throw new BadRequestException(`PayoutRequest ${payoutRequestId} introuvable`);
    }

    if (payoutRequest.status !== PayoutStatus.PENDING) {
      this.logger.warn(
        `[Payout Confirm] Ignoré: status=${payoutRequest.status} pour ${payoutRequestId}`,
      );
      return payoutRequest;
    }

    // Confirmer le débit (held → balance)
    await this.walletService.confirmHold(
      payoutRequest.userId,
      payoutRequest.userRole as unknown as UserRole,
      payoutRequest.netAmount,
      TransactionReason.WITHDRAWAL,
      payoutRequest.transactionReference ?? undefined,
      `Retrait confirmé vers ${payoutRequest.provider}`,
      payoutRequest.branchId ?? undefined,
    );

    // Marquer EXECUTED
    payoutRequest.status = PayoutStatus.EXECUTED;
    payoutRequest.completedAt = new Date();
    await this.payoutRequestRepository.save(payoutRequest);

    this.logger.log(
      `[Payout Confirm] ${payoutRequest.netAmount} XOF confirmés pour ${payoutRequest.userId}. Ref: ${payoutRequest.transactionReference}`,
    );

    return payoutRequest;
  }

  /**
   * Gère l'échec d'un retrait via webhook (cashout.failed).
   */
  async failPayout(payoutRequestId: string, reason: string): Promise<PayoutRequest> {
    const payoutRequest = await this.payoutRequestRepository.findOne({
      where: { id: payoutRequestId },
    });

    if (!payoutRequest) {
      throw new BadRequestException(`PayoutRequest ${payoutRequestId} introuvable`);
    }

    if (payoutRequest.status !== PayoutStatus.PENDING) {
      this.logger.warn(
        `[Payout Fail] Ignoré: status=${payoutRequest.status} pour ${payoutRequestId}`,
      );
      return payoutRequest;
    }

    await this.handlePayoutFailure(
      payoutRequest.id,
      payoutRequest.userId,
      payoutRequest.userRole as unknown as UserRole,
      payoutRequest.netAmount,
      payoutRequest.branchId ?? undefined,
      reason,
    );

    return this.payoutRequestRepository.findOne({
      where: { id: payoutRequestId },
    }) as Promise<PayoutRequest>;
  }
}
