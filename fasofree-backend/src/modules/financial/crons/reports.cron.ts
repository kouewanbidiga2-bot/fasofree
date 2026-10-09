import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { TransactionsCsvService } from '../services/transactions-csv.service';

/**
 * 📄 Export CSV automatique des transactions.
 *
 * Exécution quotidienne à 08:00 UTC, mais la génération n'a lieu que si
 * `REPORT_PERIOD_DAYS` jours (5 par défaut) se sont écoulés depuis le dernier
 * export. Ce découpage évite les subtilités des expressions cron « tous les
 * N jours » (qui se déclenchent aux jours 1, 6, 11… du mois et sautent les
 * mois courts), et garantit exactement une période de 5 jours par export.
 *
 * La période couverte va du dernier export (ou `now - 5j` au tout premier
 * lancement) jusqu'à maintenant → aucune fenêtre perdue, aucun doublon.
 */
@Injectable()
export class ReportsCron {
  private readonly logger = new Logger(ReportsCron.name);

  constructor(
    private readonly csv: TransactionsCsvService,
    private readonly config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM, { name: 'transactions-csv-export' })
  async exportIfDue(): Promise<void> {
    if (this.config.get<string>('REPORT_AUTO_ENABLED', 'true') === 'false')
      return;

    const periodDays = Number(
      this.config.get<string>('REPORT_PERIOD_DAYS', '5'),
    );
    const now = new Date();
    const last = await this.csv.lastGeneratedAt();
    const periodStart =
      last ?? new Date(now.getTime() - periodDays * 24 * 3_600_000);

    const elapsedDays =
      (now.getTime() - periodStart.getTime()) / (24 * 3_600_000);
    if (elapsedDays < periodDays) {
      this.logger.log(
        `[Export] Pas encore dû (${elapsedDays.toFixed(1)}/${periodDays} jours écoulés).`,
      );
      return;
    }

    try {
      await this.csv.generate({
        periodStart,
        periodEnd: now,
        generatedBy: 'CRON',
      });
    } catch (err) {
      this.logger.error(
        `[Export] Génération impossible: ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }
}
