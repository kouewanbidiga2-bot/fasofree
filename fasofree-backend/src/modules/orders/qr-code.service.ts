import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderStatus, FulfillmentType } from './entities/order.entity';
import * as crypto from 'crypto';

/**
 * 🎫 Service de génération et validation de QR Codes pour Click & Collect
 */
@Injectable()
export class QrCodeService {
  private readonly logger = new Logger(QrCodeService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
  ) {}

  /**
   * Génère un QR Code unique pour une commande
   */
  generateQrCode(orderId: string): string {
    // Générer un token unique de 32 caractères
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(16).toString('hex');
    const qrCode = `${timestamp}-${random}`.substring(0, 32);

    this.logger.log(`[QR Code] Généré pour la commande #${orderId}: ${qrCode}`);
    return qrCode;
  }

  /**
   * Génère et associe un QR Code à une commande
   */
  async generateAndAssignQrCode(orderId: string): Promise<string | null> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });

    if (!order) {
      throw new Error('Commande introuvable');
    }

    // Générer un QR Code seulement pour PICKUP ou DINE_IN
    if (
      order.fulfillmentType !== FulfillmentType.PICKUP &&
      order.fulfillmentType !== FulfillmentType.DINE_IN
    ) {
      this.logger.warn(
        `[QR Code] Commande #${orderId} n'est pas en mode PICKUP/DINE_IN`,
      );
      return null;
    }

    const qrCode = this.generateQrCode(orderId);
    order.qrCode = qrCode;
    await this.orderRepository.save(order);

    return qrCode;
  }

  /**
   * Valide un QR Code et retourne la commande associée
   */
  async validateQrCode(qrCode: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { qrCode },
    });

    if (!order) {
      throw new Error('QR Code invalide');
    }

    this.logger.log(`[QR Code] QR Code validé pour la commande #${order.id}`);

    return order;
  }

  /**
   * Marque une commande comme complétée via QR Code
   */
  async completeOrderViaQrCode(
    qrCode: string,
    businessId: string,
  ): Promise<Order> {
    const order = await this.validateQrCode(qrCode);

    // Vérifier que la commande appartient bien à ce commerce
    if (order.businessId !== businessId) {
      throw new Error(
        'Ce QR Code ne correspond pas à une commande de votre commerce',
      );
    }

    // Vérifier que la commande est dans un état approprié
    if (
      order.status !== OrderStatus.PAID &&
      order.status !== OrderStatus.IN_PREPARATION
    ) {
      throw new Error('Cette commande ne peut pas être complétée via QR Code');
    }

    // Marquer comme complétée
    order.status = OrderStatus.COMPLETED;
    await this.orderRepository.save(order);

    this.logger.log(
      `[QR Code] Commande #${order.id} complétée via QR Code par le commerce #${businessId}`,
    );

    return order;
  }
}
