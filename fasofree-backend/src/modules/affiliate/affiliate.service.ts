/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { randomBytes } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { AffiliateLink } from './entities/affiliate-link.entity';
import {
  AffiliateEvent,
  AffiliateEventType,
} from './entities/affiliate-event.entity';
import { Business } from '../businesses/entities/business.entity';
import { User } from '../users/entities/user.entity';
import { AFFILIATE_ORDER_CREATED } from './affiliate.events';
import type { AffiliateOrderCreatedPayload } from './affiliate.events';
import { USER_REGISTERED } from '../promotions/events/promotion.events';

export interface AffiliateStats {
  businessId: string;
  businessName: string;
  code: string;
  url: string;
  clicks: number;
  signups: number;
  orders: number;
  revenue: number;
  // Taux de conversion clic → commande (%)
  conversionRate: number;
}

/**
 * 🔗 Liens de suivi marchand (affiliation).
 *
 * Le commerce génère un lien court `/r/CODE`. Chaque passage enregistre un
 * clic ; un client qui s'inscrit via le lien est rattaché au commerce
 * (`user.affiliateCode`) ; chaque commande de ce client chez ce commerce
 * alimente le funnel (clics → clients → commandes → revenus).
 *
 * Le service ne lève jamais d'erreur métier vers l'appelant pour les stats :
 * une stats en échec ne doit jamais bloquer l'affichage.
 */
@Injectable()
export class AffiliateService {
  private readonly logger = new Logger(AffiliateService.name);

  constructor(
    @InjectRepository(AffiliateLink)
    private readonly linkRepo: Repository<AffiliateLink>,
    @InjectRepository(AffiliateEvent)
    private readonly eventRepo: Repository<AffiliateEvent>,
    @InjectRepository(Business)
    private readonly businessRepo: Repository<Business>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly config: ConfigService,
  ) {}

  /** URL publique du lien court (`https://api.fasofree.site/r/CODE`). */
  private shortLinkUrl(code: string): string {
    const apiUrl = this.config.get<string>(
      'API_URL',
      'https://api.fasofree.site',
    );
    return `${apiUrl.replace(/\/$/, '')}/r/${code}`;
  }

  /** Front client, cible de la redirection. */
  private clientUrl(): string {
    return this.config
      .get<string>('CLIENT_URL', 'https://www.fasofree.site')
      .replace(/\/$/, '');
  }

  private generateCode(): string {
    // Code lisible + unique : FF-XXXXXX (6 hex aléatoires)
    const rand = randomBytes(3).toString('hex').toUpperCase();
    return `FF-${rand}`;
  }

  /** Récupère (ou crée) le lien de suivi d'un commerce. */
  async getOrCreateLink(businessId: string): Promise<AffiliateLink> {
    const existing = await this.linkRepo.findOne({ where: { businessId } });
    if (existing) return existing;

    // Collision possible sur le code (unique) → on réessaie.
    for (let i = 0; i < 5; i++) {
      try {
        return await this.linkRepo.save(
          this.linkRepo.create({ businessId, code: this.generateCode() }),
        );
      } catch (err) {
        this.logger.warn(
          `[Affiliate] Code en collision, nouvel essai (${i + 1}/5): ${(err as Error).message}`,
        );
      }
    }
    throw new Error('Impossible de générer un code de suivi unique');
  }

  /** Enregistre un clic sur un lien court. Retourne le lien (null si inconnu). */
  async recordClick(code: string): Promise<AffiliateLink | null> {
    const link = await this.linkRepo.findOne({ where: { code } });
    if (!link) return null;
    await this.eventRepo.save(
      this.eventRepo.create({
        linkId: link.id,
        businessId: link.businessId,
        type: AffiliateEventType.CLICK,
        userId: null,
      }),
    );
    return link;
  }

  /** Résout un code vers un businessId (null si inconnu). */
  async resolveCode(code: string): Promise<string | null> {
    const link = await this.linkRepo.findOne({ where: { code } });
    return link?.businessId ?? null;
  }

  /**
   * Attache un code affilié à un utilisateur (à l'inscription).
   * Idempotent : une 2ᵉ tentative sur le même utilisateur ne duplique pas.
   */
  async attachToUser(userId: string, code: string): Promise<boolean> {
    const link = await this.linkRepo.findOne({ where: { code } });
    if (!link) return false;

    const already = await this.eventRepo.findOne({
      where: {
        linkId: link.id,
        type: AffiliateEventType.SIGNUP,
        userId,
      },
    });
    if (already) return true;

    await this.eventRepo.save(
      this.eventRepo.create({
        linkId: link.id,
        businessId: link.businessId,
        type: AffiliateEventType.SIGNUP,
        userId,
      }),
    );
    return true;
  }

  /**
   * Enregistre une commande issue d'un lien affilié.
   * Idempotent : une commande given n'est comptée qu'une fois.
   */
  async recordOrder(
    userId: string,
    businessId: string,
    orderId: string,
    amount: number,
  ): Promise<boolean> {
    const link = await this.linkRepo.findOne({ where: { businessId } });
    if (!link) return false;

    // Vérifie que le client vient bien de CE lien
    const signup = await this.eventRepo.findOne({
      where: {
        linkId: link.id,
        type: AffiliateEventType.SIGNUP,
        userId,
      },
    });
    if (!signup) return false;

    const already = await this.eventRepo.findOne({
      where: {
        linkId: link.id,
        type: AffiliateEventType.ORDER,
        orderId,
      },
    });
    if (already) return true;

    await this.eventRepo.save(
      this.eventRepo.create({
        linkId: link.id,
        businessId,
        type: AffiliateEventType.ORDER,
        userId,
        orderId,
        amount,
      }),
    );
    return true;
  }

  // ── Câblage automatique du funnel (sans dépendance circulaire) ─────

  /**
   * Inscription : le client transmet son code affilié (cookie `aff_code`
   * lu par le front, ou paramètre `?ref=`). On rattache l'utilisateur ET
   * on mémorise le code sur son profil pour les commandes futures.
   */
  @OnEvent(USER_REGISTERED, { async: true })
  async onUserRegistered(payload: {
    userId: string;
    affiliateCode?: string | null;
  }): Promise<void> {
    const code = payload?.affiliateCode;
    if (!code) return;

    try {
      const attached = await this.attachToUser(payload.userId, code);
      if (!attached) {
        this.logger.warn(`[Affiliate] Code inconnu à l'inscription: ${code}`);
        return;
      }
      await this.userRepo.update(payload.userId, { affiliateCode: code });
    } catch (err) {
      this.logger.error(
        `[Affiliate] Rattachement inscription impossible: ${(err as Error).message}`,
      );
    }
  }

  /** Commande créée : alimente le tunnel si le client vient d'un lien. */
  @OnEvent(AFFILIATE_ORDER_CREATED, { async: true })
  async onOrderCreated(payload: AffiliateOrderCreatedPayload): Promise<void> {
    if (!payload?.orderId || !payload.clientId || !payload.businessId) return;
    try {
      await this.recordOrder(
        payload.clientId,
        payload.businessId,
        payload.orderId,
        Number(payload.amount) || 0,
      );
    } catch (err) {
      this.logger.error(
        `[Affiliate] Enregistrement commande impossible: ${(err as Error).message}`,
      );
    }
  }

  // ── Statistiques ──────────────────────────────────────────────────

  /** Nom du commerce, tolérant aux commerces supprimés. */
  private async businessName(businessId: string): Promise<string> {
    const business = await this.businessRepo.findOne({
      where: { id: businessId },
      select: { name: true },
    });
    return business?.name || 'Commerce';
  }

  /** Stats de funnel pour un commerce. */
  async getStats(businessId: string): Promise<AffiliateStats | null> {
    try {
      const link = await this.linkRepo.findOne({ where: { businessId } });
      const businessName = await this.businessName(businessId);

      if (!link) {
        return {
          businessId,
          businessName,
          code: '',
          url: '',
          clicks: 0,
          signups: 0,
          orders: 0,
          revenue: 0,
          conversionRate: 0,
        };
      }

      const [clicks, signups, orders, revenue] = await Promise.all([
        this.countEvents(link.id, AffiliateEventType.CLICK),
        this.countEvents(link.id, AffiliateEventType.SIGNUP),
        this.countEvents(link.id, AffiliateEventType.ORDER),
        this.sumRevenue(link.id),
      ]);

      const conversionRate =
        clicks > 0 ? Math.round((orders / clicks) * 1000) / 10 : 0;

      return {
        businessId,
        businessName,
        code: link.code,
        url: this.shortLinkUrl(link.code),
        clicks,
        signups,
        orders,
        revenue,
        conversionRate,
      };
    } catch (err) {
      this.logger.error(
        `[Affiliate] stats impossible: ${(err as Error).message}`,
      );
      return null;
    }
  }

  private countEvents(
    linkId: string,
    type: AffiliateEventType,
  ): Promise<number> {
    return this.eventRepo.count({ where: { linkId, type } });
  }

  private async sumRevenue(linkId?: string): Promise<number> {
    const qb = this.eventRepo
      .createQueryBuilder('e')
      .select('COALESCE(SUM(e.amount), 0)', 'total')
      .where('e.type = :type', { type: AffiliateEventType.ORDER });
    if (linkId) qb.andWhere('e.linkId = :linkId', { linkId });

    const row = await qb.getRawOne<{ total: string }>();
    return Number(row?.total ?? 0);
  }

  /** Vue globale pour le Super Admin. */
  async getGlobalStats(): Promise<{
    totalLinks: number;
    totalClicks: number;
    totalSignups: number;
    totalOrders: number;
    totalRevenue: number;
    topBusinesses: Array<{
      businessId: string;
      businessName: string;
      code: string;
      clicks: number;
      signups: number;
      orders: number;
      revenue: number;
    }>;
  }> {
    const [totalLinks, totalClicks, totalSignups, totalOrders, totalRevenue] =
      await Promise.all([
        this.linkRepo.count(),
        this.eventRepo.count({ where: { type: AffiliateEventType.CLICK } }),
        this.eventRepo.count({ where: { type: AffiliateEventType.SIGNUP } }),
        this.eventRepo.count({ where: { type: AffiliateEventType.ORDER } }),
        this.sumRevenue(),
      ]);

    // Top commerces : une seule requête agrégée (clics, signups, commandes,
    // revenus) pour éviter le N+1 sur l'ancienne version.
    const rows = await this.eventRepo
      .createQueryBuilder('e')
      .select('e.businessId', 'businessId')
      .addSelect(`COUNT(*) FILTER (WHERE e.type = :click)`, 'clicks')
      .addSelect(`COUNT(*) FILTER (WHERE e.type = :signup)`, 'signups')
      .addSelect(`COUNT(*) FILTER (WHERE e.type = :order)`, 'orders')
      .addSelect(
        `COALESCE(SUM(e.amount) FILTER (WHERE e.type = :order), 0)`,
        'revenue',
      )
      .setParameters({
        click: AffiliateEventType.CLICK,
        signup: AffiliateEventType.SIGNUP,
        order: AffiliateEventType.ORDER,
      })
      .groupBy('e.businessId')
      .orderBy('orders', 'DESC')
      .limit(10)
      .getRawMany<{
        businessId: string;
        clicks: string;
        signups: string;
        orders: string;
        revenue: string;
      }>();

    // Résolution groupée des noms + codes (2 requêtes, pas 2 × N).
    const ids = rows.map((r) => r.businessId);
    const [businesses, links] = await Promise.all([
      ids.length
        ? this.businessRepo.find({
            where: ids.map((id) => ({ id })),
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      ids.length
        ? this.linkRepo.find({ where: ids.map((id) => ({ businessId: id })) })
        : Promise.resolve([]),
    ]);

    const nameById = new Map(businesses.map((b) => [b.id, b.name]));
    const linkByBiz = new Map(links.map((l) => [l.businessId, l]));

    const topBusinesses = rows.map((r) => {
      const link = linkByBiz.get(r.businessId);
      return {
        businessId: r.businessId,
        businessName: nameById.get(r.businessId) || 'Commerce',
        code: link?.code || '',
        clicks: Number(r.clicks),
        signups: Number(r.signups),
        orders: Number(r.orders),
        revenue: Number(r.revenue),
      };
    });

    return {
      totalLinks,
      totalClicks,
      totalSignups,
      totalOrders,
      totalRevenue,
      topBusinesses,
    };
  }
}
