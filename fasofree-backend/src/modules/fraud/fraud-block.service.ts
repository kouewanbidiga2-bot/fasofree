import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FraudBlock } from './entities/fraud-block.entity';
import { Order } from '../orders/entities/order.entity';
import { User } from '../users/entities/user.entity';
import { AuditService } from '../audit/audit.service';

export interface FraudRuleSettings {
  enabled: boolean;
  windowMinutes: number;
  maxOrders: number;
  blockHours: number;
  phoneRule: boolean;
}

/**
 * 🚫 Règle anti-fraude : trop de commandes sur une courte fenêtre → blocage
 * temporaire du compte.
 *
 * Règle par défaut : **par compte** (clientId). Un numéro partagé
 * (entreprise, famille, complaint groupé) n'est donc PAS coupé à cause d'un
 * seul abusif. Le numéro est conservé pour la traçabilité, et une règle
 * stricte par téléphone existe derrière FRAUD_PHONE_RULE=true (désactivée
 * par défaut car elle peut bloquer des clients légitimes).
 *
 * Tous les seuils sont pilotables par variable d'environnement : ajustement
 * sans redéploiement.
 */
@Injectable()
export class FraudBlockService {
  private readonly logger = new Logger(FraudBlockService.name);

  constructor(
    @InjectRepository(FraudBlock)
    private readonly blockRepo: Repository<FraudBlock>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  private get settings(): FraudRuleSettings {
    return {
      enabled: this.config.get<string>('FRAUD_ENABLED', 'true') !== 'false',
      windowMinutes: Number(
        this.config.get<string>('FRAUD_ORDER_WINDOW_MINUTES', '5'),
      ),
      maxOrders: Number(this.config.get<string>('FRAUD_ORDER_MAX_ORDERS', '5')),
      blockHours: Number(this.config.get<string>('FRAUD_BLOCK_HOURS', '24')),
      phoneRule:
        this.config.get<string>('FRAUD_PHONE_RULE', 'false') === 'true',
    };
  }

  /** Récupère le numéro du compte (null si le compte n'en a pas). */
  private async phoneOf(userId: string): Promise<string | null> {
    try {
      const user = await this.userRepo.findOne({
        where: { id: userId },
        select: { phone: true },
      });
      return user?.phone ?? null;
    } catch {
      return null;
    }
  }

  private blockedMessage(block: FraudBlock): HttpException {
    return new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        error: 'Too Many Requests',
        message:
          `Compte temporairement bloqué pour activité inhabituelle : trop de commandes sur une courte période. ` +
          `Nouveau blocage jusqu'au ${block.blockedUntil.toISOString()}.`,
        blockedUntil: block.blockedUntil,
        rule: block.rule,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private async findActiveBlock(
    userId: string,
    phone: string | null,
    s: FraudRuleSettings,
  ): Promise<FraudBlock | null> {
    const now = new Date();
    const qb = this.blockRepo
      .createQueryBuilder('b')
      .where('b.blockedUntil > :now', { now })
      .andWhere('b.releasedAt IS NULL');

    const clauses: string[] = [];
    const params: Record<string, string> = {};
    if (userId) {
      clauses.push('b.userId = :userId');
      params.userId = userId;
    }
    if (s.phoneRule && phone) {
      clauses.push('b.phone = :phone');
      params.phone = phone;
    }
    if (!clauses.length) return null;

    return qb
      .andWhere(`(${clauses.join(' OR ')})`, params)
      .orderBy('b.createdAt', 'DESC')
      .getOne();
  }

  /**
   * ⚠️ Appelé AVANT la création d'une commande.
   * Lève une 429 si le compte est bloqué, ou si le rythme est anormal.
   */
  async assertCanCreateOrder(userId: string): Promise<void> {
    const s = this.settings;
    if (!s.enabled || !userId) return;

    const phone = await this.phoneOf(userId);

    // 1) Déjà bloqué ?
    const active = await this.findActiveBlock(userId, phone, s);
    if (active) {
      throw this.blockedMessage(active);
    }

    // 2) Rythme anormal sur la fenêtre glissante ?
    const since = new Date(Date.now() - s.windowMinutes * 60_000);
    const count = await this.orderRepo
      .createQueryBuilder('o')
      .where('o.clientId = :userId', { userId })
      .andWhere('o.createdAt >= :since', { since })
      .getCount();

    if (count < s.maxOrders) return;

    // 3) On bloque et on trace.
    const blockedUntil = new Date(Date.now() + s.blockHours * 3_600_000);
    const block = this.blockRepo.create({
      userId,
      phone,
      rule: 'ORDERS_BURST',
      reason:
        `${count} commandes en moins de ${s.windowMinutes} minutes ` +
        `(seuil : ${s.maxOrders}) — blocage automatique de ${s.blockHours} h`,
      orderCount: count,
      windowMinutes: s.windowMinutes,
      blockedUntil,
    });

    try {
      await this.blockRepo.save(block);
      await this.audit.record({
        action: 'fraud.block.create',
        entityType: 'USER',
        entityId: userId,
        payload: {
          rule: 'ORDERS_BURST',
          phone,
          orderCount: count,
          windowMinutes: s.windowMinutes,
          blockHours: s.blockHours,
          blockedUntil,
        },
      });
      this.logger.warn(
        `[AntiFraude] Compte ${userId} (${phone ?? 'sans numéro'}) bloqué ${s.blockHours}h — ` +
          `${count} commandes en ${s.windowMinutes} min.`,
      );
    } catch (err) {
      this.logger.error(
        `[AntiFraude] Échec d'enregistrement du blocage: ${(err as Error).message}`,
      );
    }

    throw this.blockedMessage(block);
  }

  /** Liste pour le Super Admin : blocs actifs d'abord, puis historique. */
  async list(includeExpired = true): Promise<FraudBlock[]> {
    const qb = this.blockRepo
      .createQueryBuilder('b')
      .orderBy('b.createdAt', 'DESC');
    if (!includeExpired) {
      qb.where('b.blockedUntil > :now AND b.releasedAt IS NULL', {
        now: new Date(),
      });
    }
    return qb.take(200).getMany();
  }

  /** Levée manuelle (échappatoire : indispensable pour ne pas se verrouiller). */
  async lift(id: string, adminId: string): Promise<FraudBlock> {
    const block = await this.blockRepo.findOne({ where: { id } });
    if (!block) {
      throw new HttpException('Blocage introuvable', HttpStatus.NOT_FOUND);
    }
    block.releasedAt = new Date();
    block.releasedBy = adminId;
    const saved = await this.blockRepo.save(block);

    await this.audit.record({
      actorId: adminId,
      action: 'fraud.block.release',
      entityType: 'USER',
      entityId: block.userId ?? undefined,
      payload: { blockId: id, rule: block.rule, phone: block.phone },
    });

    return saved;
  }
}
