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
import { NotificationStoreService } from '../notifications/notification-store.service';
import { NotificationType } from '../notifications/entities/notification.entity';

@Injectable()
export class PayoutsService {
  private readonly logger = new Logger(PayoutsService.name);

  constructor(
    private readonly geniusPayPayoutProvider: GeniusPayPayoutProvider,
    private readonly walletService: WalletService,
    private readonly settingsService: SettingsService,
    @InjectRepository(PayoutRequest)
    private readonly payoutRequestRepository: Repository<PayoutRequest>,
    private readonly notificationStore: NotificationStoreService,
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

  // ─── FIND PAYOUT BY MULTIPLE FIELDS ──────────────────────────────────────

  /**
   * Recherche un PayoutRequest par id, transactionReference ou providerReference.
   * Le webhook GeniusPay peut renvoyer n'importe lequel de ces identifiants.
   */
  async findPayoutByIdentifier(identifier: string): Promise<PayoutRequest | null> {
    // 1. Essayer par ID interne
    const byId = await this.payoutRequestRepository.findOne({ where: { id: identifier } });
    if (byId) return byId;

    // 2. Essayer par transactionReference (notre ref PAYOUT_...)
    const byTxRef = await this.payoutRequestRepository.findOne({
      where: { transactionReference: identifier },
    });
    if (byTxRef) return byTxRef;

    // 3. Essayer par providerReference (ref GeniusPay)
    const byProviderRef = await this.payoutRequestRepository.findOne({
      where: { providerReference: identifier },
    });
    return byProviderRef;
  }

  // ─── REQUEST WITHDRAWAL ──────────────────────────────────────────────────

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

    // 2. Créer le PayoutRequest AVANT d'appeler GeniusPay
    let payoutRequest: PayoutRequest;
    try {
      payoutRequest = this.payoutRequestRepository.create({
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
      payoutRequest = await this.payoutRequestRepository.save(payoutRequest);
    } catch (saveError) {
      // FIX #6 : si la création du PayoutRequest échoue, libérer les fonds tenus
      this.logger.error(
        `[Payout] Échec création PayoutRequest pour ${userId}: ${saveError instanceof Error ? saveError.message : 'Erreur inconnue'}`,
      );
      await this.walletService.releaseHeldFunds(userId, role, feeInfo.netAmount, branchId);
      throw new BadRequestException('Erreur interne lors de la création de la demande de retrait');
    }

    // 3. Notification : retrait demandé
    await this.notifyPayoutStep(userId, 'Retrait demandé',
      `Votre demande de retrait de ${dto.amountFcfa} FCFA via ${dto.provider} est en cours de traitement.`,
      payoutRequest.id,
    );

    // 4. Appeler GeniusPay API
    try {
      const transferResult = await this.geniusPayPayoutProvider.sendTransfer(
        payoutReference,
        feeInfo.netAmount,
        dto.phoneNumber,
        dto.provider,
      );

      if (transferResult.success) {
        await this.payoutRequestRepository.update(payoutRequest.id, {
          providerReference: transferResult.providerReference ?? null,
        });

        // Notification : retrait en traitement
        await this.notifyPayoutStep(userId, 'Retrait en traitement',
          `Votre retrait de ${dto.amountFcfa} FCFA est en cours de virement Mobile Money.`,
          payoutRequest.id,
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
        await this.handlePayoutFailure(
          payoutRequest.id, userId, role, feeInfo.netAmount, branchId,
          transferResult.message,
        );
        throw new BadRequestException(
          `Le virement a échoué: ${transferResult.message}. Les fonds ont été libérés sur votre solde.`,
        );
      }
    } catch (error) {
      if (!(error instanceof BadRequestException)) {
        await this.handlePayoutFailure(
          payoutRequest.id, userId, role, feeInfo.netAmount, branchId,
          error instanceof Error ? error.message : 'Erreur système',
        );
      }
      throw error;
    }
  }

  // ─── HANDLE FAILURE ──────────────────────────────────────────────────────

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

    // Notification : retrait échoué + fonds libérés
    await this.notifyPayoutStep(userId, 'Retrait échoué',
      `Votre retrait de ${netAmount} FCFA a échoué: ${reason}. Les fonds ont été recrédités sur votre solde.`,
      payoutRequestId,
    );
  }

  // ─── CONFIRM PAYOUT (webhook cashout.completed) ──────────────────────────

  /**
   * Confirme un retrait réussi.
   * FIX #3 : UPDATE conditionnel pour éviter le double débit en cas de webhook concurrent.
   */
  async confirmPayout(payoutRequestId: string): Promise<PayoutRequest | null> {
    // FIX #3 : UPDATE atomique conditionnel — seule la première exécution passe
    const result = await this.payoutRequestRepository
      .createQueryBuilder()
      .update(PayoutRequest)
      .set({ status: PayoutStatus.EXECUTED, completedAt: () => 'CURRENT_TIMESTAMP' })
      .where('id = :id', { id: payoutRequestId })
      .andWhere('status = :status', { status: PayoutStatus.PENDING })
      .execute();

    if (!result.affected || result.affected === 0) {
      this.logger.warn(
        `[Payout Confirm] Ignoré (déjà traité ou introuvable): ${payoutRequestId}`,
      );
      return this.payoutRequestRepository.findOne({ where: { id: payoutRequestId } });
    }

    // Recharger le PayoutRequest mis à jour
    const payoutRequest = await this.payoutRequestRepository.findOne({
      where: { id: payoutRequestId },
    });
    if (!payoutRequest) return null;

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

    this.logger.log(
      `[Payout Confirm] ${payoutRequest.netAmount} XOF confirmés pour ${payoutRequest.userId}. Ref: ${payoutRequest.transactionReference}`,
    );

    // Notification : retrait réussi
    await this.notifyPayoutStep(
      payoutRequest.userId,
      'Retrait réussi',
      `Votre retrait de ${payoutRequest.netAmount} FCFA a été crédité sur votre compte ${payoutRequest.provider}.`,
      payoutRequest.id,
    );

    return payoutRequest;
  }

  // ─── FAIL PAYOUT (webhook cashout.failed) ────────────────────────────────

  async failPayout(payoutRequestId: string, reason: string): Promise<PayoutRequest | null> {
    // UPDATE conditionnel
    const result = await this.payoutRequestRepository
      .createQueryBuilder()
      .update(PayoutRequest)
      .set({ status: PayoutStatus.FAILED, failureReason: reason, completedAt: () => 'CURRENT_TIMESTAMP' })
      .where('id = :id', { id: payoutRequestId })
      .andWhere('status = :status', { status: PayoutStatus.PENDING })
      .execute();

    if (!result.affected || result.affected === 0) {
      this.logger.warn(
        `[Payout Fail] Ignoré (déjà traité ou introuvable): ${payoutRequestId}`,
      );
      return this.payoutRequestRepository.findOne({ where: { id: payoutRequestId } });
    }

    const payoutRequest = await this.payoutRequestRepository.findOne({
      where: { id: payoutRequestId },
    });
    if (!payoutRequest) return null;

    // Libérer les fonds tenus
    try {
      await this.walletService.releaseHeldFunds(
        payoutRequest.userId,
        payoutRequest.userRole as unknown as UserRole,
        payoutRequest.netAmount,
        payoutRequest.branchId ?? undefined,
      );
    } catch (releaseError) {
      this.logger.error(
        `[PAYOUT CRITIQUE] Échec libération pour ${payoutRequest.userId}: ${releaseError instanceof Error ? releaseError.message : 'Erreur inconnue'}`,
      );
    }

    // Notification : retrait échoué + fonds libérés
    await this.notifyPayoutStep(
      payoutRequest.userId,
      'Retrait échoué',
      `Votre retrait de ${payoutRequest.netAmount} FCFA a échoué: ${reason}. Les fonds ont été recrédités sur votre solde.`,
      payoutRequest.id,
    );

    return payoutRequest;
  }

  // ─── NOTIFICATIONS ───────────────────────────────────────────────────────

  private async notifyPayoutStep(
    userId: string,
    title: string,
    body: string,
    payoutRequestId: string,
  ): Promise<void> {
    try {
      await this.notificationStore.create({
        userId,
        type: NotificationType.ORDER_UPDATE,
        title,
        body,
        actionUrl: `/wallet/payout/${payoutRequestId}`,
      });
    } catch (err) {
      this.logger.warn(`[Payout Notify] Échec notification pour ${userId}: ${err}`);
    }
  }
}
