import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request as NestRequest,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../core/security/roles.guard';
import { Roles } from '../../core/security/roles.decorator';
import { UserRole } from '../users/entities/user-role.enum';
import { FinancialMonitoringService } from './services/financial-monitoring.service';
import { TransactionsCsvService } from './services/transactions-csv.service';
import { Audited } from '../audit/audited.decorator';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

type RequestWithUser = Request & { user?: { userId?: string } };

@ApiTags('Financial')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
@Controller('financial')
export class FinancialController {
  constructor(
    private readonly financialMonitoringService: FinancialMonitoringService,
    private readonly transactionsCsv: TransactionsCsvService,
  ) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Résumé financier global (GeniusPay + passifs)' })
  async getDashboardSummary() {
    return this.financialMonitoringService.getDashboardSummary();
  }

  @Get('overview')
  @ApiOperation({ summary: 'Données financières par jour (7d, 30d, 90d)' })
  async getOverview(@Query('period') period?: string) {
    return this.financialMonitoringService.getOverview(period || '30d');
  }

  @Get('products')
  @ApiOperation({ summary: 'Analytics produits (achats, livré/sur place, top/worst)' })
  async getProductAnalytics(
    @Query('brandId') brandId?: string,
    @Query('businessId') businessId?: string,
    @Query('period') period?: string,
  ) {
    return this.financialMonitoringService.getProductAnalytics({ brandId, businessId, period });
  }

  @Get('money-flows')
  @ApiOperation({ summary: 'Tous les flux d\'argent (entrées, sorties, reversals)' })
  async getMoneyFlows(
    @Query('brandId') brandId?: string,
    @Query('businessId') businessId?: string,
    @Query('period') period?: string,
  ) {
    return this.financialMonitoringService.getMoneyFlows({ brandId, businessId, period });
  }

  @Get('brands')
  @ApiOperation({ summary: 'Ventilation par marque et agence' })
  async getBrandBreakdown(@Query('period') period?: string) {
    return this.financialMonitoringService.getBrandBreakdown(period || '30d');
  }

  @Get('business/:businessId')
  @ApiOperation({ summary: 'Finances complètes d\'un business (BusinessAdmin)' })
  async getBusinessFinance(
    @Param('businessId') businessId: string,
    @Query('period') period?: string,
  ) {
    return this.financialMonitoringService.getBusinessFinance(businessId, period);
  }

  // ═══════════════════════════════════════════════════════════════
  // 📄 EXPORTS CSV PÉRIODIQUES (générés automatiquement tous les N jours)
  // ═══════════════════════════════════════════════════════════════

  @Get('exports')
  @ApiOperation({
    summary: 'Historique des exports CSV de transactions (SUPER_ADMIN)',
  })
  listExports(@Query('limit') limit?: string) {
    return this.transactionsCsv.list(Number(limit) || 30);
  }

  @Get('exports/:id')
  @ApiOperation({ summary: 'Télécharger un export CSV (SUPER_ADMIN)' })
  async downloadExport(@Param('id') id: string) {
    const report = await this.transactionsCsv.findOne(id);
    if (!report) {
      throw new NotFoundException('Export introuvable');
    }
    await this.transactionsCsv.markDownloaded(id);
    return {
      id: report.id,
      fileName: report.fileName,
      rowCount: report.rowCount,
      truncated: report.truncated,
      summary: report.summary,
      // Le contenu CSV brut : le front le transforme en téléchargement.
      csvContent: report.csvContent,
    };
  }

  @Post('exports/generate')
  @Audited({
    action: 'financial.export.generate',
    entityType: 'REPORT_EXPORT',
  })
  @ApiOperation({
    summary: 'Générer un export CSV immédiatement (SUPER_ADMIN, planifie manuellement)',
  })
  async generateExport(@NestRequest() req: RequestWithUser) {
    const adminId = req.user?.userId ?? 'MANUAL';
    const last = await this.transactionsCsv.lastGeneratedAt();
    const periodDays = Number(process.env.REPORT_PERIOD_DAYS || '5');
    const now = new Date();
    const periodStart =
      last ?? new Date(now.getTime() - periodDays * 24 * 3_600_000);
    return this.transactionsCsv.generate({
      periodStart,
      periodEnd: now,
      generatedBy: adminId,
      actorId: adminId,
    });
  }
}
