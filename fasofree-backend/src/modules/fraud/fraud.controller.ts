import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request as NestRequest,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { RolesGuard } from '../../core/security/roles.guard';
import { Roles } from '../../core/security/roles.decorator';
import { UserRole } from '../users/entities/user-role.enum';
import { Audited } from '../audit/audited.decorator';
import { FraudBlockService } from './fraud-block.service';

type RequestWithUser = Request & { user?: { userId?: string } };

@ApiTags('AntiFraude')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
@Controller('fraud')
export class FraudController {
  constructor(private readonly fraudService: FraudBlockService) {}

  @Get('blocks')
  @ApiOperation({ summary: 'Blocages anti-fraude (actifs + historique)' })
  listBlocks(@Query('includeExpired') includeExpired?: string) {
    return this.fraudService.list(includeExpired !== 'false');
  }

  @Post('blocks/:id/lift')
  @Audited({
    action: 'fraud.block.release.manual',
    entityType: 'FRAUD_BLOCK',
    entityParam: 'id',
  })
  @ApiOperation({ summary: 'Lever manuellement un blocage (SUPER_ADMIN)' })
  async lift(@Param('id') id: string, @NestRequest() req: RequestWithUser) {
    const adminId = req.user?.userId;
    if (!adminId) {
      throw new UnauthorizedException('Utilisateur non authentifié');
    }
    return this.fraudService.lift(id, adminId);
  }
}
