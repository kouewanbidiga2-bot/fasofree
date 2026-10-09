import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';

export interface AuditRecordInput {
  actorId?: string | null;
  actorEmail?: string | null;
  actorRole?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  httpMethod?: string | null;
  path?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  payload?: Record<string, unknown> | null;
  result?: 'SUCCESS' | 'ERROR';
  statusCode?: number | null;
}

/** Clés dont la valeur ne doit JAMAIS être écrite dans le journal. */
const SECRET_KEYS = [
  'password',
  'newpassword',
  'oldpassword',
  'currentpassword',
  'confirmpassword',
  'token',
  'accesstoken',
  'refreshtoken',
  'secret',
  'apikey',
  'authorization',
  'otp',
  'code',
  'pin',
];

/**
 * 🧾 Service d'audit.
 *
 * Règle non négociable : `record()` ne lève **jamais**. Une panne du journal
 * ne doit jamais faire échouer une opération métier (suppression, remboursement…)
 * — on perd une trace, on ne casse pas la plateforme.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly repo: Repository<AuditLog>,
  ) {}

  /** Masque les secrets (récursif, profondeur bornée). */
  private redact(value: unknown, depth = 0): unknown {
    if (depth > 4) return '[…]';
    if (value === null || value === undefined) return value;
    if (Array.isArray(value)) {
      return value.slice(0, 50).map((v) => this.redact(v, depth + 1));
    }
    if (typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        out[k] = SECRET_KEYS.includes(k.toLowerCase())
          ? '[REDACTED]'
          : this.redact(v, depth + 1);
      }
      return out;
    }
    if (typeof value === 'string' && value.length > 500) {
      return `${value.slice(0, 500)}…`;
    }
    return value;
  }

  async record(input: AuditRecordInput): Promise<void> {
    try {
      // Entité construite explicitement puis save() : évite le typage
      // `_QueryDeepPartialEntity` de TypeORM sur les colonnes jsonb nullable.
      const log = new AuditLog();
      log.actorId = input.actorId ?? null;
      log.actorEmail = input.actorEmail ?? null;
      log.actorRole = input.actorRole ?? null;
      log.action = input.action;
      log.entityType = input.entityType ?? null;
      log.entityId = input.entityId ?? null;
      log.httpMethod = input.httpMethod ?? null;
      log.path = input.path ?? null;
      log.ip = input.ip ?? null;
      log.userAgent = input.userAgent?.slice(0, 400) ?? null;
      log.payload = input.payload
        ? (this.redact(input.payload) as Record<string, unknown>)
        : null;
      log.result = input.result ?? 'SUCCESS';
      log.statusCode = input.statusCode ?? null;

      await this.repo.save(log);
    } catch (err) {
      console.error(
        '[AuditService] écriture impossible',
        (err as Error).message,
      );
    }
  }

  /** Lecture paginée pour le Super Admin (accepte des query params string). */
  async list(params: {
    limit?: number | string;
    offset?: number | string;
    action?: string;
    entityType?: string;
    actorId?: string;
  }): Promise<{ total: number; items: AuditLog[] }> {
    const limit = Math.min(Math.max(Number(params.limit) || 100, 1), 500);
    const offset = Math.max(Number(params.offset) || 0, 0);

    const qb = this.repo.createQueryBuilder('a');
    if (params.action)
      qb.andWhere('a.action = :action', { action: params.action });
    if (params.entityType) {
      qb.andWhere('a.entityType = :entityType', {
        entityType: params.entityType,
      });
    }
    if (params.actorId)
      qb.andWhere('a.actorId = :actorId', { actorId: params.actorId });

    const [items, total] = await qb
      .orderBy('a.createdAt', 'DESC')
      .skip(offset)
      .take(limit)
      .getManyAndCount();

    return { total, items };
  }

  /** Actions distinctes présentes dans le journal (pour les filtres de l'UI). */
  async actions(): Promise<string[]> {
    const rows = await this.repo
      .createQueryBuilder('a')
      .select('DISTINCT a.action', 'action')
      .orderBy('action', 'ASC')
      .getRawMany<{ action: string }>();
    return rows.map((r) => r.action);
  }
}
