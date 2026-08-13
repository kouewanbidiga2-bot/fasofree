import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request as NestRequest,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { BusinessesService } from './businesses.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import { FindNearbyDto } from './dto/find-nearby.dto';
import { RolesGuard } from '../../core/security/roles.guard';
import { Roles } from '../../core/security/roles.decorator';
import { UserRole } from '../users/entities/user-role.enum';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request as ExpressRequest } from 'express';

type RequestWithUser = ExpressRequest & {
  user?: { userId?: string; role?: UserRole };
};

@ApiTags('Businesses')
@Controller('businesses')
export class BusinessesController {
  constructor(private readonly businessesService: BusinessesService) {}

  // 🏪 Création de commerce (Réservé aux Admins de commerce et Super Admins)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.BUSINESS_ADMIN, UserRole.SUPER_ADMIN)
  @Post()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Créer un commerce' })
  async create(
    @NestRequest() req: RequestWithUser,
    @Body() dto: CreateBusinessDto,
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Utilisateur non authentifié');
    }
    return this.businessesService.create(dto, userId);
  }

  // 📍 Route publique : Rechercher les commerces à proximité
  // Exemple GET /businesses/nearby?latitude=12.3714&longitude=-1.5197&radiusInKm=3
  @Get('nearby')
  @ApiOperation({ summary: 'Rechercher les commerces à proximité' })
  async findNearby(@Query() query: FindNearbyDto) {
    return this.businessesService.findNearby({
      latitude: Number(query.latitude),
      longitude: Number(query.longitude),
      radiusInKm: query.radiusInKm ? Number(query.radiusInKm) : 5,
    });
  }

  // 🔍 Route publique : Obtenir un commerce avec ses produits
  @Get(':id')
  @ApiOperation({ summary: 'Obtenir un commerce et son catalogue' })
  async findOne(@Param('id') id: string) {
    return this.businessesService.findOne(id);
  }
}
