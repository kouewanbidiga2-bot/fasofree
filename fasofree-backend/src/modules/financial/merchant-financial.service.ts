import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Order } from '../orders/entities/order.entity';
import { WalletService } from '../wallets/wallet.service';
import { UserRole } from '../wallets/entities/wallet.entity';
import { TransactionReason } from '../wallets/entities/wallet-transaction.entity';

@Injectable()
export class MerchantFinancialService {
  private readonly logger = new Logger(MerchantFinancialService.name);

  constructor(private readonly walletService: WalletService) {}

  /**
   * 🏪 Settlement marchand à la complétion :
   * Crédite le wallet marchand de `merchantPayoutAmount` (NET de commission).
   *
   * ⚠️ Pourquoi pas de débit de commission séparé ?
   * Le `merchantPayoutAmount` est déjà net : en mode CLIENT le client paie la
   * commission, en mode MERCHANT elle est retranchée du payout. Un débit
   * supplémentaire créerait une double comptabilisation.
   * L'argent réel est réglé via le payout mobile money existant (PayoutsService).
   */
  @OnEvent('order.completed')
  async handleOrderCompleted(order: Order): Promise<void> {
    try {
      if (!order.businessId) {
        return; // P2P : pas de marchand
      }

      const payout = Number(order.merchantPayoutAmount) || 0;
      if (payout <= 0) {
        return;
      }

      // Garde-fou d'idempotence
      const alreadyCredited = await this.walletService.hasLedgerEntry(
        order.businessId,
        UserRole.MERCHANT,
        order.id,
        TransactionReason.ORDER_PAYMENT,
      );
      if (alreadyCredited) {
        this.logger.warn(
          `[Merchant Settlement] Déjà crédité pour la commande #${order.id}`,
        );
        return;
      }

      await this.walletService.creditWallet(
        order.businessId,
        UserRole.MERCHANT,
        payout,
        TransactionReason.ORDER_PAYMENT,
        order.id,
        `Produits commande #${order.id.slice(-8)}`,
      );

      this.logger.log(
        `[Merchant Settlement] +${payout} FCFA crédités au commerce ${order.businessId} (commande #${order.id})`,
      );
    } catch (error) {
      this.logger.error(
        `[Merchant Financial Error] Échec settlement marchand #${order.id}: ${error?.message}`,
      );
    }
  }
}
