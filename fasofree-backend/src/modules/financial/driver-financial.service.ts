import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../orders/entities/order.entity';
import { WalletService } from '../wallets/wallet.service';
import { UserRole } from '../wallets/entities/wallet.entity';
import { TransactionReason } from '../wallets/entities/wallet-transaction.entity';
import { ReceiptsService } from '../receipts/receipts.service';

export const DAILY_PASS_FEE_AMOUNT = 500; // FCFA
export const DRIVER_MICRO_COMMISSION_RATE = 0.01; // 1% sur les gains des courses suivantes

@Injectable()
export class DriverFinancialService {
  private readonly logger = new Logger(DriverFinancialService.name);

  constructor(
    private readonly walletService: WalletService,
    private readonly receiptsService: ReceiptsService,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
  ) {}

  /**
   * 🛵 Settlement livreur à la livraison :
   * 1. Crédite les gains nets (deliveryFee)
   * 2. 1ère course du jour -> débit Pass Journée 500 FCFA (dette autorisée)
   * 3. Sinon -> micro-commission 1% sur les gains
   */
  @OnEvent('order.delivered')
  async handleOrderDelivered(order: Order): Promise<void> {
    try {
      if (!order.driverId) {
        return; // PICKUP / DINE_IN : aucun livreur assigné
      }

      const driverId = order.driverId;
      const orderId = order.id;
      const earnings = Number(order.deliveryFee) || 0;

      // Garde-fou d'idempotence : le gain de cette commande est déjà crédité ?
      const alreadyCredited = await this.walletService.hasLedgerEntry(
        driverId,
        UserRole.DRIVER,
        orderId,
        TransactionReason.DELIVERY_FEE,
      );
      if (alreadyCredited) {
        this.logger.warn(
          `[Driver Settlement] Déjà traité pour la commande #${orderId}`,
        );
        return;
      }

      // 1. Crédit des gains de course
      if (earnings > 0) {
        await this.walletService.creditWallet(
          driverId,
          UserRole.DRIVER,
          earnings,
          TransactionReason.DELIVERY_FEE,
          orderId,
          `Gain course #${orderId.slice(-8)}`,
        );

        // 🧾 Reçu prestataire LIVREUR automatique
        await this.receiptsService.createDriverOrderReceipt(
          order,
          driverId,
          earnings,
        );
      }

      // 2. Pass Journée : débité à la 1ère course du jour (dette autorisée)
      const passChargedToday =
        await this.walletService.hasDailyPassFeeBeenChargedToday(driverId);

      if (!passChargedToday) {
        await this.walletService.debitWalletAllowNegative(
          driverId,
          UserRole.DRIVER,
          DAILY_PASS_FEE_AMOUNT,
          TransactionReason.DAILY_PASS_FEE,
          orderId,
          'Pass journée FasoFree (500 FCFA) - 1ère course du jour',
        );
        this.logger.log(
          `[Daily Pass] 500 FCFA débités (dette possible) pour le livreur ${driverId}`,
        );
        return;
      }

      // 3. Micro-commission 1% sur les autres courses
      const microCommission = Math.round(
        earnings * DRIVER_MICRO_COMMISSION_RATE,
      );
      if (microCommission > 0) {
        try {
          await this.walletService.debitWallet(
            driverId,
            UserRole.DRIVER,
            microCommission,
            TransactionReason.COMMISSION,
            orderId,
            'Micro-commission FasoFree (1%)',
          );
        } catch (error) {
          this.logger.warn(
            `[Micro-Commission] Solde insuffisant pour ${driverId}, commission non prélevée: ${error?.message}`,
          );
        }
        await this.orderRepository.update(orderId, {
          driverCommissionAmount: microCommission,
        });
      }
    } catch (error) {
      this.logger.error(
        `[Driver Financial Error] Échec settlement livreur #${order.id}: ${error?.message}`,
      );
    }
  }
}
