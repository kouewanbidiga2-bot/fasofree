import {
  Body,
  Controller,
  Get,
  Patch,
  Param,
  Post,
  Query,
  Request as NestRequest,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Request as ExpressRequest } from 'express';
import { SubscriptionService } from './subscription.service';
import {
  AssignSubscriptionDto,
  CreatePlanDto,
  MerchantSubscribeDto,
  RenewSubscriptionDto,
  SubscribeDto,
  UpdatePlanDto,
} from './dto/subscription.dto';
import { SubscriptionSubjectType } from './entities/subscription.entity';
import { RolesGuard } from '../../core/security/roles.guard';
import { Roles } from '../../core/security/roles.decorator';
import { UserRole } from '../users/entities/user-role.enum';

type RequestWithUser = ExpressRequest & {
  user?: { userId?: string; role?: UserRole };
};

@ApiTags('Subscriptions')
@ApiBearerAuth('JWT-auth')
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  // ─── 🛡️ SUPER ADMIN : GESTION DES FORFAITS ───────────────────

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @Post('plans')
  @ApiOperation({ summary: '[Admin] Créer un forfait' })
  createPlan(@Body() dto: CreatePlanDto) {
    return this.subscriptionService.createPlan(dto);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @Patch('plans/:code')
  @ApiOperation({ summary: '[Admin] Modifier un forfait (prix, durée, commission, avantages)' })
  updatePlan(@Param('code') code: string, @Body() dto: UpdatePlanDto) {
    return this.subscriptionService.updatePlan(code, dto);
  }

  // ─── 🛡️ SUPER ADMIN : ABONNEMENTS ─────────────────────────────

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @Get()
  @ApiOperation({ summary: '[Admin] Lister tous les abonnements' })
  listSubscriptions() {
    return this.subscriptionService.listSubscriptions();
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @Post('assign')
  @ApiOperation({ summary: '[Admin] Assigner ou renouveler un forfait à un commerce/client' })
  assignSubscription(@Body() dto: AssignSubscriptionDto) {
    return this.subscriptionService.assignSubscription({
      subjectType: dto.subjectType,
      subjectId: dto.subjectId,
      planCode: dto.planCode,
      durationDays: dto.durationDays,
      autoRenew: dto.autoRenew,
      renew: dto.renew,
      debitWallet: dto.debitWallet,
    });
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @Post('renew')
  @ApiOperation({ summary: '[Admin] Renouveler l’abonnement actif d’un sujet' })
  renewSubscription(@Body() dto: RenewSubscriptionDto) {
    return this.subscriptionService.renewSubscription(
      dto.subjectType,
      dto.subjectId,
      dto.durationDays,
    );
  }

  // ─── 👤 CLIENT : CATALOGUE & FASOFREE PASS ────────────────────

  @UseGuards(AuthGuard('jwt'))
  @Get('plans')
  @ApiOperation({ summary: 'Lister les forfaits disponibles (catalogue)' })
  getPlans(@Query('subjectType') subjectType?: SubscriptionSubjectType) {
    return this.subscriptionService.getPlans(subjectType);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  @ApiOperation({ summary: 'Mon statut premium (FasoFree Pass)' })
  async getMyStatus(@NestRequest() req: RequestWithUser) {
    const clientId = req.user?.userId;
    if (!clientId) throw new ForbiddenException('Utilisateur non authentifié');
    return this.subscriptionService.getClientPremiumStatus(clientId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('subscribe')
  @ApiOperation({ summary: 'S’abonner au FasoFree Pass (débit portefeuille)' })
  async subscribe(@NestRequest() req: RequestWithUser, @Body() dto: SubscribeDto) {
    const clientId = req.user?.userId;
    if (!clientId) throw new ForbiddenException('Utilisateur non authentifié');
    return this.subscriptionService.subscribeClient(clientId, dto.planCode, {
      autoRenew: dto.autoRenew,
    });
  }

  // ─── 🏪 COMMERÇANT : ABONNEMENT PRO (obligatoire / déductible) ─

  @UseGuards(AuthGuard('jwt'))
  @Post('merchant/subscribe')
  @ApiOperation({ summary: 'Abonner son commerce au plan Pro (débit portefeuille marchand)' })
  async subscribeMerchant(
    @NestRequest() req: RequestWithUser,
    @Body() dto: MerchantSubscribeDto,
  ) {
    const userId = req.user?.userId;
    const role = req.user?.role;
    if (!userId) throw new ForbiddenException('Utilisateur non authentifié');
    return this.subscriptionService.subscribeMerchant(dto.businessId, dto.planCode, {
      autoRenew: dto.autoRenew,
      operatorUserId: userId,
      operatorRole: role,
    });
  }
}
