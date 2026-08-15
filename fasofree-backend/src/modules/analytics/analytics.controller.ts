import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AnalyticsService } from './analytics.service';
import { AnalyticsFilterDto } from './dto/analytics-filter.dto';
import { RolesGuard } from '../../core/security/roles.guard';
import { Roles } from '../../core/security/roles.decorator';
import { UserRole } from '../users/entities/user-role.enum';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Analytics')
@ApiBearerAuth('JWT-auth')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  // 📈 Tableau de bord gérant : Synthèse financière et statistiques
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.BUSINESS_ADMIN, UserRole.SUPER_ADMIN)
  @Get('business/:businessId')
  @ApiOperation({ summary: 'Obtenir les indicateurs d’un commerce' })
  async getBusinessOverview(
    @Param('businessId') businessId: string,
    @Query() filter: AnalyticsFilterDto,
  ) {
    return this.analyticsService.getBusinessOverview(businessId, filter);
  }
}
