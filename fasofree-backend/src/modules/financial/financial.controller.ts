import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../core/security/roles.guard';
import { Roles } from '../../core/security/roles.decorator';
import { UserRole } from '../users/entities/user-role.enum';
import { FinancialMonitoringService } from './services/financial-monitoring.service';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Financial')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
@Controller('financial')
export class FinancialController {
  constructor(
    private readonly financialMonitoringService: FinancialMonitoringService,
  ) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Résumé financier global (LigdiCash + passifs)' })
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
}
