import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { RolesGuard } from '../../core/security/roles.guard';
import { Roles } from '../../core/security/roles.decorator';
import { UserRole } from '../users/entities/user-role.enum';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // ➕ Ajouter un produit (Gérants & Admins)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.BUSINESS_ADMIN, UserRole.SUPER_ADMIN)
  @Post()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Ajouter un produit' })
  async create(
    @Request()
    req: ExpressRequest & { user?: { userId?: string; role?: string } },
    @Body() dto: CreateProductDto,
  ) {
    const userId = req.user?.userId as string;
    const role = req.user?.role as string;
    return this.productsService.create(dto, userId, role as any);
  }

  // 📋 Route publique : Obtenir la carte / le catalogue d'un commerce
  @Get('business/:businessId')
  @ApiOperation({ summary: 'Lister les produits d\u2019un commerce' })
  async findByBusiness(@Param('businessId') businessId: string) {
    return this.productsService.findByBusiness(businessId);
  }

  // ⚠️ Produits en stock bas pour un commerce
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.BUSINESS_ADMIN, UserRole.SUPER_ADMIN)
  @Get('business/:businessId/low-stock')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Produits dont le stock est sous le seuil d\u2019alerte' })
  async findLowStock(@Param('businessId') businessId: string) {
    return this.productsService.findLowStock(businessId);
  }

  // ✏️ Modifier un produit
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.BUSINESS_ADMIN, UserRole.SUPER_ADMIN)
  @Patch(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Modifier un produit' })
  async update(
    @Request()
    req: ExpressRequest & { user?: { userId?: string; role?: string } },
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    const userId = req.user?.userId as string;
    const role = req.user?.role as string;
    return this.productsService.update(id, dto, userId, role as any);
  }

  // ⚡ Interrupteur rapide Stock On/Off (Ex: Rupture de stock de Riz)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.BUSINESS_ADMIN, UserRole.SUPER_ADMIN)
  @Patch(':id/toggle-availability')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Activer ou désactiver la disponibilité d’un produit',
  })
  async toggleAvailability(
    @Request()
    req: ExpressRequest & { user?: { userId?: string; role?: string } },
    @Param('id') id: string,
  ) {
    const userId = req.user?.userId as string;
    const role = req.user?.role as string;
    return this.productsService.toggleAvailability(id, userId, role as any);
  }

  // 🔍 Détail d'un produit
  @Get(':id')
  @ApiOperation({ summary: 'Obtenir le détail d\'un produit par son ID' })
  async findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  // 📦 Mettre à jour le stock d'un produit
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.BUSINESS_ADMIN, UserRole.SUPER_ADMIN)
  @Post(':id/stock')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Mettre à jour le stock d\'un produit' })
  async updateStock(
    @Request()
    req: ExpressRequest & { user?: { userId?: string; role?: string } },
    @Param('id') id: string,
    @Body() body: { quantity: number; reason?: string },
  ) {
    const userId = req.user?.userId as string;
    const role = req.user?.role as string;
    return this.productsService.updateStock(id, body.quantity, body.reason ?? 'MANUAL_ADJUSTMENT', userId, role as any);
  }

  // 🏷️ Générer un SKU automatiquement
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.BUSINESS_ADMIN, UserRole.SUPER_ADMIN)
  @Post('generate-sku')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Générer un SKU automatiquement pour un produit' })
  async generateSku(
    @Body() body: { businessId: string; productName: string; category?: string },
  ) {
    return { sku: this.productsService.generateSku(body.businessId, body.productName, body.category) };
  }

  // 🗑️ Supprimer un produit
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.BUSINESS_ADMIN, UserRole.SUPER_ADMIN)
  @Delete(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Supprimer un produit' })
  async remove(
    @Request()
    req: ExpressRequest & { user?: { userId?: string; role?: string } },
    @Param('id') id: string,
  ) {
    const userId = req.user?.userId as string;
    const role = req.user?.role as string;
    return this.productsService.remove(id, userId, role as any);
  }
}
