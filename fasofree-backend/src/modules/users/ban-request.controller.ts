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

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Lister les demandes de ban (Super Admin)' })
  list(@Query('status') status?: BanRequestStatus) {
    return this.banRequestService.list(status);
  }

  @Get('pending-count')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Nombre de demandes en attente (badge)' })
  pendingCount() {
    return this.banRequestService.pendingCount();
  }

  @Post(':id/review')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Approuver ou rejeter une demande (Super Admin)' })
  review(
    @Param('id') id: string,
    @Body() dto: ReviewBanRequestDto,
    @Request() req: AuthRequest,
  ) {
    return this.banRequestService.review(id, req.user.userId, dto);
  }
}
