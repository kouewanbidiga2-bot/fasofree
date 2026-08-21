import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Subscription,
  SubscriptionPlan,
  SubscriptionSubjectType,
} from './entities/subscription.entity';
import {
  SubscriptionPlanEntity,
  PLAN_CODE_STARTER,
  PLAN_CODE_PRO,
  PLAN_CODE_VIP,
} from './entities/subscription-plan.entity';
import { WalletService } from '../wallets/wallet.service';
import { UserRole as WalletUserRole } from '../wallets/entities/wallet.entity';
import { TransactionReason } from '../wallets/entities/wallet-transaction.entity';
import { User } from '../users/entities/user.entity';
import { Business } from '../businesses/entities/business.entity';

export const MERCHANT_COMMISSION_RATES = {
  STARTER: 0.05, // Plan gratuit : 5% de commission
  BOOST_PRO: 0.015, // Boost Pro (5000 FCFA/mois) : 1.5% de commission
} as const;

export const SERVICE_FEE_DEFAULT = 100; // FCFA - par commande (0 si client VIP)
export const MIN_MERCHANT_COMMISSION_RATE = 0.015; // 1.5% minimum (taux préférentiel inclus)
export const MIN_MERCHANT_PLAN_PRICE = 5000; // FCFA - prix plancher des forfaits marchands payants (0 = gratuit, ex. Starter)

/** Cache dynamique rempli par SettingsService.onModuleInit() */
export const subscriptionFeeCache = { platformFee: null as number | null };

function merchantPlanPriceError(price: number): string {
  return `Le prix minimum d'un forfait marchand payant est de ${MIN_MERCHANT_PLAN_PRICE.toLocaleString('fr-FR')} FCFA (reçu : ${price.toLocaleString('fr-FR')} FCFA). Le plan gratuit Starter reste à 0 FCFA.`;
}

// 🌱 Forfaits par défaut FasoFree (créés si absents — l'admin peut ensuite les éditer)
export const DEFAULT_PLANS: Array<Partial<SubscriptionPlanEntity>> = [
  {
    code: PLAN_CODE_STARTER,
    name: 'Starter',
    subjectType: SubscriptionSubjectType.MERCHANT,
    description:
      'Plan gratuit pour débuter : commission standard de 5% par commande.',
    priceFcfa: 0,
    durationDays: 3650, // 10 ans (gratuit)
    commissionRate: MERCHANT_COMMISSION_RATES.STARTER,
    freeServiceFee: false,
    freeDelivery: false,
    freeDeliveryMinSubtotal: 0,
    isActive: true,
  },
  {
    code: PLAN_CODE_PRO,
    name: 'Pro',
    subjectType: SubscriptionSubjectType.MERCHANT,
    description:
      'Boostez votre commerce : commission réduite à 1,5% par commande.',
    priceFcfa: 5000,
    durationDays: 30,
    commissionRate: MERCHANT_COMMISSION_RATES.BOOST_PRO,
    freeServiceFee: false,
    freeDelivery: false,
    freeDeliveryMinSubtotal: 0,
    isActive: true,
  },
  {
    code: PLAN_CODE_VIP,
    name: 'FasoFree Pass VIP',
    subjectType: SubscriptionSubjectType.CUSTOMER,
    description:
      'Frais de plateforme (100 FCFA/commande) offerts pendant toute la durée.',
    priceFcfa: 2500,
    durationDays: 30,
    commissionRate: null,
    freeServiceFee: true,
    freeDelivery: false,
    freeDeliveryMinSubtotal: 0,
    isActive: true,
  },
];

export interface PremiumStatus {
  isPremium: boolean;
  planCode: string | null;
  planName: string | null;
  expiresAt: Date | null;
  subscription: Subscription | null;
}

@Injectable()
export class SubscriptionService implements OnModuleInit {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    @InjectRepository(SubscriptionPlanEntity)
    private readonly planRepository: Repository<SubscriptionPlanEntity>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
    private readonly walletService: WalletService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureDefaultPlans();
  }

  /**
   * 🌱 Crée les forfaits par défaut s'ils n'existent pas encore.
   * Idempotent : n'écrase jamais les modifications faites par le Super Admin.
   */
  async ensureDefaultPlans(): Promise<void> {
    for (const plan of DEFAULT_PLANS) {
      const existing = await this.planRepository.findOne({
        where: { code: plan.code as string },
      });
      if (existing) continue;
      await this.planRepository.save(this.planRepository.create(plan));
      this.logger.log(
        `[Plans] Forfait par défaut créé : ${plan.code} (${plan.priceFcfa} FCFA / ${plan.durationDays} j)`,
      );
    }
  }

  // ============================================================
  // 📦 CATALOGUE DE FORFAITS (Super Admin)
  // ============================================================

  async getPlans(subjectType?: SubscriptionSubjectType): Promise<SubscriptionPlanEntity[]> {
    return this.planRepository.find({
      where: subjectType ? { subjectType } : {},
      order: { code: 'ASC' },
    });
  }

  async getPlanByCode(code: string): Promise<SubscriptionPlanEntity> {
    const plan = await this.planRepository.findOne({ where: { code } });
    if (!plan) {
      throw new NotFoundException(`Forfait "${code}" introuvable`);
    }
    return plan;
  }

  async getPlanOrNull(code: string): Promise<SubscriptionPlanEntity | null> {
    if (!code) return null;
    return this.planRepository.findOne({ where: { code } });
  }

  async createPlan(input: {
    code: string;
    name: string;
    subjectType: SubscriptionSubjectType;
    priceFcfa: number;
    durationDays?: number;
    commissionRate?: number | null;
    freeServiceFee?: boolean;
    freeDelivery?: boolean;
    freeDeliveryMinSubtotal?: number;
    description?: string;
    isActive?: boolean;
  }): Promise<SubscriptionPlanEntity> {
    const code = input.code?.trim().toUpperCase();
    if (!code) {
      throw new BadRequestException('Le code du forfait est obligatoire');
    }
    const existing = await this.planRepository.findOne({ where: { code } });
    if (existing) {
      throw new ConflictException(`Le forfait "${code}" existe déjà`);
    }
    if (!Object.values(SubscriptionSubjectType).includes(input.subjectType)) {
      throw new BadRequestException('Type de sujet invalide');
    }
    if (
      input.commissionRate !== undefined &&
      input.commissionRate !== null &&
      Number(input.commissionRate) < MIN_MERCHANT_COMMISSION_RATE
    ) {
      throw new BadRequestException(
        `La commission minimale est de ${(MIN_MERCHANT_COMMISSION_RATE * 100).toLocaleString('fr-FR')}% par commande`,
      );
    }
    const price = Math.max(0, Number(input.priceFcfa) || 0);
    if (
      input.subjectType === SubscriptionSubjectType.MERCHANT &&
      price > 0 &&
      price < MIN_MERCHANT_PLAN_PRICE
    ) {
      throw new BadRequestException(merchantPlanPriceError(price));
    }

    const plan = this.planRepository.create({
      code,
      name: input.name,
      description: input.description ?? null,
      subjectType: input.subjectType,
      priceFcfa: price,
      durationDays: Math.max(1, input.durationDays ?? 30),
      commissionRate:
        input.commissionRate === undefined ? null : input.commissionRate,
      freeServiceFee: input.freeServiceFee ?? false,
      freeDelivery: input.freeDelivery ?? false,
      freeDeliveryMinSubtotal:
        Math.max(0, Number(input.freeDeliveryMinSubtotal) || 0),
      isActive: input.isActive ?? true,
    });

    const saved = await this.planRepository.save(plan);
    this.logger.log(`[Plans] Forfait créé : ${code} (${price} FCFA)`);
    return saved;
  }

  async updatePlan(
    code: string,
    input: Partial<{
      name: string;
      description: string | null;
      priceFcfa: number;
      durationDays: number;
      commissionRate: number | null;
      freeServiceFee: boolean;
      freeDelivery: boolean;
      freeDeliveryMinSubtotal: number;
      isActive: boolean;
    }>,
  ): Promise<SubscriptionPlanEntity> {
    const plan = await this.getPlanByCode(code);
    if (
      input.commissionRate !== undefined &&
      input.commissionRate !== null &&
      Number(input.commissionRate) < MIN_MERCHANT_COMMISSION_RATE
    ) {
      throw new BadRequestException(
        `La commission minimale est de ${(MIN_MERCHANT_COMMISSION_RATE * 100).toLocaleString('fr-FR')}% par commande`,
      );
    }
    if (input.name !== undefined) plan.name = input.name;
    if (input.description !== undefined) plan.description = input.description;
    if (input.priceFcfa !== undefined) {
      const nextPrice = Math.max(0, Number(input.priceFcfa) || 0);
      if (
        plan.subjectType === SubscriptionSubjectType.MERCHANT &&
        nextPrice > 0 &&
        nextPrice < MIN_MERCHANT_PLAN_PRICE
      ) {
        throw new BadRequestException(merchantPlanPriceError(nextPrice));
      }
      plan.priceFcfa = nextPrice;
    }
    if (input.durationDays !== undefined)
      plan.durationDays = Math.max(1, input.durationDays);
    if (input.commissionRate !== undefined)
      plan.commissionRate =
        input.commissionRate === null ? null : Number(input.commissionRate);
    if (input.freeServiceFee !== undefined)
      plan.freeServiceFee = input.freeServiceFee;
    if (input.freeDelivery !== undefined) plan.freeDelivery = input.freeDelivery;
    if (input.freeDeliveryMinSubtotal !== undefined)
      plan.freeDeliveryMinSubtotal = Math.max(0, Number(input.freeDeliveryMinSubtotal) || 0);
    if (input.isActive !== undefined) plan.isActive = input.isActive;

    const saved = await this.planRepository.save(plan);
    this.logger.log(`[Plans] Forfait mis à jour : ${code}`);
    return saved;
  }

  // ============================================================
  // 🧾 ABONNEMENTS ACTIFS
  // ============================================================

  /**
   * Abonnement actif d'un sujet (Client / Commerçant).
   * Retourne null si aucun abonnement actif (ou expiré).
   */
  async getActiveSubscription(
    subjectType: SubscriptionSubjectType,
    subjectId: string,
  ): Promise<Subscription | null> {
    if (!subjectId) return null;

    const now = new Date();
    const subscriptions = await this.subscriptionRepository.find({
      where: { subjectType, subjectId, isActive: true },
      order: { createdAt: 'DESC' },
    });

    return (
      subscriptions.find((sub) => !sub.endDate || sub.endDate >= now) ?? null
    );
  }

  /**
   * Code du plan actif d'un sujet (compat API historique).
   */
  async getActivePlan(
    subjectType: SubscriptionSubjectType,
    subjectId: string,
  ): Promise<string | null> {
    const active = await this.getActiveSubscription(subjectType, subjectId);
    return active?.plan ?? null;
  }

  async listSubscriptions(): Promise<Subscription[]> {
    return this.subscriptionRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * 💎 Le client est-il abonné VIP actif ?
   * (frais de plateforme 100 FCFA/commande offerts — la livraison reste payante)
   */
  async isVipActive(clientId: string): Promise<boolean> {
    if (!clientId) return false;
    const active = await this.getActiveSubscription(
      SubscriptionSubjectType.CUSTOMER,
      clientId,
    );
    if (!active) return false;
    const plan = await this.getPlanOrNull(active.plan);
    return !!plan && plan.isActive && plan.freeServiceFee;
  }

  /**
   * 💎 Statut premium complet d'un client (pour /auth/me et /subscriptions/me).
   */
  async getClientPremiumStatus(clientId: string): Promise<PremiumStatus> {
    const active = await this.getActiveSubscription(
      SubscriptionSubjectType.CUSTOMER,
      clientId,
    );
    if (!active) {
      return {
        isPremium: false,
        planCode: null,
        planName: null,
        expiresAt: null,
        subscription: null,
      };
    }
    const plan = await this.getPlanOrNull(active.plan);
    return {
      isPremium: !!plan && plan.isActive && plan.freeServiceFee,
      planCode: active.plan,
      planName: plan?.name ?? active.plan,
      expiresAt: active.endDate,
      subscription: active,
    };
  }

  /**
   * Frais de service client : 0 FCFA si VIP actif, sinon platformFee depuis SystemSettings (défaut 100 FCFA).
   */
  async resolveServiceFee(clientId: string): Promise<number> {
    const isVip = await this.isVipActive(clientId);
    if (isVip) return 0;
    if (subscriptionFeeCache.platformFee !== null) return subscriptionFeeCache.platformFee;
    return SERVICE_FEE_DEFAULT;
  }

  /**
   * Taux de commission marchand selon le plan actif du commerce.
   * Défaut : Starter (5%). Pro/Boost Pro : 1.5%. Toute autre valeur éditable.
   */
  async getMerchantCommissionRate(businessId: string): Promise<number> {
    if (!businessId) return MERCHANT_COMMISSION_RATES.STARTER;

    const active = await this.getActiveSubscription(
      SubscriptionSubjectType.MERCHANT,
      businessId,
    );
    if (!active) return MERCHANT_COMMISSION_RATES.STARTER;

    // Legacy BOOST_PRO → PRO
    const planCode =
      active.plan === SubscriptionPlan.BOOST_PRO
        ? SubscriptionPlan.PRO
        : active.plan;
    const plan = await this.getPlanOrNull(planCode);

    if (plan && plan.commissionRate !== null && plan.commissionRate !== undefined) {
      return Number(plan.commissionRate);
    }
    if (planCode === SubscriptionPlan.PRO) {
      return MERCHANT_COMMISSION_RATES.BOOST_PRO;
    }
    return MERCHANT_COMMISSION_RATES.STARTER;
  }

  // ============================================================
  // 📝 ASSIGNATION / RENOUVELLEMENT (Super Admin & Clients)
  // ============================================================

  /**
   * Assigne (ou renouvelle) un forfait à un commerce ou un client.
   * - renew=false : remplace l'abonnement actif (les anciens passent inactifs)
   * - renew=true  : prolonge l'abonnement actif existant de la durée choisie
   */
  async assignSubscription(params: {
    subjectType: SubscriptionSubjectType;
    subjectId: string;
    planCode: string;
    durationDays?: number;
    autoRenew?: boolean;
    renew?: boolean;
    debitWallet?: boolean;
  }): Promise<Subscription> {
    if (!params.subjectId) {
      throw new BadRequestException('Le sujet est obligatoire');
    }
    const plan = await this.getPlanByCode(params.planCode);
    if (!plan.isActive) {
      throw new BadRequestException(`Le forfait "${plan.code}" est désactivé`);
    }

    // Vérifier que le sujet existe
    if (params.subjectType === SubscriptionSubjectType.MERCHANT) {
      const business = await this.businessRepository.findOne({
        where: { id: params.subjectId },
      });
      if (!business) throw new NotFoundException('Commerce introuvable');
    } else if (params.subjectType === SubscriptionSubjectType.CUSTOMER) {
      const user = await this.userRepository.findOne({
        where: { id: params.subjectId },
      });
      if (!user) throw new NotFoundException('Client introuvable');
    } else {
      throw new BadRequestException('Type de sujet invalide');
    }

    const durationDays = Math.max(1, params.durationDays ?? plan.durationDays);

    // 💳 Mode "déductible" : l'abonnement est débité du portefeuille FasoFree
    // du marchand (ses gains en attente). false = abonnement accordé sans débit.
    if (params.debitWallet) {
      if (params.subjectType !== SubscriptionSubjectType.MERCHANT) {
        throw new BadRequestException(
          'Le débit du portefeuille ne s’applique qu’aux commerçants (MERCHANT)',
        );
      }
      if (Number(plan.priceFcfa) > 0) {
        const reference = `SUB-${Date.now()}-${Math.random()
          .toString(36)
          .substring(2, 8)
          .toUpperCase()}`;
        await this.walletService.debitWallet(
          params.subjectId,
          WalletUserRole.MERCHANT,
          Number(plan.priceFcfa),
          TransactionReason.SUBSCRIPTION_FEE,
          reference,
          `Abonnement ${plan.name} (${plan.durationDays} jours) - FasoFree`,
        );
      }
    }

    const existing = await this.getActiveSubscription(
      params.subjectType,
      params.subjectId,
    );

    // 🔄 Mode renouvellement : prolonger l'abonnement actif
    if (params.renew && existing) {
      const base =
        existing.endDate && existing.endDate > new Date()
          ? existing.endDate
          : new Date();
      const newEnd = new Date(base);
      newEnd.setDate(newEnd.getDate() + durationDays);
      existing.endDate = newEnd;
      existing.plan = plan.code;
      existing.autoRenew = params.autoRenew ?? existing.autoRenew;
      existing.isActive = true;
      const saved = await this.subscriptionRepository.save(existing);
      this.logger.log(
        `[Subscriptions] Renouvelé ${params.subjectType} ${params.subjectId} → ${plan.code} jusqu'au ${newEnd.toISOString()}`,
      );
      return saved;
    }

    // ⬇️ Nouvelle affectation : on désactive les abonnements précédents
    if (existing) {
      await this.subscriptionRepository.update(
        {
          subjectType: params.subjectType,
          subjectId: params.subjectId,
        },
        { isActive: false },
      );
    }

    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + durationDays);

    const subscription = this.subscriptionRepository.create({
      subjectType: params.subjectType,
      subjectId: params.subjectId,
      plan: plan.code,
      startDate,
      endDate,
      isActive: true,
      autoRenew: params.autoRenew ?? true,
    });
    const saved = await this.subscriptionRepository.save(subscription);
    this.logger.log(
      `[Subscriptions] Assigné ${params.subjectType} ${params.subjectId} → ${plan.code} (${durationDays} j)`,
    );
    return saved;
  }

  /**
   * 🔄 Renouvelle l'abonnement actif d'un sujet (prolongation de durée).
   */
  async renewSubscription(
    subjectType: SubscriptionSubjectType,
    subjectId: string,
    durationDays?: number,
  ): Promise<Subscription> {
    const active = await this.getActiveSubscription(subjectType, subjectId);
    if (!active) {
      throw new NotFoundException(
        "Aucun abonnement actif à renouveler pour ce sujet",
      );
    }
    const plan = await this.getPlanByCode(active.plan);
    const days = Math.max(1, durationDays ?? plan.durationDays);
    const base =
      active.endDate && active.endDate > new Date()
        ? active.endDate
        : new Date();
    const newEnd = new Date(base);
    newEnd.setDate(newEnd.getDate() + days);
    active.endDate = newEnd;
    active.isActive = true;
    const saved = await this.subscriptionRepository.save(active);
    this.logger.log(
      `[Subscriptions] Renouvelé ${subjectType} ${subjectId} jusqu'au ${newEnd.toISOString()}`,
    );
    return saved;
  }

  /**
   * 🛒 Abonnement client (FasoFree Pass) payé depuis le portefeuille FasoFree.
   * Débite le wallet CUSTOMER du prix du forfait puis crée l'abonnement actif.
   */
  async subscribeClient(
    clientId: string,
    planCode: string = SubscriptionPlan.VIP,
    options: { autoRenew?: boolean; durationDays?: number } = {},
  ): Promise<{
    subscription: Subscription;
    isPremium: boolean;
    expiresAt: Date | null;
  }> {
    const plan = await this.getPlanByCode(planCode);
    if (plan.subjectType !== SubscriptionSubjectType.CUSTOMER) {
      throw new BadRequestException(
        "Ce forfait n'est pas destiné aux clients",
      );
    }
    if (!plan.isActive) {
      throw new BadRequestException(`Le forfait "${plan.code}" est désactivé`);
    }

    const existing = await this.getActiveSubscription(
      SubscriptionSubjectType.CUSTOMER,
      clientId,
    );
    if (existing) {
      throw new BadRequestException(
        'Vous possédez déjà un abonnement actif (renouvelez-le ou attendez son expiration)',
      );
    }

    const price = Number(plan.priceFcfa) || 0;

    // 💳 Débit du portefeuille FasoFree du client
    const reference = `SUB-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase()}`;
    await this.walletService.debitWallet(
      clientId,
      WalletUserRole.CUSTOMER,
      price,
      TransactionReason.SUBSCRIPTION_FEE,
      reference,
      `Abonnement ${plan.name} (${plan.durationDays} jours) - FasoFree`,
    );

    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(
      endDate.getDate() + Math.max(1, options.durationDays ?? plan.durationDays),
    );

    const subscription = this.subscriptionRepository.create({
      subjectType: SubscriptionSubjectType.CUSTOMER,
      subjectId: clientId,
      plan: plan.code,
      startDate,
      endDate,
      isActive: true,
      autoRenew: options.autoRenew ?? true,
    });
    const saved = await this.subscriptionRepository.save(subscription);
    this.logger.log(
      `[Subscriptions] Client ${clientId} abonné → ${plan.code} (${price} FCFA débités), expire le ${endDate.toISOString()}`,
    );
    return {
      subscription: saved,
      isPremium: true,
      expiresAt: endDate,
    };
  }

  /**
   * 🏪 Abonnement marchand (ex: plan Pro) payé depuis le portefeuille FasoFree
   * du commerce. "Abonnement obligatoire ou déductible" : le marchand doit
   * être abonné pour bénéficier du taux préférentiel, et le prix est débité
   * de son portefeuille (gains en attente). Solde insuffisant → 400.
   */
  async subscribeMerchant(
    businessId: string,
    planCode: string = SubscriptionPlan.PRO,
    options: {
      autoRenew?: boolean;
      durationDays?: number;
      operatorUserId?: string;
      operatorRole?: string;
    } = {},
  ): Promise<{
    subscription: Subscription;
    businessId: string;
    expiresAt: Date | null;
  }> {
    const plan = await this.getPlanByCode(planCode);
    if (plan.subjectType !== SubscriptionSubjectType.MERCHANT) {
      throw new BadRequestException(
        "Ce forfait n'est pas destiné aux commerçants",
      );
    }
    if (!plan.isActive) {
      throw new BadRequestException(`Le forfait "${plan.code}" est désactivé`);
    }

    const business = await this.businessRepository.findOne({
      where: { id: businessId },
    });
    if (!business) throw new NotFoundException('Commerce introuvable');

    // 🛡️ Seul le propriétaire du commerce (ou le Super Admin) peut s'abonner
    if (
      options.operatorRole !== 'super_admin' &&
      business.ownerId !== options.operatorUserId
    ) {
      throw new ForbiddenException(
        'Vous ne pouvez pas gérer ce commerce',
      );
    }

    const existing = await this.getActiveSubscription(
      SubscriptionSubjectType.MERCHANT,
      businessId,
    );
    if (existing) {
      throw new BadRequestException(
        'Ce commerce possède déjà un abonnement actif (renouvelez-le ou attendez son expiration)',
      );
    }

    const price = Number(plan.priceFcfa) || 0;
    const reference = `SUB-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase()}`;
    await this.walletService.debitWallet(
      businessId,
      WalletUserRole.MERCHANT,
      price,
      TransactionReason.SUBSCRIPTION_FEE,
      reference,
      `Abonnement ${plan.name} (${plan.durationDays} jours) - FasoFree`,
    );

    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(
      endDate.getDate() + Math.max(1, options.durationDays ?? plan.durationDays),
    );

    const subscription = this.subscriptionRepository.create({
      subjectType: SubscriptionSubjectType.MERCHANT,
      subjectId: businessId,
      plan: plan.code,
      startDate,
      endDate,
      isActive: true,
      autoRenew: options.autoRenew ?? true,
    });
    const saved = await this.subscriptionRepository.save(subscription);
    this.logger.log(
      `[Subscriptions] Commerçant ${businessId} abonné → ${plan.code} (${price} FCFA débités), expire le ${endDate.toISOString()}`,
    );
    return {
      subscription: saved,
      businessId,
      expiresAt: endDate,
    };
  }
}
