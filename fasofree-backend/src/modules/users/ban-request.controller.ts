/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request as ExpressRequest } from 'express';
import { Roles } from '../../core/security/roles.decorator';
import { RolesGuard } from '../../core/security/roles.guard';
import { UserRole } from './entities/user-role.enum';
import { BanRequestStatus } from './entities/ban-request.entity';
import { BanRequestService } from './ban-request.service';
import { Audited } from '../audit/audited.decorator';
import { CreateBanRequestDto } from './dto/create-ban-request.dto';
import { ReviewBanRequestDto } from './dto/review-ban-request.dto';

type AuthRequest = ExpressRequest & {
  user: { userId: string; role: UserRole };
};

@ApiTags('Ban Requests')
@ApiBearerAuth('JWT-auth')
@Controller('ban-requests')
@UseGuards(AuthGuard('jwt'))
export class BanRequestController {
  constructor(private readonly banRequestService: BanRequestService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPPORT, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Soumettre une demande de bannissement (Admin/Support)' })
  create(@Body() dto: CreateBanRequestDto, @Request() req: AuthRequest) {
    return this.banRequestService.create(dto, req.user.userId);
  }

  // 📖 Lecture ouverte au SUPPORT : le support doit pouvoir consulter et
  // filtrer les demandes de bannissement pour répondre aux utilisateurs.
  // La DÉCISION (approve/reject) reste strictement SUPER_ADMIN — voir `review`.
  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPPORT)
  @ApiOperation({ summary: 'Lister les demandes de ban (Super Admin / Support — lecture)' })
  list(@Query('status') status?: BanRequestStatus) {
    return this.banRequestService.list(status);
  }

  @Get('pending-count')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.SUPPORT)
  @ApiOperation({ summary: 'Nombre de demandes en attente (badge)' })
  pendingCount() {
    return this.banRequestService.pendingCount();
  }

  // 🔒 Décision de bannir / débannir : SUPER_ADMIN exclusivement.
  @Post(':id/review')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @Audited({ action: 'ban_request.review', entityType: 'BAN_REQUEST', entityParam: 'id' })
  @ApiOperation({ summary: 'Approuver ou rejeter une demande (Super Admin)' })
  review(
    @Param('id') id: string,
    @Body() dto: ReviewBanRequestDto,
    @Request() req: AuthRequest,
  ) {
    return this.banRequestService.review(id, req.user.userId, dto);
  }
}
