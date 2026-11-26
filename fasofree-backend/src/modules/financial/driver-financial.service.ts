/**
 * Copyright (c) 2026 BIDIGA Imrane - Koliwa. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../orders/entities/order.entity';
import { WalletService } from '../wallets/wallet.service';
import { UserRole } from '../wallets/entities/wallet.entity';
import { TransactionReason } from '../wallets/entities/wallet-transaction.entity';
import { ReceiptsService } from '../receipts/receipts.service';

// Legacy : ancien modèle (Pass Journée 500 FCFA + 1%), conservé pour les
// historiques de wallet déjà écrits — plus jamais prélevé.
export const DAILY_PASS_FEE_AMOUNT = 500; // FCFA
export const DRIVER_MICRO_COMMISSION_RATE = 0.01;

/**
 * 🏍️ Commission plateforme prélevée AU LIVREUR, par course livrée.
 * 125 FCFA sur le gain de la course, plafonnés à 500 FCFA par jour :
 * - aucune avance à sortir avant d'avoir gagné (l'ancien Pass Journée débitait
 *   500 FCFA dès la 1ère course, ce qui pénalisait les nouveaux livreurs) ;
 * - le livreur ne paie jamais plus qu'un Pass Journée sur une journée chargée ;
 * - un montant fixe, lisible et prévisible, donc facile à expliquer et à accepter.
 */
export const DRIVER_COURSE_COMMISSION_AMOUNT = 125; // FCFA / course livrée
export const DRIVER_PLATFORM_FEE_DAILY_CAP = 500; // FCFA / livreur / jour
/**
 * Garde-fou anti-abus sur les petites courses : la commission ne peut jamais
 * dépasser 10 % du prix de livraison. Sur une course à 1 000 FCFA, elle tombe
 * donc à 100 FCFA au lieu de 125 — le livreur garde toujours l'essentiel.
 */
export const DRIVER_COMMISSION_MAX_RATE = 0.1;

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
   * 1. Crédite le gain de la course (deliveryFee)
   * 2. Prélève la commission plateforme (125 FCFA), plafonnée à 500 FCFA/jour,
   *    directement sur le gain qui vient d'être crédité
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

      // 2. Commission plateforme : 125 FCFA sur cette course, dans la limite des
      //    500 FCFA déjà prélevés aujourd'hui. Pas d'avance, pas de blocage :
      //    le prélèvement porte sur le gain qui vient d'être crédité.
      const chargedToday =
        await this.walletService.getDriverPlatformFeesChargedToday(driverId);
      const commission =
        earnings > 0
          ? Math.max(
              0,
              Math.min(
                DRIVER_COURSE_COMMISSION_AMOUNT,
                Math.round(earnings * DRIVER_COMMISSION_MAX_RATE),
                DRIVER_PLATFORM_FEE_DAILY_CAP - chargedToday,
              ),
            )
          : 0;

      if (commission > 0) {
        // Dette autorisée : si le livreur a déjà retiré ses gains, la commission
        // reste due — montant plafonné, donc jamais de dette importante.
        await this.walletService.debitWalletAllowNegative(
          driverId,
          UserRole.DRIVER,
          commission,
          TransactionReason.COMMISSION,
          orderId,
          `Commission Koliwa ${commission} FCFA (${DRIVER_COURSE_COMMISSION_AMOUNT} FCFA/course, plafond ${DRIVER_PLATFORM_FEE_DAILY_CAP} FCFA/jour)`,
        );
        await this.orderRepository.update(orderId, {
          driverCommissionAmount: commission,
        });
        this.logger.log(
          `[Commission] ${commission} FCFA prélevés sur la course #${orderId} — cumul du jour ${chargedToday + commission}/${DRIVER_PLATFORM_FEE_DAILY_CAP} FCFA`,
        );
      } else {
        await this.orderRepository.update(orderId, {
          driverCommissionAmount: 0,
        });
        this.logger.log(
          `[Commission] Plafond journalier atteint pour ${driverId} — course #${orderId} sans commission`,
        );
      }
    } catch (error) {
      this.logger.error(
        `[Driver Financial Error] Échec settlement livreur #${order.id}: ${error?.message}`,
      );
    }
  }
}
