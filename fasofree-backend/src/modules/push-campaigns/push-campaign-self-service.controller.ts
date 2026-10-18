import {
  Body,
  Controller,
  DefaultValuePipe,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolesGuard } from '../../core/security/roles.guard';
import { Roles } from '../../core/security/roles.decorator';
import { UserRole } from '../users/entities/user-role.enum';
import { PushCampaignService } from './push-campaign.service';
import { CreateSelfServicePushCampaignDto } from './dto/create-self-service-push-campaign.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

/**
 * Compte authentifié tel que posé sur la requête par la stratégie JWT.
 * On ne type PAS en `User` : le payload contient `userId`/`role`, pas
 * forcément tous les champs de l'entité.
 */
interface OperatorPayload {
  userId?: string;
  role?: UserRole;
  fullName?: string;
  email?: string;
}

/** Nombre maximum de campagnes renvoyées (garde-fou mémoire). */
const clampLimit = (limit: number) => Math.min(Math.max(limit, 1), 200);

/**
 * 📣 Campagnes push AUTO-SERVICE d'un MARCHAND (Lot 3).
 *
 * Facturation : 100 FCFA par exécution (`PUSH_CAMPAIGN_UNIT_PRICE_FCFA`),
 * jamais par destinataire. Le débit a lieu AVANT la diffusion, depuis le
 * portefeuille du compte.
 *
 * Ciblage anti-spam : un marchand ne peut viser que ses propres clients
 * (OWN_CLIENTS) ou tous les clients de la plateforme (ALL_CLIENTS) — jamais
 * les livreurs, jamais les admins, jamais « toute la base ».
 *
 * L'endpoint admin existe toujours et reste inchangé : `admin/push-campaigns`.
 */
@ApiTags('Campagnes push — marchand')
@Controller('merchant/push-campaigns')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.BUSINESS_ADMIN)
export class MerchantPushCampaignController {
  constructor(private readonly service: PushCampaignService) {}

  @Post()
  @ApiOperation({
    summary:
      'Créer une campagne push auto-service (marchand) — facturée par envoi',
  })
  async create(
    @Body() dto: CreateSelfServicePushCampaignDto,
    @CurrentUser() user: OperatorPayload,
  ) {
    const userId = this.requireUserId(user);
    return this.service.createSelfServiceCampaign(
      userId,
      user.role as UserRole,
      user.fullName || user.email || 'Marchand',
      {
        title: dto.title,
        body: dto.body,
        audience: dto.audience,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        recurrence: dto.recurrence ?? null,
        timeOfDay: dto.timeOfDay ?? null,
        daysOfWeek: dto.daysOfWeek ?? null,
        timeZone: dto.timeZone ?? null,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
      },
    );
  }

  @Get('pricing')
  @ApiOperation({ summary: "Prix d'une campagne auto-service (FCFA)" })
  pricing() {
    return { unitPriceXof: this.service.unitPriceXof };
  }

  @Get()
  @ApiOperation({ summary: 'Mes campagnes push' })
  async list(
    @CurrentUser() user: OperatorPayload,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return this.service.findByOwner(
      this.requireUserId(user),
      clampLimit(limit),
    );
  }

  @Patch(':id/stop')
  @ApiOperation({ summary: 'Arrêter une de MES campagnes (→ COMPLETED)' })
  async stop(@Param('id') id: string, @CurrentUser() user: OperatorPayload) {
    const campaign = await this.service.stopOwnedCampaign(
      id,
      this.requireUserId(user),
    );
    if (!campaign) {
      throw new NotFoundException('Campagne introuvable.');
    }
    return campaign;
  }

  /** Un compte sans `userId` ne doit JAMAIS écrire avec un propriétaire vide. */
  private requireUserId(user: OperatorPayload): string {
    if (!user?.userId) {
      throw new ForbiddenException('Identité non reconnue.');
    }
    return user.userId;
  }
}

/**
 * 📣 Campagnes push AUTO-SERVICE d'une SOCIÉTÉ DE LIVRAISON (Lot 3).
 *
 * Ciblage anti-spam : une agence ne peut viser que ses propres livreurs
 * (OWN_DRIVERS, via `users.agencyId`) ou tous les clients de la plateforme
 * (ALL_CLIENTS). Facturation identique au marchand.
 */
@ApiTags('Campagnes push — agence')
@Controller('agency/push-campaigns')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.AGENCY)
export class AgencyPushCampaignController {
  constructor(private readonly service: PushCampaignService) {}

  @Post()
  @ApiOperation({
    summary:
      'Créer une campagne push auto-service (agence) — facturée par envoi',
  })
  async create(
    @Body() dto: CreateSelfServicePushCampaignDto,
    @CurrentUser() user: OperatorPayload,
  ) {
    const userId = this.requireUserId(user);
    return this.service.createSelfServiceCampaign(
      userId,
      user.role as UserRole,
      user.fullName || user.email || 'Agence',
      {
        title: dto.title,
        body: dto.body,
        audience: dto.audience,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        recurrence: dto.recurrence ?? null,
        timeOfDay: dto.timeOfDay ?? null,
        daysOfWeek: dto.daysOfWeek ?? null,
        timeZone: dto.timeZone ?? null,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
      },
    );
  }

  @Get('pricing')
  @ApiOperation({ summary: "Prix d'une campagne auto-service (FCFA)" })
  pricing() {
    return { unitPriceXof: this.service.unitPriceXof };
  }

  @Get()
  @ApiOperation({ summary: 'Mes campagnes push' })
  async list(
    @CurrentUser() user: OperatorPayload,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return this.service.findByOwner(
      this.requireUserId(user),
      clampLimit(limit),
    );
  }

  @Patch(':id/stop')
  @ApiOperation({ summary: 'Arrêter une de MES campagnes (→ COMPLETED)' })
  async stop(@Param('id') id: string, @CurrentUser() user: OperatorPayload) {
    const campaign = await this.service.stopOwnedCampaign(
      id,
      this.requireUserId(user),
    );
    if (!campaign) {
      throw new NotFoundException('Campagne introuvable.');
    }
    return campaign;
  }

  private requireUserId(user: OperatorPayload): string {
    if (!user?.userId) {
      throw new ForbiddenException('Identité non reconnue.');
    }
    return user.userId;
  }
}
