import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import {
  DeliveryPenalty,
  DeliveryPenaltyLevel,
  DeliveryPenaltyTarget,
} from './entities/delivery-penalty.entity';
import { CreatePenaltyDto } from './dto/create-penalty.dto';
import { DeliveryAgency } from '../dispatch/entities/delivery-agency.entity';

/**
 * 🎚️ Impact des pénalités sur le scoring livreur.
 *
 * - WARNING            : quasi neutre (+0.05) — la trace suffit, on ne
 *   veut pas qu'un simple avertissement change réellement l'ordre de
 *   passage (un livreur proche reste prioritaire).
 * - PRIORITY_DOWNGRADE : +0.35 → le livreur passe après ses collègues
 *   équivalents (rappel : le score est « plus bas = meilleur »).
 * - SUSPENSION         : exclusion pure et simple du dispatch.
 */
export const PENALTY_SCORE_IMPACT: Record<DeliveryPenaltyLevel, number> = {
  [DeliveryPenaltyLevel.WARNING]: 0.05,
  [DeliveryPenaltyLevel.PRIORITY_DOWNGRADE]: 0.35,
  [DeliveryPenaltyLevel.SUSPENSION]: Number.POSITIVE_INFINITY,
};

/** Ordre de gravité (pour ne retenir que le niveau le plus fort). */
const LEVEL_SEVERITY: Record<DeliveryPenaltyLevel, number> = {
  [DeliveryPenaltyLevel.WARNING]: 1,
  [DeliveryPenaltyLevel.PRIORITY_DOWNGRADE]: 2,
  [DeliveryPenaltyLevel.SUSPENSION]: 3,
};

/**
 * ⚖️ Pénalités qualité (bloc C).
 *
 * Échelle à 3 crans, historisée :
 *  ① avertissement — créé automatiquement sur livraison en retard
 *  ② baisse de priorité — décision administration (impacte le scoring)
 *  ③ suspension temporaire — décision administration (exclusion dispatch)
 *
 * Aucune suppression : une sanction se **révoque** (`active = false`) ou
 * expire (`effectiveUntil`). L'historique reste consultable par la
 * supervision, et une sanction contestée peut être levée sans trace perdue.
 */
@Injectable()
export class PenaltiesService {
  private readonly logger = new Logger(PenaltiesService.name);

  constructor(
    @InjectRepository(DeliveryPenalty)
    private readonly penaltyRepository: Repository<DeliveryPenalty>,
    @InjectRepository(DeliveryAgency)
    private readonly agencyRepository: Repository<DeliveryAgency>,
  ) {}

  // ─── Lecture administration ─────────────────────────────────────

  async list(params: {
    targetType?: DeliveryPenaltyTarget;
    driverId?: string;
    agencyId?: string;
    activeOnly?: boolean;
    limit?: number;
  }): Promise<DeliveryPenalty[]> {
    const qb = this.penaltyRepository
      .createQueryBuilder('p')
      .orderBy('p."createdAt"', 'DESC')
      .limit(Math.min(params.limit ?? 100, 200));

    if (params.targetType) {
      qb.andWhere('p."targetType" = :targetType', {
        targetType: params.targetType,
      });
    }
    if (params.driverId) {
      qb.andWhere('p."driverId" = :driverId', { driverId: params.driverId });
    }
    if (params.agencyId) {
      qb.andWhere('p."agencyId" = :agencyId', { agencyId: params.agencyId });
    }
    if (params.activeOnly) {
      this.applyActiveFilter(qb);
    }
    return qb.getMany();
  }

  /** Sanctions d'un livreur (espace livreur / admin) */
  async listForDriver(driverId: string): Promise<DeliveryPenalty[]> {
    return this.penaltyRepository.find({
      where: { driverId, targetType: DeliveryPenaltyTarget.DRIVER },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  /** Sanctions d'une société de livraison (espace agence / admin) */
  async listForAgency(agencyId: string): Promise<DeliveryPenalty[]> {
    return this.penaltyRepository.find({
      where: { agencyId, targetType: DeliveryPenaltyTarget.AGENCY },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  /**
   * Sanctions de la société rattachée au compte connecté (rôle AGENCY).
   * Pas d'agence rattachée → liste vide (jamais d'erreur 500 : un compte
   * AGENCY fraîchement créé et pas encore relié doit juste ne rien voir).
   */
  async listForAgencyUser(userId: string): Promise<DeliveryPenalty[]> {
    const agency = await this.agencyRepository.findOne({
      where: { userId },
    });
    if (!agency) return [];
    return this.listForAgency(agency.id);
  }

  // ─── Décision administration ────────────────────────────────────

  /**
   * Crée une sanction. Le niveau SUSPENSION impose une date de fin :
   * une suspension sans terme est un bannissement, qui n'est pas
   * l'outil de cet écran (le bannissement a son propre module).
   */
  async create(
    dto: CreatePenaltyDto,
    createdBy: string | null,
  ): Promise<DeliveryPenalty> {
    const now = new Date();
    const penalty = this.penaltyRepository.create({
      targetType: dto.targetType,
      driverId:
        dto.targetType === DeliveryPenaltyTarget.DRIVER
          ? (dto.driverId ?? null)
          : null,
      agencyId:
        dto.targetType === DeliveryPenaltyTarget.AGENCY
          ? (dto.agencyId ?? null)
          : null,
      orderId: dto.orderId ?? null,
      level: dto.level,
      reason: dto.reason ?? null,
      effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : now,
      effectiveUntil: dto.effectiveUntil
        ? new Date(dto.effectiveUntil)
        : this.defaultUntil(dto.level, now),
      active: true,
      createdBy,
    });

    const saved = await this.penaltyRepository.save(penalty);
    this.logger.warn(
      `[Penalties] ${saved.level} appliquée à ${saved.targetType} ` +
        `${saved.driverId ?? saved.agencyId ?? '?'} (motif: ${saved.reason ?? 'non précisé'})`,
    );
    return saved;
  }

  /**
   * Révocation explicite (contestation acceptée, erreur de jugement…).
   * `active` reste la seule source de vérité : on n'efface jamais la ligne.
   */
  async revoke(id: string): Promise<DeliveryPenalty> {
    const penalty = await this.penaltyRepository.findOne({ where: { id } });
    if (!penalty) {
      throw new NotFoundException(`Pénalité ${id} introuvable`);
    }
    penalty.active = false;
    penalty.effectiveUntil = new Date();
    const saved = await this.penaltyRepository.save(penalty);
    this.logger.log(`[Penalties] Pénalité ${id} révoquée`);
    return saved;
  }

  // ─── Intégration scoring / dispatch ─────────────────────────────

  /**
   * Niveau de sanction actif le plus grave, par livreur.
   * Les livreurs sans sanction sont absents de la Map.
   */
  async getActiveDriverLevels(
    driverIds: string[],
  ): Promise<Map<string, DeliveryPenaltyLevel>> {
    if (driverIds.length === 0) return new Map();

    const qb = this.penaltyRepository
      .createQueryBuilder('p')
      .where('p."targetType" = :t', { t: DeliveryPenaltyTarget.DRIVER })
      .andWhere('p."driverId" IN (:...driverIds)', { driverIds });
    this.applyActiveFilter(qb);

    const rows = await qb.getMany();
    return this.reduceToStrongest(rows, (r) => r.driverId);
  }

  /**
   * Niveaux de sanction actifs par société de livraison.
   * Sert au filtrage des agences suspendues et à la baisse de priorité.
   */
  async getActiveAgencyLevels(
    agencyIds: string[],
  ): Promise<Map<string, DeliveryPenaltyLevel>> {
    if (agencyIds.length === 0) return new Map();

    const qb = this.penaltyRepository
      .createQueryBuilder('p')
      .where('p."targetType" = :t', { t: DeliveryPenaltyTarget.AGENCY })
      .andWhere('p."agencyId" IN (:...agencyIds)', { agencyIds });
    this.applyActiveFilter(qb);

    const rows = await qb.getMany();
    return this.reduceToStrongest(rows, (r) => r.agencyId);
  }

  /** Ids des sociétés actuellement suspendues. */
  async getSuspendedAgencyIds(): Promise<Set<string>> {
    const qb = this.penaltyRepository
      .createQueryBuilder('p')
      .select('DISTINCT p."agencyId"', 'agencyId')
      .where('p."targetType" = :t', { t: DeliveryPenaltyTarget.AGENCY })
      .andWhere('p."level" = :level', {
        level: DeliveryPenaltyLevel.SUSPENSION,
      })
      .andWhere('p."agencyId" IS NOT NULL');
    this.applyActiveFilter(qb);

    const rows = await qb.getRawMany<{ agencyId: string }>();
    return new Set(rows.map((r) => r.agencyId));
  }

  /**
   * ① Avertissement automatique sur livraison en retard.
   *
   * Une seule sanction par (commande, cible) : le cron de rattrapage et
   * l'appel manuel du dashboard peuvent retenter, on ne duplique pas.
   * `createdBy = null` matérialise l'origine automatique.
   */
  async issueAutomaticWarning(params: {
    orderId: string;
    driverId?: string | null;
    agencyId?: string | null;
    reason: string;
  }): Promise<DeliveryPenalty | null> {
    const targetType = params.driverId
      ? DeliveryPenaltyTarget.DRIVER
      : params.agencyId
        ? DeliveryPenaltyTarget.AGENCY
        : null;
    if (!targetType) return null;

    const existing = await this.penaltyRepository.findOne({
      where: {
        orderId: params.orderId,
        targetType,
        level: DeliveryPenaltyLevel.WARNING,
      },
    });
    if (existing) {
      this.logger.debug(
        `[Penalties] Avertissement déjà émis pour la commande #${params.orderId}`,
      );
      return null;
    }

    return this.create(
      {
        targetType,
        driverId: params.driverId ?? undefined,
        agencyId: params.agencyId ?? undefined,
        orderId: params.orderId,
        level: DeliveryPenaltyLevel.WARNING,
        reason: params.reason,
      },
      null,
    );
  }

  // ─── Interne ────────────────────────────────────────────────────

  /**
   * Une sanction est active si elle a été activée ET n'est pas expirée.
   * `applyActiveFilter` est le SEUL endroit qui définit cette règle :
   * sinon le dispatch et les dashboards risquent de diverger.
   */
  private applyActiveFilter(
    qb: SelectQueryBuilder<DeliveryPenalty>,
  ): void {
    qb.andWhere('p."active" = true');
    qb.andWhere('(p."effectiveUntil" IS NULL OR p."effectiveUntil" > now())');
  }

  private reduceToStrongest(
    rows: DeliveryPenalty[],
    keyOf: (row: DeliveryPenalty) => string | null,
  ): Map<string, DeliveryPenaltyLevel> {
    const map = new Map<string, DeliveryPenaltyLevel>();
    for (const row of rows) {
      const key = keyOf(row);
      if (!key) continue;
      const current = map.get(key);
      if (!current || LEVEL_SEVERITY[row.level] > LEVEL_SEVERITY[current]) {
        map.set(key, row.level);
      }
    }
    return map;
  }

  /** Durée par défaut d'une sanction selon son niveau. */
  private defaultUntil(
    level: DeliveryPenaltyLevel,
    from: Date,
  ): Date | null {
    if (level === DeliveryPenaltyLevel.SUSPENSION) {
      // 7 jours : assez long pour être dissuasif, assez court pour ne pas
      // priver la plateforme d'un partenaire sans réévaluation humaine.
      return new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000);
    }
    // Avertissement / baisse de priorité : jusqu'à révocation manuelle.
    return null;
  }
}
