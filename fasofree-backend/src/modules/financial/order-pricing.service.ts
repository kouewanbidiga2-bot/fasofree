import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderType } from '../orders/entities/order.entity';
import { SubscriptionService } from '../subscriptions/subscription.service';

/**
 * 🧾 Ventilation financière complète d'une commande (modèle hybride FasoFree).
 * Le legacy (`productsSubtotal`, `platformCommission`, `merchantPayoutAmount`,
 * `commissionPayer`) est conservé pour ne rien casser côté payouts/disputes/analytics.
 */
export interface OrderFinancialBreakdown {
  productsSubtotal: number;
  itemsTotal: number;
  deliveryFee: number;
  serviceFee: number;
  merchantCommissionAmount: number;
  driverCommissionAmount: number;
  platformCommission: number;
  totalAmount: number;
  merchantPayoutAmount: number;
  commissionPayer: 'CLIENT' | 'MERCHANT';
}

@Injectable()
export class OrderPricingService {
  private readonly logger = new Logger(OrderPricingService.name);

  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 🧮 Moteur de calcul financier FasoFree (modèle hybride) :
   * - serviceFee : 100 FCFA, offert si le client est FasoFree VIP
   * - merchantCommission : 5% (Starter) ou 1.5% (Boost Pro) selon le plan du commerce
   * - P2P : itemsTotal = 0, commission marchand = 0 (prix distance + serviceFee)
   * - driverCommissionAmount : calculé à la livraison (micro-commission 1%)
   */
  async calculateFinancials(
    productsSubtotal: number,
    requestedDeliveryFee: number,
    options: {
      clientId?: string;
      businessId?: string;
      orderType?: OrderType;
    } = {},
  ): Promise<OrderFinancialBreakdown> {
    const subtotal = Math.max(0, Number(productsSubtotal) || 0);
    const deliveryFee = Number(requestedDeliveryFee) || 0;
    const payer = this.configService.get<'CLIENT' | 'MERCHANT'>(
      'FASOFREE_COMMISSION_PAYER',
      'CLIENT',
    );

    const isP2P = options.orderType === OrderType.P2P_DELIVERY;

    const serviceFee = await this.subscriptionService.resolveServiceFee(
      options.clientId ?? '',
    );
    const commissionRate =
      await this.subscriptionService.getMerchantCommissionRate(
        options.businessId ?? '',
      );

    const itemsTotal = isP2P ? 0 : subtotal;
    const merchantCommissionAmount = isP2P
      ? 0
      : Math.round(itemsTotal * commissionRate);

    // Recette plateforme : commission marchand + frais de service (+ micro-commission livreur à la livraison)
    const platformCommission = merchantCommissionAmount + serviceFee;

    let totalAmount: number;
    let merchantPayoutAmount: number;

    if (payer === 'CLIENT') {
      totalAmount =
        itemsTotal + deliveryFee + serviceFee + merchantCommissionAmount;
      merchantPayoutAmount = itemsTotal; // le client paie la commission
    } else {
      totalAmount = itemsTotal + deliveryFee + serviceFee;
      merchantPayoutAmount = itemsTotal - merchantCommissionAmount;
    }

    const breakdown: OrderFinancialBreakdown = {
      productsSubtotal: itemsTotal,
      itemsTotal,
      deliveryFee,
      serviceFee,
      merchantCommissionAmount,
      driverCommissionAmount: 0, // déterminé à la livraison
      platformCommission,
      totalAmount,
      merchantPayoutAmount,
      commissionPayer: payer,
    };

    this.logger.log(
      `[Pricing] Total: ${breakdown.totalAmount} FCFA = items ${itemsTotal} + livraison ${deliveryFee} + service ${serviceFee} + commission ${merchantCommissionAmount}`,
    );

    return breakdown;
  }
}
