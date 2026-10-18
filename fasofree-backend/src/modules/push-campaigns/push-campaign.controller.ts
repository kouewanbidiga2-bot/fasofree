import {
  Body,
  Controller,
  DefaultValuePipe,
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
import { CreatePushCampaignDto } from './dto/create-push-campaign.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('Campagnes push')
@Controller('admin/push-campaigns')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class PushCampaignController {
  constructor(private readonly service: PushCampaignService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Créer et envoyer une campagne push (SUPER_ADMIN / ADMIN)',
  })
  async create(@Body() dto: CreatePushCampaignDto, @CurrentUser() user: User) {
    return this.service.createCampaign(
      dto.title,
      dto.body,
      dto.target,
      user?.fullName || user?.email || 'admin',
      dto.scheduledAt ? new Date(dto.scheduledAt) : null,
      // 🔁 Lot 2 : la récurrence est optionnelle ; son absence conserve
      // strictement le comportement d'avant (envoi unique).
      {
        recurrence: dto.recurrence ?? null,
        timeOfDay: dto.timeOfDay ?? null,
        daysOfWeek: dto.daysOfWeek ?? null,
        timeZone: dto.timeZone ?? null,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
      },
    );
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Historique des campagnes push' })
  async list(
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    // Garde-fou : un `?limit` abusif ne doit pas vider la table en RAM.
    return this.service.findAll(Math.min(Math.max(limit, 1), 200));
  }

  @Patch(':id/stop')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({
    summary:
      'Arrêter une campagne récurrente (SUPER_ADMIN / ADMIN) — passe à COMPLETED',
  })
  async stop(@Param('id') id: string) {
    const campaign = await this.service.stopRecurrence(id);
    if (!campaign) {
      throw new NotFoundException('Campagne introuvable.');
    }
    return campaign;
  }
}
