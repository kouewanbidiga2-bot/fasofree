import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Subscription,
  SubscriptionPlan,
  SubscriptionSubjectType,
} from './entities/subscription.entity';

export const MERCHANT_COMMISSION_RATES = {
  STARTER: 0.05, // Plan gratuit : 5% de commission
  BOOST_PRO: 0.015, // Boost Pro (5000 FCFA/mois) : 1.5% de commission
} as const;

export const SERVICE_FEE_DEFAULT = 100; // FCFA - par commande (0 si VIP)

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
  ) {}

  /**
   * Récupère le plan actif d'un sujet (Client VIP / Commerçant Boost Pro)
   * Retourne null si aucun abonnement actif.
   */
  async getActivePlan(
    subjectType: SubscriptionSubjectType,
    subjectId: string,
  ): Promise<SubscriptionPlan | null> {
    if (!subjectId) return null;

    const now = new Date();
    const subscriptions = await this.subscriptionRepository.find({
      where: { subjectType, subjectId, isActive: true },
      order: { createdAt: 'DESC' },
    });

    const active = subscriptions.find(
      (sub) => !sub.endDate || sub.endDate >= now,
    );

    return active?.plan ?? null;
  }

  /**
   * Le client est-il abonné FasoFree VIP actif ? (frais de service offerts)
   */
  async isVipActive(clientId: string): Promise<boolean> {
    if (!clientId) return false;
    const plan = await this.getActivePlan(
      SubscriptionSubjectType.CUSTOMER,
      clientId,
    );
    return plan === SubscriptionPlan.VIP;
  }

  /**
   * Taux de commission marchand selon le plan actif du commerce.
   * Défaut : Starter (5%). Boost Pro : 1.5%.
   */
  async getMerchantCommissionRate(businessId: string): Promise<number> {
    if (!businessId) return MERCHANT_COMMISSION_RATES.STARTER;

    const plan = await this.getActivePlan(
      SubscriptionSubjectType.MERCHANT,
      businessId,
    );

    return plan === SubscriptionPlan.BOOST_PRO
      ? MERCHANT_COMMISSION_RATES.BOOST_PRO
      : MERCHANT_COMMISSION_RATES.STARTER;
  }

  /**
   * Frais de service client : 0 FCFA si VIP actif, sinon 100 FCFA.
   */
  async resolveServiceFee(clientId: string): Promise<number> {
    const isVip = await this.isVipActive(clientId);
    return isVip ? 0 : SERVICE_FEE_DEFAULT;
  }
}
