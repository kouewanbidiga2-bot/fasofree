import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReportExport } from '../entities/report-export.entity';
import { WalletTransaction } from '../../wallets/entities/wallet-transaction.entity';
import { Transaction } from '../../payments/entities/transaction.entity';

/** 🧾 Génération de l'export CSV périodique des transactions. */
@Injectable()
export class TransactionsCsvService {
  private readonly logger = new Logger(TransactionsCsvService.name);

  constructor(
    @InjectRepository(ReportExport)
    private readonly exportRepo: Repository<ReportExport>,
    @InjectRepository(WalletTransaction)
    private readonly walletTxRepo: Repository<WalletTransaction>,
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
    private readonly config: ConfigService,
  ) {}

  /**
   * Conversion sûre en texte (les résultats bruts TypeORM sont `unknown` :
   * un `[object Object]` dans un CSV de comptabilité est pire qu'une cellule vide).
   */
  private toText(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      typeof value === 'bigint'
    ) {
      return String(value);
    }
    if (value instanceof Date) return value.toISOString();
    try {
      return JSON.stringify(value) ?? '';
    } catch {
      return '';
    }
  }

  /** Échappement CSV : séparateur point-virgule + guillemets + sauts de ligne. */
  private cell(value: unknown): string {
    const s = this.toText(value);
    if (/[",\n\r;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  /**
   * Génère un export des mouvements d'argent sur une période.
   *
   * Source = `wallet_transactions` (le journal réel de l'argent), enrichi du
   * compte (id + rôle). Le résumé contient deux volets de contrôle :
   * - mouvements de portefeuille (crédits / débits, par motif) ;
   * - encaissements passerelle (montants + commissions, par moyen/statut).
   * Les deux permettent de rapprocher ce qui est Entré de ce qui a été
   * distribué — c'est le contrôle qui manque aujourd'hui.
   */
  async generate(params: {
    periodStart: Date;
    periodEnd: Date;
    generatedBy: string;
    actorId?: string;
  }): Promise<ReportExport> {
    const { periodStart, periodEnd } = params;
    const maxRows = Number(
      this.config.get<string>('REPORT_MAX_ROWS', '100000'),
    );

    // ── 1. Mouvements de portefeuille ──────────────────────────────
    const movements = await this.walletTxRepo
      .createQueryBuilder('t')
      .leftJoin('t.wallet', 'w')
      .select([
        't.id AS "id"',
        't.reference AS "reference"',
        't.type AS "type"',
        't.status AS "status"',
        't.reason AS "reason"',
        't.amount AS "amount"',
        't.balanceAfter AS "balanceAfter"',
        't.branchId AS "branchId"',
        't.description AS "description"',
        't.createdAt AS "createdAt"',
        'w.userId AS "userId"',
        'w.userRole AS "userRole"',
      ])
      .where('t.createdAt >= :start', { start: periodStart })
      .andWhere('t.createdAt < :end', { end: periodEnd })
      .orderBy('t.createdAt', 'ASC')
      .limit(maxRows)
      .getRawMany<Record<string, unknown>>();

    const truncated = movements.length >= maxRows;

    // ── 2. Encaissements passerelle (volet « money-in ») ───────────
    const payments = await this.transactionRepo
      .createQueryBuilder('p')
      .select([
        'p.paymentMethod AS "paymentMethod"',
        'p.status AS "status"',
        'COUNT(*)::int AS "count"',
        'COALESCE(SUM(p.amount), 0) AS "total"',
        'COALESCE(SUM(p.commissionAmount), 0) AS "commission"',
      ])
      .where('p.processedAt >= :start', { start: periodStart })
      .andWhere('p.processedAt < :end', { end: periodEnd })
      .groupBy('p.paymentMethod')
      .addGroupBy('p.status')
      .getRawMany<Record<string, unknown>>();

    // ── 3. Totaux de contrôle ──────────────────────────────────────
    const byReason: Record<string, { count: number; total: number }> = {};
    let totalCredit = 0;
    let totalDebit = 0;
    let pendingCount = 0;

    for (const m of movements) {
      const amount = Number(m['amount'] ?? 0);
      const reason = this.toText(m['reason']) || 'UNKNOWN';
      const bucket = (byReason[reason] ??= { count: 0, total: 0 });
      bucket.count += 1;
      bucket.total += amount;
      if (this.toText(m['type']) === 'CREDIT') totalCredit += amount;
      else totalDebit += amount;
      if (String(m['status']) === 'PENDING') pendingCount += 1;
    }

    const byRole: Record<
      string,
      { credits: number; debits: number; count: number }
    > = {};
    for (const m of movements) {
      const role = this.toText(m['userRole']) || 'UNKNOWN';
      const bucket = (byRole[role] ??= { credits: 0, debits: 0, count: 0 });
      const amount = Number(m['amount'] ?? 0);
      if (this.toText(m['type']) === 'CREDIT') bucket.credits += amount;
      else bucket.debits += amount;
      bucket.count += 1;
    }

    const summary = {
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      generatedAt: new Date().toISOString(),
      generatedBy: params.generatedBy,
      movementCount: movements.length,
      truncated,
      totals: {
        credits: round2(totalCredit),
        debits: round2(totalDebit),
        net: round2(totalCredit - totalDebit),
        pendingCount,
      },
      byReason,
      byRole,
      paymentsByMethodAndStatus: payments.map((p) => ({
        paymentMethod: p['paymentMethod'],
        status: p['status'],
        count: Number(p['count'] ?? 0),
        total: round2(Number(p['total'] ?? 0)),
        commission: round2(Number(p['commission'] ?? 0)),
      })),
    };

    // ── 4. Assemblage du CSV (BOM UTF-8 pour Excel + séparateur ';') ──
    const header = [
      'horodatage_utc',
      'reference',
      'compte_id',
      'role_compte',
      'agence_id',
      'type',
      'motif',
      'statut',
      'montant',
      'solde_apres',
      'description',
    ];

    const lines = [header.join(';')];
    for (const m of movements) {
      const created =
        m['createdAt'] instanceof Date
          ? m['createdAt']
          : new Date(String(m['createdAt']));
      lines.push(
        [
          created.toISOString(),
          m['reference'],
          m['userId'],
          m['userRole'],
          m['branchId'],
          m['type'],
          m['reason'],
          m['status'],
          round2(Number(m['amount'] ?? 0)).toFixed(2),
          round2(Number(m['balanceAfter'] ?? 0)).toFixed(2),
          m['description'],
        ]
          .map((v) => this.cell(v))
          .join(';'),
      );
    }

    // BOM UTF-8 (écrit en échappement : un caractère BOM littéral est refusé par ESLint)
    // → Excel affiche correctement les accents.
    const csv = `\uFEFF${lines.join('\r\n')}\r\n`;
    const fileName = `fasofree-transactions_${periodStart.toISOString().slice(0, 10)}_${periodEnd
      .toISOString()
      .slice(0, 10)}.csv`;

    const saved = await this.exportRepo.save(
      this.exportRepo.create({
        kind: 'TRANSACTIONS_CSV',
        periodStart,
        periodEnd,
        fileName,
        rowCount: movements.length,
        truncated,
        csvContent: csv,
        summary,
        generatedBy: params.generatedBy,
      }),
    );

    this.logger.log(
      `[Export] ${fileName} — ${movements.length} lignes, crédits ${round2(totalCredit)}, ` +
        `débits ${round2(totalDebit)}${truncated ? ' (PLAFOND ATTEINT)' : ''}`,
    );

    return saved;
  }

  async list(limit = 30): Promise<ReportExport[]> {
    return this.exportRepo.find({
      order: { createdAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 100),
      select: {
        id: true,
        kind: true,
        periodStart: true,
        periodEnd: true,
        fileName: true,
        rowCount: true,
        truncated: true,
        summary: true,
        generatedBy: true,
        downloadedAt: true,
        downloadCount: true,
        createdAt: true,
      },
    });
  }

  async findOne(id: string): Promise<ReportExport | null> {
    return this.exportRepo.findOne({ where: { id } });
  }

  async markDownloaded(id: string): Promise<void> {
    await this.exportRepo.increment({ id }, 'downloadCount', 1);
    await this.exportRepo.update({ id }, { downloadedAt: new Date() });
  }

  /** Dernier export réussi (pour le cron « tous les N jours »). */
  async lastGeneratedAt(): Promise<Date | null> {
    const last = await this.exportRepo.findOne({
      order: { createdAt: 'DESC' },
      select: { createdAt: true },
    });
    return last?.createdAt ?? null;
  }
}

function round2(n: number): number {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}
