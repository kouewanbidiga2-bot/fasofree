import * as crypto from 'crypto';
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';

import { Transaction, TransactionStatus } from './entities/transaction.entity';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { OrdersService } from '../orders/orders.service';
import { GeniusPayService } from './providers/geniuspay.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => OrdersService))
    private readonly ordersService: OrdersService,
    private readonly geniusPayService: GeniusPayService,
  ) {}

  async initiatePayment(dto: InitiatePaymentDto, clientId: string) {
    const order = await this.orderRepository.findOne({
      where: { id: dto.orderId },
    });
    if (!order) {
      throw new NotFoundException('Commande introuvable');
    }
    if (order.clientId !== clientId) {
      throw new BadRequestException('Cette commande ne vous appartient pas');
    }

    const terminalStatuses = [
      OrderStatus.PAID,
      OrderStatus.IN_PREPARATION,
      OrderStatus.READY_FOR_PICKUP,
      OrderStatus.DRIVER_ASSIGNED,
      OrderStatus.PROCESSING,
      OrderStatus.IN_DELIVERY,
      OrderStatus.DELIVERED_PENDING_CONFIRMATION,
      OrderStatus.DELIVERED,
      OrderStatus.COMPLETED,
      OrderStatus.DISPUTED,
      OrderStatus.REFUNDED,
    ];
    if (terminalStatuses.includes(order.status)) {
      throw new BadRequestException('Cette commande ne peut plus être payée');
    }

    // 🔁 Retry : si la commande est FAILED, la remettre en AWAITING_PAYMENT
    if (order.status === 'FAILED') {
      await this.orderRepository.update(order.id, { status: OrderStatus.AWAITING_PAYMENT });
      this.logger.log(`Order ${order.id} remise en AWAITING_PAYMENT pour retry`);
    }

    const reference = `FF-PAY-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const commissionAmount = Number(
      order.merchantCommissionAmount ?? order.platformCommission ?? 0,
    );

    let transaction = await this.transactionRepository.findOne({
      where: { orderId: order.id },
    });

    // 🔒 ANTI DOUBLE-PAIEMENT
    // Si une tentative est DÉJÀ en cours, on ne crée surtout pas une seconde
    // charge GeniusPay : on renvoie la session existante pour reprendre le
    // paiement au même endroit. Avant ce correctif, un double clic sur
    // « Payer » créait deux paiements chez l'agrégateur, et le client pouvait
    // être débité deux fois sur la même commande.
    if (
      transaction &&
      transaction.status === TransactionStatus.PENDING &&
      transaction.gatewayCheckoutUrl
    ) {
      this.logger.log(
        `Payment idempotent for order ${order.id} — session existante ${transaction.reference} renvoyée`,
      );
      return {
        reference: transaction.reference,
        checkoutUrl: transaction.gatewayCheckoutUrl,
        paymentUrl: transaction.gatewayCheckoutUrl,
        status: 'pending',
        message: 'Paiement déjà en cours',
      };
    }

    if (transaction) {
      // 🔁 Retry : remettre la transaction en PENDING si elle était FAILED
      if (transaction.status === TransactionStatus.FAILED) {
        transaction.status = TransactionStatus.PENDING;
      }
      transaction.reference = reference;
      transaction.paymentMethod = dto.paymentMethod;
      transaction.amount = order.totalAmount;
      transaction.commissionAmount = commissionAmount;
      // Nouvelle tentative → nouvelle session chez l'agrégateur
      transaction.paymentGatewayId = null;
      transaction.gatewayCheckoutUrl = null;
      await this.transactionRepository.save(transaction);
    } else {
      transaction = this.transactionRepository.create({
        reference,
        orderId: order.id,
        amount: order.totalAmount,
        commissionAmount,
        paymentMethod: dto.paymentMethod,
        status: TransactionStatus.PENDING,
      });
      await this.transactionRepository.save(transaction);
    }

    try {
      return await this.initiateGeniusPay(order, reference, dto);
    } catch (error) {
      this.logger.error(`Payment failed for order ${order.id}: ${error.message}`);
      // Marquer la commande ET la transaction en FAILED
      try {
        await this.orderRepository.update(order.id, { status: OrderStatus.FAILED });
        const tx = await this.transactionRepository.findOne({ where: { orderId: order.id } });
        if (tx && tx.status === TransactionStatus.PENDING) {
          await this.transactionRepository.update(tx.id, { status: TransactionStatus.FAILED });
        }
        this.logger.log(`Order ${order.id} + transaction marked FAILED after GeniusPay error`);
      } catch (updateErr) {
        this.logger.error(`Failed to mark order ${order.id} as FAILED: ${updateErr.message}`);
      }
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(
        'Impossible de contacter la passerelle de paiement. Veuillez réessayer.',
      );
    }
  }

  private async initiateGeniusPay(
    order: Order,
    reference: string,
    dto: InitiatePaymentDto,
  ) {
    const payment = await this.geniusPayService.createPayment({
      amount: Number(order.totalAmount),
      description: `Commande #${order.id.substring(0, 8)}`,
      paymentMethod: dto.paymentMethod,
      customer: {
        phone: dto.phoneNumber,
      },
      metadata: {
        order_id: order.id,
        reference,
      },
    });

    const checkoutUrl = payment.checkout_url || payment.payment_url;

    // 🔒 On PERSISTE la référence et l'URL de l'agrégateur. Avant ce
    // correctif, `paymentGatewayId` restait null : les recherches de webhook
    // par référence ne correspondaient jamais, et un second appel « Payer »
    // créait une charge supplémentaire.
    await this.transactionRepository.update(
      { reference },
      {
        paymentGatewayId: String(payment.reference ?? payment.id),
        gatewayCheckoutUrl: checkoutUrl ?? null,
      },
    );

    return {
      reference,
      checkoutUrl,
      paymentUrl: payment.payment_url,
      status: payment.status,
      message: 'Paiement GeniusPay initié',
    };
  }

  /**
   * 🔄 RÉCONCILIATION :询问 l'agrégateur l'état RÉEL d'une commande.
   *
   * Appelé par le client au retour de GeniusPay. On interroge l'API
   * merchant avec la référence réellement stockée (`paymentGatewayId`) et :
   *  - si l'agrégateur dit `completed` ET le montant correspond → on applique
   *    la MÊME logique que le webhook (transaction SUCCESS + commande PAID) ;
   *  - sinon on renvoie l'état réel, sans jamais annoncer « payé ».
   *
   * Cela rend l'affichage honnête même si un webhook a été perdu, et empêche
   * définitivement l'interface d'afficher « payé » sans encaissement.
   */
  async reconcileOrderPayment(
    orderId: string,
    clientId: string,
  ): Promise<{ status: string; paid: boolean; reference: string | null }> {
    const order = await this.orderRepository.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('Commande introuvable');
    }
    if (order.clientId !== clientId) {
      throw new BadRequestException('Cette commande ne vous appartient pas');
    }

    const alreadyPaid = [
      OrderStatus.PAID,
      OrderStatus.IN_PREPARATION,
      OrderStatus.READY_FOR_PICKUP,
      OrderStatus.DRIVER_ASSIGNED,
      OrderStatus.IN_DELIVERY,
      OrderStatus.DELIVERED_PENDING_CONFIRMATION,
      OrderStatus.DELIVERED,
      OrderStatus.COMPLETED,
    ].includes(order.status);
    if (alreadyPaid) {
      return { status: order.status, paid: true, reference: order.paymentTransactionRef ?? null };
    }

    const transaction = await this.transactionRepository.findOne({
      where: { orderId },
    });
    if (!transaction || !transaction.paymentGatewayId) {
      return { status: order.status, paid: false, reference: transaction?.reference ?? null };
    }
    if (transaction.status === TransactionStatus.SUCCESS) {
      return { status: order.status, paid: true, reference: transaction.reference };
    }

    // Interroge l'agrégateur — une erreur réseau ne doit pas faire mentir
    // l'interface : on renvoie alors l'état local, jamais « payé ».
    let gatewayStatus: string;
    let gatewayAmount: number | undefined;
    try {
      const remote = await this.geniusPayService.getPayment(
        transaction.paymentGatewayId,
      );
      gatewayStatus = String(remote.status ?? '').toLowerCase();
      gatewayAmount = remote.amount === undefined ? undefined : Number(remote.amount);
    } catch (err) {
      this.logger.warn(
        `[Reconcile] Impossible de joindre GeniusPay pour ${orderId}: ${(err as Error).message}`,
      );
      return { status: order.status, paid: false, reference: transaction.reference };
    }

    const expectedAmount = Number(order.totalAmount);
    const amountMatches =
      gatewayAmount === undefined ||
      !Number.isFinite(gatewayAmount) ||
      Math.abs(expectedAmount - gatewayAmount) <= 1;

    if (gatewayStatus === 'completed' && amountMatches) {
      await this.transactionRepository.update(
        { id: transaction.id },
        { status: TransactionStatus.SUCCESS },
      );
      await this.ordersService.markAsPaidAndDispatch(orderId, transaction.reference);
      this.logger.log(`[Reconcile] Commande ${orderId} confirmée payée via GeniusPay`);
      return { status: OrderStatus.PAID, paid: true, reference: transaction.reference };
    }

    if (gatewayStatus === 'failed' || gatewayStatus === 'cancelled' || gatewayStatus === 'expired') {
      if (transaction.status === TransactionStatus.PENDING) {
        await this.transactionRepository.update(
          { id: transaction.id },
          { status: TransactionStatus.FAILED },
        );
        await this.ordersService.markAsPaymentFailed(orderId).catch(() => undefined);
      }
      return { status: gatewayStatus, paid: false, reference: transaction.reference };
    }

    // pending / processing → toujours en cours, jamais « payé ».
    return { status: order.status, paid: false, reference: transaction.reference };
  }

  async validatePaymentAmount(
    orderId: string,
    receivedAmount: number | string | undefined | null,
  ): Promise<boolean> {
    if (receivedAmount === undefined || receivedAmount === null) {
      this.logger.warn(`Webhook: montant absent pour la commande ${orderId}`);
      return false;
    }
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });
    if (!order) {
      this.logger.warn(`Webhook: commande ${orderId} introuvable`);
      return false;
    }
    const expected = Number(order.totalAmount);
    const received = Number(receivedAmount);
    return Math.abs(expected - received) <= 1;
  }

  async processSuccessfulPayment(
    orderId: string,
    transactionRef: string,
    paymentMethod: string,
  ): Promise<void> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });

    if (!order) {
      this.logger.error(`Commande introuvable pour l'ID : ${orderId}`);
      return;
    }

    const terminalPaidStatuses = [
      OrderStatus.PAID,
      OrderStatus.IN_PREPARATION,
      OrderStatus.READY_FOR_PICKUP,
      OrderStatus.DRIVER_ASSIGNED,
      OrderStatus.IN_DELIVERY,
      OrderStatus.DELIVERED_PENDING_CONFIRMATION,
      OrderStatus.DELIVERED,
      OrderStatus.COMPLETED,
      OrderStatus.DISPUTED,
      OrderStatus.REFUNDED,
    ];

    if (terminalPaidStatuses.includes(order.status)) {
      this.logger.warn(
        `Webhook ignoré : la commande ${orderId} est déjà dans un état payé/terminé (${order.status}).`,
      );
      return;
    }

    await this.ordersService.markAsPaidAndDispatch(orderId, transactionRef);
    this.logger.log(
      `Commande ${orderId} validée avec succès via ${paymentMethod}`,
    );
  }
}
