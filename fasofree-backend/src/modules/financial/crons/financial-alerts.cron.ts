import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FinancialMonitoringService } from '../services/financial-monitoring.service';

@Injectable()
export class FinancialAlertsCron {
  private readonly logger = new Logger(FinancialAlertsCron.name);

  constructor(
    private readonly financialService: FinancialMonitoringService,
    // Service de notification (ex: Telegram Bot / Twilio / Email)
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async monitorFloatHealth(): Promise<void> {
    try {
      const summary = await this.financialService.getDashboardSummary();

      if (!summary || !summary.metrics) {
        this.logger.warn(
          '[Cron Monitoring] Résumé financier introuvable ou invalide.',
        );
        return;
      }

      const { coverageRatio, status } = summary.metrics;
      this.logger.log(
        `[Cron Monitoring] Ratio de couverture actuel: ${coverageRatio ?? 'N/A'}`,
      );

      if (status === 'RED') {
        const message = `🚨 ALERTE CRITIQUE FASOFREE 🚨
Ratio de couverture LigdiCash en baisse: ${coverageRatio ?? 'N/A'}. 
Solde Payout disponible: ${summary.ligdiCash?.payoutBalance ?? 'N/A'} FCFA. 
Passif virtuel total: ${summary.internalLiabilities?.totalVirtualLiabilities ?? 'N/A'} FCFA. 
Veuillez approvisionner le compte Payout !`;

        try {
          await this.sendAdminAlert(message);
        } catch (err) {
          this.logger.error(
            `[Cron Monitoring] Échec envoi alerte admin: ${err?.message ?? err}`,
            err?.stack,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `[Cron Monitoring] Erreur lors de la récupération du dashboard: ${error?.message ?? error}`,
        error?.stack,
      );
    }
  }

  private async sendAdminAlert(message: string): Promise<void> {
    try {
      // Implémentation de l'envoi d'alerte (Telegram Webhook ou WhatsApp API)
      this.logger.warn(`[FINANCIAL ALERT SENT TO ADMIN] ${message}`);
    } catch (err) {
      this.logger.error(
        `[FINANCIAL ALERT] Échec d'envoi: ${err?.message ?? err}`,
        err?.stack,
      );
    }
  }
}
