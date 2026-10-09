import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolesGuard } from '../../core/security/roles.guard';
import { Roles } from '../../core/security/roles.decorator';
import { UserRole } from '../users/entities/user-role.enum';
import { AuditService } from './audit.service';

@ApiTags('Audit')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('logs')
  @ApiOperation({
    summary: "Journal des actions d'administration (SUPER_ADMIN)",
  })
  listLogs(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('action') action?: string,
    @Query('entityType') entityType?: string,
    @Query('actorId') actorId?: string,
  ) {
    return this.auditService.list({
      limit,
      offset,
      action,
      entityType,
      actorId,
    });
  }

  @Get('actions')
  @ApiOperation({ summary: 'Liste des actions journalisées (filtres UI)' })
  listActions() {
    return this.auditService.actions();
  }
}
