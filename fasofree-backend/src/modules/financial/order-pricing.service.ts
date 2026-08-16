import { Injectable, Logger } from '@nestjs/common';
import { OrderType } from '../orders/entities/order.entity';
import {
  SERVICE_FEE_DEFAULT,
  SubscriptionService,
} from '../subscriptions/subscription.service';

/**
 * Tarification publique FasoFree (règles métier affichées au client).
 * - MIN_DELIVERY_FEE : toute livraison (commerces ou P2P) est facturée au minimum 800 FCFA.
 * - PLATFORM_FEE    : frais de plateforme fixes de 100 FCFA par commande (0 si client VIP).
 * - Total = Sous-total articles + DELIVERY_FEE + PLATFORM_FEE.
 */
export const MIN_DELIVERY_FEE = 800;
export const PLATFORM_FEE_DEFAULT = SERVICE_FEE_DEFAULT;

export interface PricingQuote {
  subtotal: number;
  deliveryFee: number;
  platformFee: number;
  total: number;
  currency: 'FCFA';
}

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

  constructor(private readonly subscriptionService: SubscriptionService) {}

  /**
   * 🧮 Moteur de calcul financier FasoFree (modèle hybride) :
   * - DELIVERY_FEE = max(calcul distance GPS, MIN_DELIVERY_FEE=800), 0 si PICKUP/DINE_IN
   * - serviceFee (frais plateforme) : 100 FCFA, offert si le client est FasoFree VIP
   * - merchantCommission : 5% (Starter) ou 1.5% (Boost Pro) selon le plan du commerce,
   *   prélevée sur le payout marchand (le client ne la voit jamais dans son total)
   * - P2P : itemsTotal = 0, commission marchand = 0 (prix distance + frais plateforme)
   * - driverCommissionAmount : calculé à la livraison (micro-commission 1%)
   * Total client (affiché panier/reçu) = Sous-total + DELIVERY_FEE + PLATFORM_FEE.
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
    const rawDeliveryFee = Number(requestedDeliveryFee) || 0;
    // DELIVERY_FEE = max(calcul, 800) ; 0 pour les commandes sans livraison (PICKUP/DINE_IN).
    // ⚠️ Le client VIP bénéficie UNIQUEMENT des frais de service offerts (jamais de livraison gratuite).
    // 🏍️ RIDE : tarif course (distance × 200 FCFA/km, minimum 500 FCFA) SANS plancher de livraison.
    const isRide = options.orderType === OrderType.RIDE;
    const deliveryFee =
      rawDeliveryFee > 0
        ? isRide
          ? Math.max(1, Math.round(rawDeliveryFee))
          : Math.max(rawDeliveryFee, MIN_DELIVERY_FEE)
        : 0;

    const isP2P = options.orderType === OrderType.P2P_DELIVERY;

    const serviceFee = await this.subscriptionService.resolveServiceFee(
      options.clientId ?? '',
    );
    const commissionRate =
      await this.subscriptionService.getMerchantCommissionRate(
        options.businessId ?? '',
      );

    const itemsTotal = isP2P || isRide ? 0 : subtotal;
    const merchantCommissionAmount =
      isP2P || isRide ? 0 : Math.round(itemsTotal * commissionRate);

    // Recette plateforme : commission marchand + frais de service (+ micro-commission livreur à la livraison)
    const platformCommission = merchantCommissionAmount + serviceFee;

    // Total client conforme à la règle publique : items + livraison + frais plateforme.
    // La commission marchand est déduite du payout (le client ne la paie pas en direct).
    const totalAmount = itemsTotal + deliveryFee + serviceFee;
    const merchantPayoutAmount = itemsTotal - merchantCommissionAmount;
    const payer: 'CLIENT' | 'MERCHANT' = 'MERCHANT';

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
      `[Pricing] Total client: ${breakdown.totalAmount} FCFA = items ${itemsTotal} + livraison ${deliveryFee} + frais plateforme ${serviceFee} (commission marchand ${merchantCommissionAmount} sur payout)`,
    );

    return breakdown;
  }

  /**
   * 💬 Devis public affiché au panier/checkout : renvoie exactement les montants
   * qui seront verrouillés lors du POST /orders (Total = Sous-total + livraison + plateforme).
   */
  async getQuoteBreakdown(input: {
    subtotal: number;
    deliveryFee: number;
    clientId?: string;
    orderType?: OrderType;
  }): Promise<PricingQuote> {
    const subtotal = Math.max(0, Number(input.subtotal) || 0);
    const rawDeliveryFee = Number(input.deliveryFee) || 0;
    // 🏍️ RIDE : pas de plancher de livraison (800 FCFA) — tarif course (min 500 FCFA).
    const isRide = input.orderType === OrderType.RIDE;
    const deliveryFee =
      rawDeliveryFee > 0
        ? isRide
          ? Math.max(1, Math.round(rawDeliveryFee))
          : Math.max(rawDeliveryFee, MIN_DELIVERY_FEE)
        : 0;
    const platformFee = await this.subscriptionService.resolveServiceFee(
      input.clientId ?? '',
    );

    const quote: PricingQuote = {
      subtotal,
      deliveryFee,
      platformFee,
      total: subtotal + deliveryFee + platformFee,
      currency: 'FCFA',
    };

    this.logger.log(
      `[Quote] Sous-total ${quote.subtotal} + livraison ${quote.deliveryFee} + plateforme ${quote.platformFee} = ${quote.total} FCFA`,
    );

    return quote;
  }
}
