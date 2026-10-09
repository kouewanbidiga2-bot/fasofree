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
import { Audited } from '../audit/audited.decorator';
import { RolesGuard } from '../../core/security/roles.guard';
import { UserRole } from '../users/entities/user-role.enum';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { ReviewDisputeDto } from './dto/review-dispute.dto';
import { SendDisputeMessageDto } from './dto/send-dispute-message.dto';
import { MerchantRefundDto } from './dto/merchant-refund.dto';
import { ListDisputesQueryDto } from './dto/list-disputes-query.dto';
import { DisputeResolution } from './entities/dispute.entity';
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

  @Get('me')
  @ApiOperation({ summary: 'Lister tous mes litiges (client)' })
  listMine(@Request() req: AuthRequest) {
    return this.disputes.listForClient(req.user.userId);
  }

  @Get('eligible-orders')
  @UseGuards(RolesGuard)
  @Roles(UserRole.CLIENT)
  @ApiOperation({
    summary: 'Commandes livrées éligibles à une nouvelle réclamation (client)',
  })
  listEligibleOrders(@Request() req: AuthRequest) {
    return this.disputes.listEligibleOrders(req.user.userId);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  list(@Query() query: ListDisputesQueryDto) {
    return this.disputes.list(query.status);
  }

  @Get('business')
  @UseGuards(RolesGuard)
  @Roles(UserRole.BUSINESS_ADMIN)
  @ApiOperation({
    summary: 'Liste des litiges des commerces du gérant (multi-agences)',
  })
  listForBusiness(@Request() req: AuthRequest) {
    return this.disputes.listForBusiness(req.user.userId);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.SUPPORT,
    UserRole.BUSINESS_ADMIN,
  )
  @ApiOperation({
    summary: "Détail d'un litige (administration / gérant du commerce)",
  })
  getForStaff(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.disputes.getForStaff(id, req.user.role, req.user.userId);
  }

  @Get(':id/messages')
  @ApiOperation({ summary: "Messages du chat support d'un litige" })
  listMessages(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.disputes.listMessages(id, req.user.role, req.user.userId);
  }

  @Post(':id/messages')
  @ApiOperation({
    summary: "Envoyer un message dans le chat support d'un litige",
  })
  sendMessage(
    @Param('id') id: string,
    @Body() dto: SendDisputeMessageDto,
    @Request() req: AuthRequest,
  ) {
    return this.disputes.addMessage(
      id,
      req.user.role,
      req.user.userId,
      dto.message,
    );
  }

  @Post(':id/assign-support')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  @ApiOperation({ summary: 'Assigner un litige à un agent support' })
  assignToSupport(
    @Param('id') id: string,
    @Body() dto: { note?: string },
    @Request() req: AuthRequest,
  ) {
    return this.disputes.assignToSupport(id, req.user.userId, dto.note);
  }

  @Post(':id/submit-recommendation')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  @Audited({
    action: 'dispute.recommendation.submit',
    entityType: 'DISPUTE',
    entityParam: 'id',
  })
  @ApiOperation({ summary: 'Soumettre une recommandation de remboursement' })
  submitRecommendation(
    @Param('id') id: string,
    @Body()
    dto: {
      resolution: DisputeResolution;
      refundAmount?: number;
      note?: string;
    },
    @Request() req: AuthRequest,
  ) {
    return this.disputes.submitRecommendation(
      id,
      req.user.userId,
      dto.resolution,
      dto.refundAmount,
      dto.note,
    );
  }

  @Post(':id/approve')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Approuver et exécuter le remboursement (Admin only)',
  })
  approveRefund(
    @Param('id') id: string,
    @Body() dto: { note?: string },
    @Request() req: AuthRequest,
  ) {
    return this.disputes.approveRefund(id, req.user.userId, dto.note);
  }

  @Post(':id/reject')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Rejeter un litige (Admin only)' })
  rejectDispute(
    @Param('id') id: string,
    @Body() dto: { note?: string },
    @Request() req: AuthRequest,
  ) {
    return this.disputes.rejectDispute(id, req.user.userId, dto.note);
  }

  @Post(':id/merchant-refund')
  @UseGuards(RolesGuard)
  @Roles(UserRole.BUSINESS_ADMIN)
  @ApiOperation({
    summary:
      'Rembourser un litige de son commerce (décision du gérant, montant = total de la commande)',
  })
  merchantRefund(
    @Param('id') id: string,
    @Body() dto: MerchantRefundDto,
    @Request() req: AuthRequest,
  ) {
    return this.disputes.merchantRefund(
      id,
      req.user.userId,
      req.user.role,
      dto.note,
    );
  }

  @Post(':id/review')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Réviser un litige (déprécié - utiliser approve/reject)',
  })
  review(
    @Param('id') id: string,
    @Body() dto: ReviewDisputeDto,
    @Request() req: AuthRequest,
  ) {
    return this.disputes.review(id, req.user.userId, dto);
  }
}
