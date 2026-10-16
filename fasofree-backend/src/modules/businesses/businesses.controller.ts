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
import { Audited } from '../audit/audited.decorator';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { BulkAssignSubCategoryDto } from './dto/bulk-assign-subcategory.dto';
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
    @Query('subCategory') subCategory: string,
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
      // 🏷️ Filtres catalogue — auparavant IGNORÉS ici alors qu'ils étaient
      // déclarés en @Query : la route répondait sans filtrer.
      category: category || undefined,
      subCategory: subCategory || undefined,
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
    @Query('subCategory') subCategory: string,
  ) {
    const latVal = parseFloat(lat ?? latitude) || undefined;
    const lngVal = parseFloat(lng ?? longitude) || undefined;
    // 🏷️ `category` était récupéré puis JETÉ : c'est la cause racine du
    // « même résultat quel que soit le filtre choisi côté client ».
    return this.businessesService.findGrouped(
      latVal,
      lngVal,
      category || undefined,
      subCategory || undefined,
    );
  }

  // 🏷️ Route publique : catalogue des catégories actives (niveau 1 + 2).
  // Le client construit ses filtres à partir de cette liste — plus de
  // libellés codés en dur (« Fast-Food »…) qui ne correspondaient à rien.
  @Get('categories')
  @ApiOperation({
    summary: 'Catalogue des catégories et sous-catégories actives',
  })
  async getCategories() {
    return this.businessesService.getCategoryCatalog();
  }

  // 🏪 Mon commerce (marchand connecté)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.BUSINESS_ADMIN, UserRole.SUPER_ADMIN)
  @Get('me')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: "Obtenir le(s) commerce(s) du marchand connecté" })
  async findMine(@NestRequest() req: RequestWithUser) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Utilisateur non authentifié');
    }

    const businesses = await this.businessesService.findAllByOwner(userId);

    // Si le marchand n'a aucun business, retourner un objet vide
    // plutôt que de créer une agence avec des coordonnées fictives
    if (!businesses.length) {
      return null;
    }

    const primary = businesses[0];
    return {
      ...primary,
      brandId: primary.brandId,
      branches: businesses.map(b => ({ id: b.id, name: b.name, address: b.address, isOpen: b.isOpen })),
    };
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

  // ─────────────────────────────────────────────────────────────────────
  // 🏷️ F-bis — Taguage de masse des sous-catégories (niveau 2)
  //
  // Déclaré AVANT `@Get(':id')` / `@Patch(':id')` : Nest résout dans l'ordre
  // de déclaration, et « admin/… » a deux segments là où `:id` n'en a qu'un.
  //
  // Rôles : Super Admin, Admin ET Support. Comme pour les agences, le
  // Support doit pouvoir réparer une donnée manquante sans escalade — c'est
  // exactement le travail de rattrapage visé ici. Chaque écriture est
  // auditée (`@Audited`), donc l'action reste traçable.
  // ─────────────────────────────────────────────────────────────────────

  // 🏷️ État du taguage : combien de commerces sans sous-catégorie, par verticale
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  @Get('admin/subcategory-tagging')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Commerces sans sous-catégorie, groupés par verticale',
  })
  async getSubCategoryTagging(@Query('limit') limit?: string) {
    const parsed = parseInt(limit || '500', 10);
    return this.businessesService.getSubCategoryTaggingOverview(
      Number.isFinite(parsed) ? parsed : 500,
    );
  }

  // ⚡ Résolution automatique des verticales à sous-catégorie unique
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  @Patch('admin/subcategory-tagging/auto')
  @Audited({ action: 'business.subcategory.autotag', entityType: 'BUSINESS' })
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary:
      'Compléter automatiquement les verticales à sous-catégorie unique (idempotent)',
  })
  async autoTagSubCategories() {
    return this.businessesService.autoTagSingleSubCategoryBusinesses();
  }

  // 🎯 Affectation explicite d'une sous-catégorie à une sélection de commerces
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  @Patch('admin/subcategory-tagging')
  @Audited({ action: 'business.subcategory.bulk', entityType: 'BUSINESS' })
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Affecter une sous-catégorie à plusieurs commerces',
  })
  async bulkAssignSubCategory(@Body() dto: BulkAssignSubCategoryDto) {
    return this.businessesService.bulkAssignSubCategory(dto);
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
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateBusinessDto,
    @NestRequest() req: RequestWithUser,
  ) {
    const userId = req.user?.userId;
    const role = req.user?.role;
    if (!userId) throw new UnauthorizedException('Utilisateur non authentifié');
    // 🔒 Vérifier que le marchand administre bien ce commerce
    if (role === UserRole.BUSINESS_ADMIN) {
      await this.businessesService.assertManagedBy(id, userId, role);
    }
    return this.businessesService.update(id, dto);
  }

  // 🗑️ Suppression d'un commerce (Réservé au Super Admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @Delete(':id')
  @Audited({ action: 'business.delete', entityType: 'BUSINESS', entityParam: 'id' })
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Supprimer un commerce (super administrateur)' })
  async remove(@Param('id') id: string) {
    return this.businessesService.remove(id);
  }

  // 🔄 Transférer la propriété d'un commerce (Super Admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @Patch(':id/transfer-owner')
  @Audited({ action: 'business.transfer_owner', entityType: 'BUSINESS', entityParam: 'id' })
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Transférer un commerce vers un autre utilisateur' })
  async transferOwner(
    @Param('id') id: string,
    @Body('newOwnerId') newOwnerId: string,
  ) {
    return this.businessesService.transferOwner(id, newOwnerId);
  }
}
