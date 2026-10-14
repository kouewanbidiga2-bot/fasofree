import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { RolesGuard } from '../../core/security/roles.guard';
import { Roles } from '../../core/security/roles.decorator';
import { UserRole } from '../users/entities/user-role.enum';
import { AffiliateService } from './affiliate.service';

@ApiTags('Affiliation')
@Controller('affiliate')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class AffiliateController {
  constructor(
    private readonly affiliate: AffiliateService,
    private readonly config: ConfigService,
  ) {}

  /** Récupère (ou crée) le lien de suivi d'un commerce. */
  @Get('business/:id/link')
  @Roles(UserRole.BUSINESS_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Lien de suivi marchand (créé si absent)' })
  async getLink(@Param('id') businessId: string) {
    const link = await this.affiliate.getOrCreateLink(businessId);
    const clientUrl = this.config
      .get<string>('CLIENT_URL', 'https://www.fasofree.site')
      .replace(/\/$/, '');
    const apiUrl = this.config
      .get<string>('API_URL', 'https://api.fasofree.site')
      .replace(/\/$/, '');

    return {
      code: link.code,
      url: `${apiUrl}/r/${link.code}`,
      restaurantUrl: `${clientUrl}/restaurant/${businessId}?ref=${link.code}`,
    };
  }

  /** Stats de funnel pour un commerce. */
  @Get('business/:id/stats')
  @Roles(UserRole.BUSINESS_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Statistiques de suivi (clics → clients → commandes)',
  })
  async getStats(@Param('id') businessId: string) {
    return this.affiliate.getStats(businessId);
  }

  /** Vue globale (Super Admin). */
  @Get('admin/stats')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  @ApiOperation({ summary: 'Statistiques affiliation globales' })
  async getGlobalStats() {
    return this.affiliate.getGlobalStats();
  }

  /** Résout un code vers un businessId (debug admin). */
  @Get('resolve/:code')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  @ApiOperation({ summary: 'Résout un code vers un businessId (debug admin)' })
  async resolve(@Param('code') code: string) {
    return { businessId: await this.affiliate.resolveCode(code) };
  }
}
