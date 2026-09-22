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
  UseInterceptors,
  Request,
  UploadedFile,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request as ExpressRequest } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { ProductsService } from './products.service';
import { PdfImportService } from './pdf-import.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ConfirmImportDto } from './dto/import-catalog.dto';
import { BusinessesService } from '../businesses/businesses.service';
import { RolesGuard } from '../../core/security/roles.guard';
import { Roles } from '../../core/security/roles.decorator';
import { UserRole } from '../users/entities/user-role.enum';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiConsumes, ApiBody } from '@nestjs/swagger';

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  private readonly logger = new Logger(ProductsController.name);

  constructor(
    private readonly productsService: ProductsService,
    private readonly businessesService: BusinessesService,
    private readonly pdfImportService: PdfImportService,
  ) {}

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
  async findByBusiness(@Param('businessId') businessId: string, @Query('category') category?: string) {
    return this.productsService.findByBusiness(businessId, category);
  }

  // ⚠️ Produits en stock bas pour un commerce
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.BUSINESS_ADMIN, UserRole.SUPER_ADMIN)
  @Get('business/:businessId/low-stock')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Produits dont le stock est sous le seuil d\u2019alerte' })
  async findLowStock(
    @Request() req: ExpressRequest & { user?: { userId?: string; role?: string } },
    @Param('businessId') businessId: string,
  ) {
    const userId = req.user?.userId as string;
    const role = req.user?.role as string;
    // 🔒 Vérifier que le marchand possède bien cette agence
    await this.businessesService.assertManagedBy(businessId, userId, role as any);
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

  // 📄 Import catalogue depuis PDF (analyse via Gemini)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.BUSINESS_ADMIN, UserRole.SUPER_ADMIN)
  @Post('import-pdf/analyze')
  @UseInterceptors(
    FileInterceptor('pdf', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
      fileFilter: (_req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
          cb(null, true);
        } else {
          cb(new BadRequestException('Seuls les fichiers PDF sont acceptés'), false);
        }
      },
    }),
  )
  @ApiBearerAuth('JWT-auth')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['pdf', 'businessId'],
      properties: {
        pdf: { type: 'string', format: 'binary', description: 'PDF du menu (max 10 MB)' },
        businessId: { type: 'string', format: 'uuid', description: 'ID du business' },
      },
    },
  })
  @ApiOperation({ summary: 'Analyser un PDF de menu et retourner un preview du catalogue' })
  async analyzePdf(
    @Request() req: ExpressRequest & { user?: { userId?: string; role?: string } },
    @UploadedFile() pdf?: Express.Multer.File,
    @Body('businessId') businessId?: string,
  ) {
    if (!pdf) {
      throw new BadRequestException('Fichier PDF requis');
    }

    if (!businessId) {
      throw new BadRequestException('businessId requis');
    }

    const userId = req.user?.userId as string;
    const role = req.user?.role as string;

    // Vérifier que le marchand possède bien ce business
    await this.businessesService.assertManagedBy(businessId, userId, role as any);

    // Vérifier que le service est disponible
    if (!this.pdfImportService.isAvailable()) {
      throw new BadRequestException(
        'Service d\'import PDF non configuré. Contactez l\'administrateur.',
      );
    }

    // Analyser le PDF
    const result = await this.pdfImportService.analyzeMenuPdf(pdf.buffer, pdf.originalname);

    return {
      success: true,
      message: `${result.totalProducts} produits trouvés dans ${result.categories.length} catégories`,
      data: result,
    };
  }

  // ✅ Confirmer l'import et créer les produits
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.BUSINESS_ADMIN, UserRole.SUPER_ADMIN)
  @Post('import-pdf/confirm')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Confirmer l\'import et créer les produits du catalogue' })
  async confirmImport(
    @Request() req: ExpressRequest & { user?: { userId?: string; role?: string } },
    @Body() dto: ConfirmImportDto,
  ) {
    const userId = req.user?.userId as string;
    const role = req.user?.role as string;

    // Vérifier que le marchand possède bien ce business
    await this.businessesService.assertManagedBy(dto.businessId, userId, role as any);

    // Créer tous les produits
    const created: string[] = [];
    const errors: { name: string; error: string }[] = [];
    for (const category of dto.categories) {
      for (const product of category.products) {
        try {
          await this.productsService.create(
            {
              name: product.name,
              description: product.description,
              price: product.price,
              category: category.name,
              type: product.type,
              imageUrl: product.imageUrl,
              businessId: dto.businessId,
              isAvailable: dto.setAvailable ?? true,
            },
            userId,
            role as any,
          );
          created.push(product.name);
        } catch (err: any) {
          this.logger.warn(`[PDF Import] Échec création "${product.name}": ${err.message}`);
          errors.push({ name: product.name, error: err.message });
        }
      }
    }

    return {
      success: true,
      message: errors.length > 0
        ? `${created.length} produits créés, ${errors.length} échoués`
        : `${created.length} produits créés avec succès`,
      created,
      errors: errors.length > 0 ? errors : undefined,
    };
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
    @Request() req: ExpressRequest & { user?: { userId?: string; role?: string } },
    @Body() body: { businessId: string; productName: string; category?: string },
  ) {
    if (!body.businessId || !body.productName) {
      throw new BadRequestException('businessId et productName sont requis');
    }
    const userId = req.user?.userId as string;
    const role = req.user?.role as string;
    // 🔒 Vérifier que le marchand possède bien cette agence
    await this.businessesService.assertManagedBy(body.businessId, userId, role as any);
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
