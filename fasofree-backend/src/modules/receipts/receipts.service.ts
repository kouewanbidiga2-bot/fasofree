import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Receipt, ReceiptType, ReceiptStatus } from './entities/receipt.entity';
import { Order } from '../orders/entities/order.entity';

export interface TopupReceiptParams {
  clientUserId: string;
  amount: number;
  reference: string;
  walletTransactionId?: string;
  balanceAfter?: number;
  description?: string;
}

@Injectable()
export class ReceiptsService {
  private readonly logger = new Logger(ReceiptsService.name);

  constructor(
    @InjectRepository(Receipt)
    private readonly receiptsRepo: Repository<Receipt>,
  ) {}

  /** Génère un numéro de reçu lisible : RC-YYYYMMDD-XXXX */
  private async nextReceiptNumber(): Promise<string> {
    const today = new Date();
    const date = today.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `RC-${date}-`;
    const todayCount = await this.receiptsRepo
      .createQueryBuilder('r')
      .where('r.receiptNumber LIKE :prefix', { prefix: `${prefix}%` })
      .getCount();

    const seq = String(todayCount + 1).padStart(4, '0');
    const number = `${prefix}${seq}`;

    // Sécurité : si collision improbable, on incrémente
    const exists = await this.receiptsRepo.findOne({
      where: { receiptNumber: number },
    });
    return exists ? `${prefix}${String(todayCount + 2).padStart(4, '0')}` : number;
  }

  private async persist(data: Partial<Receipt>): Promise<Receipt> {
    const receiptNumber = await this.nextReceiptNumber();
    const receipt = this.receiptsRepo.create({ ...data, receiptNumber });
    return this.receiptsRepo.save(receipt);
  }

  /** 🧾 Reçu de recharge wallet (client) */
  async createTopupReceipt(
    params: TopupReceiptParams,
  ): Promise<Receipt> {
    return this.persist({
      type: ReceiptType.TOPUP,
      status: ReceiptStatus.COMPLETED,
      amount: params.amount,
      reference: params.reference,
      description: params.description ?? 'Recharge de portefeuille FasoFree',
      clientUserId: params.clientUserId,
      walletTransactionId: params.walletTransactionId ?? null,
      balanceAfter: params.balanceAfter ?? null,
    });
  }

  /** 🧾 Reçu de paiement de commande (client) */
  async createClientOrderReceipt(order: Order): Promise<Receipt> {
    return this.persist({
      type: ReceiptType.ORDER_PAYMENT,
      status: ReceiptStatus.COMPLETED,
      amount: Number(order.totalAmount),
      reference: order.paymentTransactionRef ?? order.id,
      description: `Paiement de la commande ${order.id}`,
      clientUserId: order.clientId,
      driverUserId: order.driverId ?? null,
      businessId: order.businessId,
      orderId: order.id,
    });
  }

  /** 🧾 Reçu prestataire MARCHAND (règlement à COMPLETED) */
  async createMerchantOrderReceipt(
    order: Order,
    merchantUserId: string,
    amount: number,
  ): Promise<Receipt> {
    return this.persist({
      type: ReceiptType.ORDER_PAYMENT,
      status: ReceiptStatus.COMPLETED,
      amount,
      reference: order.paymentTransactionRef ?? order.id,
      description: `Vente de la commande ${order.id} (net de commission FasoFree)`,
      merchantUserId,
      businessId: order.businessId,
      orderId: order.id,
    });
  }

  /** 🧾 Reçu prestataire LIVREUR (gain de livraison à DELIVERED) */
  async createDriverOrderReceipt(
    order: Order,
    driverUserId: string,
    amount: number,
  ): Promise<Receipt> {
    return this.persist({
      type: ReceiptType.DELIVERY_FEE,
      status: ReceiptStatus.COMPLETED,
      amount,
      reference: order.id,
      description: `Gain de livraison de la commande ${order.id}`,
      driverUserId,
      clientUserId: order.clientId,
      businessId: order.businessId,
      orderId: order.id,
    });
  }

  /** Retrouver ses reçus (client OU marchand OU livreur) */
  async findMyReceipts(
    userId: string,
    options: { type?: ReceiptType; limit?: number } = {},
  ): Promise<Receipt[]> {
    const qb = this.receiptsRepo
      .createQueryBuilder('r')
      .where(
        'r.clientUserId = :userId OR r.merchantUserId = :userId OR r.driverUserId = :userId',
        { userId },
      )
      .orderBy('r.createdAt', 'DESC')
      .limit(options.limit ?? 50);

    if (options.type) {
      qb.andWhere('r.type = :type', { type: options.type });
    }

    return qb.getMany();
  }

  /** Reçu unique (vérifie l'appartenance) */
  async findMyReceiptById(userId: string, receiptId: string): Promise<Receipt> {
    const receipt = await this.receiptsRepo.findOne({
      where: { id: receiptId },
    });
    if (
      !receipt ||
      (receipt.clientUserId !== userId &&
        receipt.merchantUserId !== userId &&
        receipt.driverUserId !== userId)
    ) {
      throw new NotFoundException('Reçu introuvable');
    }
    return receipt;
  }
}
