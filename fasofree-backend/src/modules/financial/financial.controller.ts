import { Controller, Get, UseGuards } from '@nestjs/common';
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
  @ApiOperation({ summary: 'Obtenir le résumé financier global' })
  async getDashboardSummary() {
    return this.financialMonitoringService.getDashboardSummary();
  }
}
