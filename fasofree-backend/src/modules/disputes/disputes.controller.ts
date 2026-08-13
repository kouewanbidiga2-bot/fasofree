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
import { UserRole } from '../users/entities/user-role.enum';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { ReviewDisputeDto } from './dto/review-dispute.dto';
import { DisputeStatus } from './entities/dispute.entity';
import { DisputesService } from './disputes.service';

type AuthRequest = ExpressRequest & {
  user: { userId: string; role: UserRole };
};

@ApiTags('Disputes')
@ApiBearerAuth('JWT-auth')
@Controller('disputes')
@UseGuards(AuthGuard('jwt'))
export class DisputesController {
  constructor(private readonly disputes: DisputesService) {}

  @Post('orders/:orderId')
  @ApiOperation({ summary: 'Ouvrir un litige sur une commande livrée' })
  open(
    @Param('orderId') orderId: string,
    @Body() dto: CreateDisputeDto,
    @Request() req: AuthRequest,
  ) {
    return this.disputes.open(orderId, req.user.userId, dto);
  }

  @Get('me/:id')
  getMine(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.disputes.getForClient(id, req.user.userId);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  list(@Query('status') status?: DisputeStatus) {
    return this.disputes.list(status);
  }

  @Post(':id/review')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Accepter un remboursement ou rejeter un litige' })
  review(
    @Param('id') id: string,
    @Body() dto: ReviewDisputeDto,
    @Request() req: AuthRequest,
  ) {
    return this.disputes.review(id, req.user.userId, dto);
  }
}
