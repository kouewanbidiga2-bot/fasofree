import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request as NestRequest,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { BusinessesService } from './businesses.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';
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
  // Accepte lat/lng (frontend) OU latitude/longitude (standard)
  @Get('nearby')
  @ApiOperation({ summary: 'Rechercher les commerces à proximité' })
  async findNearby(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('latitude') latitude: string,
    @Query('longitude') longitude: string,
    @Query('radius') radius: string,
    @Query('radiusInKm') radiusInKm: string,
    @Query('category') category: string,
  ) {
    const latVal = parseFloat(lat ?? latitude);
    const lngVal = parseFloat(lng ?? longitude);
    if (isNaN(latVal) || isNaN(lngVal)) {
      throw new BadRequestException('lat/latitude et lng/longitude sont requis');
    }
    return this.businessesService.findNearby({
      latitude: latVal,
      longitude: lngVal,
      radiusInKm: radius ? Number(radius) : radiusInKm ? Number(radiusInKm) : 5,
    });
  }

  // 🏷️ Route publique : Marques groupées avec leurs agences
  // 1 marque = 1 carte sur le front (pas 1 carte par agence)
  @Get('grouped')
  @ApiOperation({ summary: 'Marques groupées avec leurs agences (1 carte par marque)' })
  async findGrouped(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('latitude') latitude: string,
    @Query('longitude') longitude: string,
    @Query('category') category: string,
  ) {
    const latVal = parseFloat(lat ?? latitude) || undefined;
    const lngVal = parseFloat(lng ?? longitude) || undefined;
    return this.businessesService.findGrouped(latVal, lngVal);
  }

  // 🏪 Mon commerce (marchand connecté)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.BUSINESS_ADMIN, UserRole.SUPER_ADMIN)
  @Get('me')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: "Obtenir le commerce du marchand connecté" })
  async findMine(@NestRequest() req: RequestWithUser) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Utilisateur non authentifié');
    }
    return this.businessesService.findByOwner(userId);
  }

  // 🏪 Gestion des commerces (Réservé au Super Admin) : liste complète
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @Get()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Lister tous les commerces (super administrateur)' })
  async findAll() {
    return this.businessesService.findAll();
  }

  @Get('trending')
  @ApiOperation({ summary: 'Top restaurants by rating' })
  async findTrending(@Query('limit') limit?: string) {
    const max = Math.min(parseInt(limit || '10', 10), 20);
    return this.businessesService.findTrending(max);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtenir un commerce et son catalogue' })
  async findOne(@Param('id') id: string) {
    return this.businessesService.findOne(id);
  }

  // ⚙️ Mise à jour des paramètres du commerce (Réservé aux Admins de commerce)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.BUSINESS_ADMIN, UserRole.SUPER_ADMIN)
  @Patch(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: "Mettre à jour les paramètres d'un commerce" })
  async update(@Param('id') id: string, @Body() dto: UpdateBusinessDto) {
    return this.businessesService.update(id, dto);
  }

  // 🗑️ Suppression d'un commerce (Réservé au Super Admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @Delete(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Supprimer un commerce (super administrateur)' })
  async remove(@Param('id') id: string) {
    return this.businessesService.remove(id);
  }
}
