import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request as NestRequest,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../core/security/roles.decorator';
import { RolesGuard } from '../../core/security/roles.guard';
import { UserRole } from '../users/entities/user-role.enum';
import { Audited } from '../audit/audited.decorator';
import { PenaltiesService } from './penalties.service';
import { CreatePenaltyDto } from './dto/create-penalty.dto';
import { DeliveryPenaltyTarget } from './entities/delivery-penalty.entity';

type RequestWithUser = {
  user?: { userId?: string; role?: UserRole };
};

/**
 * ⚖️ Pénalités qualité (bloc C).
 *
 * - SUPER_ADMIN / ADMIN / SUPPORT : consulter, créer, révoquer.
 * - DRIVER / COURIER : voir ses propres sanctions (transparence).
 * - AGENCY : voir les sanctions de sa société.
 *
 * Le SUPPORT est inclus volontairement : il traite les litiges au
 * quotidien et doit pouvoir sanctionner sans dépendre d'un admin.
 */
@ApiTags('Delivery Penalties')
@ApiBearerAuth('JWT-auth')
@Controller('delivery-penalties')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class PenaltiesController {
  constructor(private readonly penaltiesService: PenaltiesService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  @ApiOperation({ summary: 'Lister les pénalités qualité (administration)' })
  async list(
    @Query('targetType') targetType?: DeliveryPenaltyTarget,
    @Query('driverId') driverId?: string,
    @Query('agencyId') agencyId?: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    return this.penaltiesService.list({
      targetType,
      driverId,
      agencyId,
      activeOnly: activeOnly === 'true' || activeOnly === '1',
    });
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  @Audited({ action: 'penalty.create', entityType: 'DELIVERY_PENALTY' })
  @ApiOperation({
    summary:
      'Appliquer une pénalité (avertissement / baisse de priorité / suspension)',
  })
  async create(
    @Body() dto: CreatePenaltyDto,
    @NestRequest() req: RequestWithUser,
  ) {
    return this.penaltiesService.create(dto, req.user?.userId ?? null);
  }

  @Patch(':id/revoke')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  @Audited({
    action: 'penalty.revoke',
    entityType: 'DELIVERY_PENALTY',
    entityParam: 'id',
  })
  @ApiOperation({ summary: 'Révoquer une pénalité (contestation acceptée)' })
  async revoke(@Param('id') id: string) {
    return this.penaltiesService.revoke(id);
  }

  // ─── Écran C : supervision qualité ──────────────────────────────
  // Déclaré avant `@Get('me')` : Nest résout dans l'ordre de déclaration.
  @Get('quality-overview')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  @ApiOperation({
    summary:
      'Tableau de bord qualité : sanctions actives, retards SLA, libellés résolus',
  })
  async qualityOverview(
    @Query('days') days?: string,
    @Query('targetType') targetType?: DeliveryPenaltyTarget,
    @Query('activeOnly') activeOnly?: string,
  ) {
    const parsed = parseInt(days || '7', 10);
    return this.penaltiesService.getQualityOverview({
      days: Number.isFinite(parsed) ? parsed : 7,
      targetType,
      activeOnly: activeOnly === 'true' || activeOnly === '1',
    });
  }

  @Get('me')
  @Roles(UserRole.DRIVER, UserRole.COURIER)
  @ApiOperation({ summary: 'Mes sanctions en tant que livreur' })
  async mine(@NestRequest() req: RequestWithUser) {
    const userId = req.user?.userId;
    if (!userId) return [];
    return this.penaltiesService.listForDriver(userId);
  }

  @Get('agency/me')
  @Roles(UserRole.AGENCY)
  @ApiOperation({ summary: 'Sanctions de ma société de livraison' })
  async agencyMine(@NestRequest() req: RequestWithUser) {
    const userId = req.user?.userId;
    if (!userId) return [];
    return this.penaltiesService.listForAgencyUser(userId);
  }
}
