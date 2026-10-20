import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../core/security/roles.decorator';
import { RolesGuard } from '../../core/security/roles.guard';
import { UserRole } from '../users/entities/user-role.enum';
import {
  ApproveApplicationDto,
  ListApplicationsQueryDto,
  RejectApplicationDto,
} from './dto/application.dto';
import { OnboardingService } from './onboarding.service';
import { Request as ExpressRequest } from 'express';

const ADMIN_ROLES = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT];

type AuthRequest = ExpressRequest & {
  user?: { userId?: string; role?: UserRole };
};

@ApiTags('Onboarding')
@ApiBearerAuth('JWT-auth')
@Controller('users/applications')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  // 📋 Lister les candidatures (Marchands & Livreurs)
  @Get()
  @Roles(...ADMIN_ROLES)
  @ApiOperation({
    summary:
      'Lister les candidatures marchands & livreurs (statut, type, recherche)',
  })
  list(@Query() query: ListApplicationsQueryDto) {
    return this.onboardingService.list(query.status, query.type);
  }

  // ✅ Approuver une candidature
  @Post(':id/approve')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({
    summary:
      'Approuver une candidature : active le compte, crée le profil Business/Livreur + portefeuille, envoie les identifiants',
  })
  async approve(
    @Param('id') id: string,
    // DefaultValuePipe d'abord : l'app front envoie parfois aucun corps, et
    // class-validator plante sur `undefined` (TypeError → 500). On fournit une
    // instance vide que le ValidationPipe valide ensuite avec les mêmes règles
    // que le pipe global (whitelist strict).
    @Body(
      new DefaultValuePipe(new ApproveApplicationDto()),
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    )
    dto: ApproveApplicationDto,
    @Request() req: AuthRequest,
  ) {
    const result = await this.onboardingService.approve(
      id,
      {
        userId: req.user?.userId as string,
        role: req.user?.role as UserRole,
      },
      dto.coverImage,
    );
    // Return both user and temporary password for admin display
    return {
      user: result.user,
      tempPassword: result.tempPassword,
    };
  }

  // ❌ Rejeter une candidature (motif obligatoire)
  @Post(':id/reject')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Rejeter une candidature avec motif' })
  async reject(
    @Param('id') id: string,
    @Body() dto: RejectApplicationDto,
    @Request() req: AuthRequest,
  ) {
    return this.onboardingService.reject(
      id,
      { userId: req.user?.userId as string, role: req.user?.role as UserRole },
      dto.reason,
    );
  }
}
