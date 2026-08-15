import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request as NestRequest,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request as ExpressRequest } from 'express';
import { BrandsService } from './brands.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { RolesGuard } from '../../core/security/roles.guard';
import { Roles } from '../../core/security/roles.decorator';
import { UserRole } from '../users/entities/user-role.enum';

type RequestWithUser = ExpressRequest & {
  user?: { userId?: string; role?: UserRole };
};

@ApiTags('Brands')
@Controller('brands')
export class BrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  // 🏷️ Création de marque (Admin de commerce / Super Admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.BUSINESS_ADMIN, UserRole.SUPER_ADMIN)
  @Post()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Créer une marque (multi-agences)' })
  async create(
    @NestRequest() req: RequestWithUser,
    @Body() dto: CreateBrandDto,
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Utilisateur non authentifié');
    }
    return this.brandsService.create(dto, userId);
  }

  // 🏪 Route publique : lister les marques
  @Get()
  @ApiOperation({ summary: 'Lister les marques' })
  async findAll() {
    return this.brandsService.findAll();
  }

  // 🏪 Route publique : détail d'une marque + ses agences
  @Get(':id')
  @ApiOperation({ summary: 'Obtenir une marque et ses agences' })
  async findOne(@Param('id') id: string) {
    return this.brandsService.findOne(id);
  }

  // 📍 Routage : agence la plus proche de la marque
  // Exemple : GET /brands/:id/nearest-business?latitude=12.3714&longitude=-1.5197
  @Get(':id/nearest-business')
  @ApiOperation({
    summary: 'Routage par agence la plus proche (Brand -> Business enfants)',
  })
  async findNearestBusiness(
    @Param('id') id: string,
    @Query('latitude') latitude: string,
    @Query('longitude') longitude: string,
  ) {
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return {
        error: 'Les paramètres latitude et longitude (numériques) sont requis',
      };
    }
    return this.brandsService.findNearestBusiness(id, lat, lng);
  }

  // ⚙️ Mise à jour d'une marque (Admin de commerce / Super Admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.BUSINESS_ADMIN, UserRole.SUPER_ADMIN)
  @Patch(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Mettre à jour une marque' })
  async update(
    @NestRequest() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: UpdateBrandDto,
  ) {
    await this.brandsService.assertManagedBy(
      id,
      req.user?.userId as string,
      req.user?.role as UserRole,
    );
    return this.brandsService.update(id, dto);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.BUSINESS_ADMIN, UserRole.SUPER_ADMIN)
  @Delete(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Supprimer une marque' })
  async remove(@NestRequest() req: RequestWithUser, @Param('id') id: string) {
    await this.brandsService.assertManagedBy(
      id,
      req.user?.userId as string,
      req.user?.role as UserRole,
    );
    await this.brandsService.remove(id);
    return { success: true };
  }
}
