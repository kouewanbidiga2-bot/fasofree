import { Controller, Get, Param, Query, UseGuards, Request as NestRequest, ForbiddenException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request as ExpressRequest } from 'express';
import { AnalyticsService } from './analytics.service';
import { AnalyticsFilterDto } from './dto/analytics-filter.dto';
import { RolesGuard } from '../../core/security/roles.guard';
import { Roles } from '../../core/security/roles.decorator';
import { UserRole } from '../users/entities/user-role.enum';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

type RequestWithUser = ExpressRequest & {
  user?: { userId?: string; role?: UserRole; brandId?: string };
};

@ApiTags('Analytics')
@ApiBearerAuth('JWT-auth')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  // 📈 Tableau de bord gérant : Synthèse financière et statistiques
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.BUSINESS_ADMIN, UserRole.SUPER_ADMIN)
  @Get('business/:businessId')
  @ApiOperation({ summary: 'Obtenir les indicateurs d\'un commerce' })
  async getBusinessOverview(
    @NestRequest() req: RequestWithUser,
    @Param('businessId') businessId: string,
    @Query() filter: AnalyticsFilterDto,
  ) {
    const user = req.user;
    if (!user?.userId) throw new ForbiddenException('Utilisateur non authentifié');
    return this.analyticsService.getBusinessOverview(
      businessId,
      user.userId,
      user.role || '',
      filter,
    );
  }
  // 🏷️ Analytics agrégés d'une marque (toutes les agences)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.BUSINESS_ADMIN, UserRole.SUPER_ADMIN)
  @Get('brand/:brandId')
  @ApiOperation({ summary: 'Analytics agrégés d\'une marque (toutes les agences)' })
  async getBrandOverview(
    @NestRequest() req: RequestWithUser,
    @Param('brandId') brandId: string,
    @Query() filter: AnalyticsFilterDto,
  ) {
    const userId = req.user?.userId;
    if (!userId) throw new ForbiddenException('Utilisateur non authentifié');
    return this.analyticsService.getBrandOverview(brandId, userId, filter);
  }

  // 🏷️ Comparaison des agences d'une marque
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.BUSINESS_ADMIN, UserRole.SUPER_ADMIN)
  @Get('brand/:brandId/compare')
  @ApiOperation({ summary: 'Comparaison des agences d\'une marque' })
  async compareBranches(
    @NestRequest() req: RequestWithUser,
    @Param('brandId') brandId: string,
    @Query() filter: AnalyticsFilterDto,
  ) {
    const userId = req.user?.userId;
    if (!userId) throw new ForbiddenException('Utilisateur non authentifié');
    return this.analyticsService.compareBranches(brandId, userId, filter);
  }
}
