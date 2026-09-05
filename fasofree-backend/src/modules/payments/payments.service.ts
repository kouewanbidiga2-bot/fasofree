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

    const reference = `FF-PAY-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const commissionAmount = Number(
      order.merchantCommissionAmount ?? order.platformCommission ?? 0,
    );

    let transaction = await this.transactionRepository.findOne({
      where: { orderId: order.id },
    });

    if (transaction) {
      transaction.reference = reference;
      transaction.paymentMethod = dto.paymentMethod;
      transaction.amount = order.totalAmount;
      transaction.commissionAmount = commissionAmount;
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

    return {
      reference,
      checkoutUrl: payment.checkout_url || payment.payment_url,
      paymentUrl: payment.payment_url,
      status: payment.status,
      message: 'Paiement GeniusPay initié',
    };
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

    if (
      order.status === OrderStatus.PAID ||
      order.status === OrderStatus.IN_PREPARATION
    ) {
      this.logger.warn(
        `Webhook ignoré : la commande ${orderId} est déjà marquée comme payée.`,
      );
      return;
    }

    await this.ordersService.markAsPaidAndDispatch(orderId, transactionRef);
    this.logger.log(
      `Commande ${orderId} validée avec succès via ${paymentMethod}`,
    );
  }
}
