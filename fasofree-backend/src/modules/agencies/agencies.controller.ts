/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

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
import { Audited } from '../audit/audited.decorator';
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

  // ─── ADMINISTRATION (SUPER_ADMIN + ADMIN) ──────────────────────
  // La gestion des entreprises de livraison est réservée à l'administration :
  // le SUPPORT reste en lecture seule (il doit voir la liste pour traiter les
  // litiges) et ne peut ni créer ni modifier une agence.

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  @ApiOperation({ summary: 'Liste des agences partenaires' })
  async listAll() {
    return this.agenciesService.listAll();
  }

  // ✍️ Création ouverte à ADMIN et SUPPORT : le support crée au quotidien les
// agences de livraison partenaires, il ne doit pas dépendre d'un admin.
  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  @Audited({ action: 'agency.create', entityType: 'AGENCY' })
  @ApiOperation({ summary: 'Créer une entreprise de livraison (ADMIN / SUPPORT / SUPER_ADMIN)' })
  async create(@Body() dto: CreateAgencyDto) {
    return this.agenciesService.create(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  @Audited({ action: 'agency.update', entityType: 'AGENCY', entityParam: 'id' })
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

  // ─── 📍 GÉOLOCALISATION (bloc E) ───────────────────────────────

  /**
   * Carte temps réel de l'agence : positions de ses chauffeurs et de ses
   * courses actives. Périmètre strictement borné à l'agence connectée.
   */
  @Get('map')
  @UseGuards(RolesGuard)
  @Roles(UserRole.AGENCY)
  @ApiOperation({
    summary: 'Positions temps réel de mes chauffeurs et de mes courses actives',
  })
  async getAgencyMap(@NestRequest() req: RequestWithUser) {
    const agency = await this.getAgencyFromRequest(req);
    return this.agenciesService.getAgencyMap(agency.id);
  }

  // ─── 📣 APPEL D'OFFRES MULTI-AGENCES (bloc A4) ────────────────

  @Get('offers')
  @UseGuards(RolesGuard)
  @Roles(UserRole.AGENCY)
  @ApiOperation({
    summary: "Offres d'appel d'offres encore ouvertes pour mon agence",
  })
  async getOpenOffers(@NestRequest() req: RequestWithUser) {
    const agency = await this.getAgencyFromRequest(req);
    return this.agenciesService.getOpenOffers(agency.id);
  }

  @Post('deliveries/:orderId/accept')
  @UseGuards(RolesGuard)
  @Roles(UserRole.AGENCY)
  @Audited({ action: 'agency.offer.accept', entityType: 'DELIVERY_OFFER', entityParam: 'orderId' })
  @ApiOperation({
    summary: 'Accepter une offre (premier qui accepte gagne)',
  })
  async acceptOffer(
    @NestRequest() req: RequestWithUser,
    @Param('orderId') orderId: string,
  ) {
    const agency = await this.getAgencyFromRequest(req);
    return this.agenciesService.acceptOffer(orderId, agency.id);
  }

  @Post('deliveries/:orderId/refuse')
  @UseGuards(RolesGuard)
  @Roles(UserRole.AGENCY)
  @ApiOperation({ summary: "Refuser une offre d'appel d'offres" })
  async refuseOffer(
    @NestRequest() req: RequestWithUser,
    @Param('orderId') orderId: string,
  ) {
    const agency = await this.getAgencyFromRequest(req);
    return this.agenciesService.refuseOffer(orderId, agency.id);
  }

  // ─── ⚖️ SANCTIONS QUALITÉ (bloc C) ────────────────────────────

  @Get('penalties')
  @UseGuards(RolesGuard)
  @Roles(UserRole.AGENCY)
  @ApiOperation({ summary: 'Sanctions qualité de mon agence' })
  async getMyPenalties(@NestRequest() req: RequestWithUser) {
    const agency = await this.getAgencyFromRequest(req);
    return this.agenciesService.getMyPenalties(agency.id);
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
