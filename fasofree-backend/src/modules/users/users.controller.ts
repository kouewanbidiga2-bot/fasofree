import {
  Controller,
  Get,
  UseGuards,
  Request as NestRequest,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from './users.service';
import { RolesGuard } from '../../core/security/roles.guard';
import { Roles } from '../../core/security/roles.decorator';
import { UserRole } from './entities/user-role.enum';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request as ExpressRequest } from 'express';

type RequestWithUser = ExpressRequest & {
  user?: { userId?: string };
};

@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // 👤 Route protégée : Récupérer son propre profil
  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  @ApiOperation({ summary: 'Obtenir le profil de l’utilisateur connecté' })
  async getProfile(@NestRequest() req: RequestWithUser) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Utilisateur non authentifié');
    }
    return this.usersService.findById(userId);
  }

  // 🛡️ Route ultra-sécurisée : Réservée aux Super Admins
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @Get()
  @ApiOperation({ summary: 'Lister les utilisateurs (super administrateur)' })
  async getAllUsers() {
    return this.usersService.findAll();
  }
}
