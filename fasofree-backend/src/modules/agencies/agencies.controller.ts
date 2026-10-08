import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  Request as NestRequest,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../core/security/roles.decorator';
import { RolesGuard } from '../../core/security/roles.guard';
import { UserRole } from '../users/entities/user-role.enum';
import { AgenciesService } from './agencies.service';
import { CreateAgencyDto, UpdateAgencyDto } from './dto/agency.dto';

type RequestWithUser = {
  user?: { userId?: string; role?: UserRole };
};

/**
 * 🏢 Agences partenaires (Niveau 2 du dispatch multi-niveaux).
 *
 * - SUPER_ADMIN : gestion des agences (CRUD, commission, zones).
 * - AGENCY      : espace agence (courses routées, assignation chauffeur).
 */
@ApiTags('Agencies')
@ApiBearerAuth('JWT-auth')
@Controller('agencies')
@UseGuards(AuthGuard('jwt'))
export class AgenciesController {
  constructor(private readonly agenciesService: AgenciesService) {}

  // ─── SUPER_ADMIN ───────────────────────────────────────────────

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Liste des agences partenaires' })
  async listAll() {
    return this.agenciesService.listAll();
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Créer une agence partenaire' })
  async create(@Body() dto: CreateAgencyDto) {
    return this.agenciesService.create(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Mettre à jour une agence (commission, zones, actif…)' })
  async update(@Param('id') id: string, @Body() dto: UpdateAgencyDto) {
    return this.agenciesService.update(id, dto);
  }

  // ─── AGENCY (espace agence) ────────────────────────────────────

  @Get('me')
  @UseGuards(RolesGuard)
  @Roles(UserRole.AGENCY)
  @ApiOperation({ summary: 'Profil de mon agence' })
  async getMyAgency(@NestRequest() req: RequestWithUser) {
    const userId = req.user?.userId;
    if (!userId) throw new ForbiddenException('Utilisateur non authentifié');
    return this.agenciesService.getMyAgency(userId);
  }

  @Get('deliveries')
  @UseGuards(RolesGuard)
  @Roles(UserRole.AGENCY)
  @ApiOperation({ summary: 'Courses routées vers mon agence' })
  async getDeliveries(@NestRequest() req: RequestWithUser) {
    const agency = await this.getAgencyFromRequest(req);
    return this.agenciesService.getDeliveries(agency.id);
  }

  @Get('drivers')
  @UseGuards(RolesGuard)
  @Roles(UserRole.AGENCY)
  @ApiOperation({ summary: 'Chauffeurs rattachés à mon agence' })
  async getDrivers(@NestRequest() req: RequestWithUser) {
    const agency = await this.getAgencyFromRequest(req);
    return this.agenciesService.getDrivers(agency.id);
  }

  @Post('deliveries/:orderId/assign')
  @UseGuards(RolesGuard)
  @Roles(UserRole.AGENCY)
  @ApiOperation({ summary: 'Assigner une course à un de mes chauffeurs' })
  async assignDelivery(
    @NestRequest() req: RequestWithUser,
    @Param('orderId') orderId: string,
    @Body() body: { driverId: string },
  ) {
    const agency = await this.getAgencyFromRequest(req);
    if (!body?.driverId) {
      throw new BadRequestException('driverId requis');
    }
    return this.agenciesService.assignDelivery(
      orderId,
      agency.id,
      body.driverId,
    );
  }

  /** Récupère l'agence du compte connecté (rôle AGENCY) */
  private async getAgencyFromRequest(req: RequestWithUser) {
    const userId = req.user?.userId;
    if (!userId) throw new ForbiddenException('Utilisateur non authentifié');
    const agency = await this.agenciesService.getMyAgency(userId);
    if (!agency) {
      throw new ForbiddenException('Aucune agence rattachée à ce compte');
    }
    return agency;
  }
}
